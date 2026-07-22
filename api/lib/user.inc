<?php
// Vex Hack Coin (VHC) - Dane uzytkownika
// Wersja: 1.0.0

require_once __DIR__ . '/database.inc';

$db = Database::getInstance();

$input = Database::getJsonInput();

$wallet = trim($input['wallet'] ?? '');

if (empty($wallet)) {
    Database::jsonError('Podaj adres portfela');
}

$user = $db->fetchOne(
    "SELECT id, login, email, wallet_address, balance, created_at FROM users WHERE wallet_address = ? LIMIT 1",
    [$wallet]
);

if (!$user) {
    Database::jsonError('Uzytkownik nie istnieje');
}

// Statystyki
$txCount = $db->fetchOne(
    "SELECT COUNT(*) as count FROM transactions WHERE sender = ? OR receiver = ?",
    [$wallet, $wallet]
);
$txCount = $txCount ? (int)$txCount['count'] : 0;

$blocksMined = $db->fetchOne(
    "SELECT COUNT(*) as count FROM blocks WHERE miner = ?",
    [$wallet]
);
$blocksMined = $blocksMined ? (int)$blocksMined['count'] : 0;

Database::jsonSuccess([
    'user' => [
        'id' => $user['id'],
        'login' => $user['login'],
        'email' => $user['email'],
        'wallet' => $user['wallet_address'],
        'balance' => (float)$user['balance'],
        'created_at' => $user['created_at'],
        'transactions_count' => $txCount,
        'blocks_mined' => $blocksMined
    ]
]);
