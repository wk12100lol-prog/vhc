<?php
// Vex Hack Coin (VHC) - Wysylanie monet
// Wersja: 1.0.0

require_once __DIR__ . '/database.inc';
require_once __DIR__ . '/blockchain.inc';

$db = Database::getInstance();
$blockchain = new Blockchain();

$input = getJsonInput();

$sender = trim($input['sender'] ?? '');
$receiver = trim($input['receiver'] ?? '');
$amount = (float)($input['amount'] ?? 0);
$password = $input['password'] ?? '';

if (empty($sender) || empty($receiver) || $amount <= 0) {
    jsonError('Wypelnij wszystkie pola (sender, receiver, amount)');
}

// Autoryzacja - sprawdzenie hasla nadawcy
$user = $db->fetchOne(
    "SELECT id, password_hash, balance FROM users WHERE wallet_address = ? LIMIT 1",
    [$sender]
);

if (!$user) {
    jsonError('Nadawca nie istnieje');
}

if (empty($password) || !password_verify($password, $user['password_hash'])) {
    jsonError('Nieprawidlowe haslo');
}

// Sprawdzenie czy odbiorca istnieje
$receiverUser = $db->fetchOne(
    "SELECT id FROM users WHERE wallet_address = ? LIMIT 1",
    [$receiver]
);

if (!$receiverUser) {
    jsonError('Adres odbiorcy nie istnieje');
}

if ($sender === $receiver) {
    jsonError('Nie mozesz wyslac monet do samego siebie');
}

if ($user['balance'] < $amount) {
    jsonError('Niewystarczajace saldo. Posiadasz: ' . $user['balance'] . ' VHC');
}

// Dodanie transakcji do pending
$blockchain->addPendingTransaction($sender, $receiver, $amount);

jsonSuccess([
    'message' => "Transakcja na $amount VHC zostala utworzona i czeka na potwierdzenie w bloku",
    'transaction' => [
        'sender' => $sender,
        'receiver' => $receiver,
        'amount' => $amount,
        'timestamp' => time()
    ]
]);
