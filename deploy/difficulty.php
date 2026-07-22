<?php
// Vex Hack Coin (VHC) - Pobranie aktualnej trudnosci
// Wersja: 1.0.0

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/blockchain.php';

$blockchain = new Blockchain();

$currentDifficulty = $blockchain->getCurrentDifficulty();
$nextDifficulty = $blockchain->calculateNewDifficulty();
$latestBlock = $blockchain->getLatestBlock();

Database::jsonSuccess([
    'current_difficulty' => $currentDifficulty,
    'next_difficulty' => $nextDifficulty,
    'target_block_time' => TARGET_BLOCK_TIME,
    'latest_block_index' => $latestBlock['block_index'],
    'latest_block_hash' => $latestBlock['current_hash']
]);
