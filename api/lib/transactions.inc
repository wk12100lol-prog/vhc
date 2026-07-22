<?php
// Vex Hack Coin (VHC) - Historia transakcji
// Wersja: 1.0.0

require_once __DIR__ . '/database.inc';

$db = Database::getInstance();

$input = Database::getJsonInput();

$wallet = trim($input['wallet'] ?? '');
$limit = min((int)($input['limit'] ?? 50), 100);
$offset = (int)($input['offset'] ?? 0);

if (empty($wallet)) {
    Database::jsonError('Podaj adres portfela');
}

$transactions = $db->fetchAll(
    "SELECT t.*, b.block_index
     FROM transactions t
     LEFT JOIN blocks b ON t.block_id = b.id
     WHERE t.sender = ? OR t.receiver = ?
     ORDER BY t.timestamp DESC
     LIMIT ? OFFSET ?",
    [$wallet, $wallet, $limit, $offset]
);

Database::jsonSuccess([
    'transactions' => $transactions,
    'count' => count($transactions)
]);
