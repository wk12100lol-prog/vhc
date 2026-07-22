<?php
// Vex Hack Coin (VHC) - Logowanie uzytkownika
// Wersja: 1.0.1

require_once __DIR__ . '/database.php';

$db = Database::getInstance();

$input = Database::getJsonInput();

$login = trim($input['login'] ?? '');
$password = $input['password'] ?? '';

if (empty($login) || empty($password)) {
    Database::jsonError('Wypelnij wszystkie pola (login, haslo)');
}

$user = $db->fetchOne(
    "SELECT id, login, email, password_hash, wallet_address, balance, created_at
     FROM users WHERE login = ? OR email = ? LIMIT 1",
    [$login, $login]
);

if (!$user) {
    Database::jsonError('Nieprawidlowy login lub haslo');
}

if (!password_verify($password, $user['password_hash'])) {
    Database::jsonError('Nieprawidlowy login lub haslo');
}

// Generowanie i zapis tokena sesji
$token = bin2hex(random_bytes(32));
$expires = date('Y-m-d H:i:s', time() + 86400 * 7); // 7 dni

$db->insert(
    "INSERT INTO sessions (user_id, token, created_at, expires_at) VALUES (?, ?, NOW(), ?)",
    [$user['id'], $token, $expires]
);

// Usun stare tokeny tego uzytkownika (zachowaj ostatnie 5)
$db->query(
    "DELETE FROM sessions WHERE user_id = ? AND id NOT IN (
        SELECT id FROM (SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5) AS keep_sessions
    )",
    [$user['id'], $user['id']]
);

Database::jsonSuccess([
    'message' => 'Zalogowano pomyslnie',
    'token' => $token,
    'user' => [
        'id' => $user['id'],
        'login' => $user['login'],
        'email' => $user['email'],
        'wallet' => $user['wallet_address'],
        'balance' => (float)$user['balance']
    ]
]);
