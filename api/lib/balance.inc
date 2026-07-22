<?php
// Vex Hack Coin (VHC) - Sprawdzanie salda
// Wersja: 1.0.0

require_once __DIR__ . '/database.inc';

$db = Database::getInstance();

$input = getJsonInput();

$wallet = trim($input['wallet'] ?? '');

if (empty($wallet)) {
    jsonError('Podaj adres portfela');
}

$user = $db->fetchOne(
    "SELECT login, wallet_address, balance, created_at FROM users WHERE wallet_address = ? LIMIT 1",
    [$wallet]
);

if (!$user) {
    jsonError('Portfel nie istnieje');
}

jsonSuccess([
    'wallet' => $user['wallet_address'],
    'login' => $user['login'],
    'balance' => (float)$user['balance'],
    'created_at' => $user['created_at']
]);
