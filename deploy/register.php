<?php
// Vex Hack Coin (VHC) - Rejestracja uzytkownika
// Wersja: 1.0.0

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/blockchain.php';

$db = Database::getInstance();
$blockchain = new Blockchain();

$input = Database::getJsonInput();

$login = trim($input['login'] ?? '');
$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

if (empty($login) || empty($email) || empty($password)) {
    Database::jsonError('Wypelnij wszystkie pola (login, email, haslo)');
}

if (strlen($login) < 3 || strlen($login) > 50) {
    Database::jsonError('Login musi miec od 3 do 50 znakow');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    Database::jsonError('Nieprawidlowy adres email');
}

if (strlen($password) < 6) {
    Database::jsonError('Haslo musi miec co najmniej 6 znakow');
}

// Sprawdzenie czy login juz istnieje
$existing = $db->fetchOne("SELECT id FROM users WHERE login = ?", [$login]);
if ($existing) {
    Database::jsonError('Uzytkownik o tym loginie juz istnieje');
}

// Sprawdzenie czy email juz istnieje
$existing = $db->fetchOne("SELECT id FROM users WHERE email = ?", [$email]);
if ($existing) {
    Database::jsonError('Ten adres email jest juz uzywany');
}

// Generowanie adresu portfela
$wallet = Blockchain::generateWalletAddress();

// Haszowanie hasla
$passwordHash = password_hash($password, PASSWORD_BCRYPT);

// Zapis uzytkownika
$db->insert(
    "INSERT INTO users (login, email, password_hash, wallet_address, balance, created_at)
     VALUES (?, ?, ?, ?, 0, NOW())",
    [$login, $email, $passwordHash, $wallet]
);

$userId = $db->getPdo()->lastInsertId();

Database::jsonSuccess([
    'message' => 'Rejestracja zakonczona sukcesem',
    'user_id' => $userId,
    'wallet' => $wallet
]);
