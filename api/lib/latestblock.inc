<?php
// Vex Hack Coin (VHC) - Pobranie ostatniego bloku
// Wersja: 1.0.0

require_once __DIR__ . '/database.inc';
require_once __DIR__ . '/blockchain.inc';

$blockchain = new Blockchain();

$block = $blockchain->getLatestBlock();

Database::jsonSuccess([
    'block' => $block
]);
