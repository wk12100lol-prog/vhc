<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/blockchain.php';

$db = Database::getInstance();

// usun wszystko
$db->query("DELETE FROM blocks");
$db->query("DELETE FROM pending_transactions");
$db->query("DELETE FROM users");

// stworz genesis na nowo
$genesis = Blockchain::getGenesisData();

$db->insert(
    "INSERT INTO blocks (block_index, previous_hash, current_hash, nonce, miner, reward, timestamp, difficulty, transactions_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
    [
        $genesis['block_index'],
        $genesis['previous_hash'],
        $genesis['current_hash'],
        $genesis['nonce'],
        $genesis['miner'],
        $genesis['reward'],
        $genesis['timestamp'],
        $genesis['difficulty'],
        $genesis['transactions_json']
    ]
);

echo json_encode([
    'success' => true,
    'message' => 'Blockchain zresetowany. Genesis: diff=' . $genesis['difficulty'] . ' hash=' . $genesis['current_hash']
]);
