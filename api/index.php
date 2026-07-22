<?php
// VHC API Router - single entry point for Vercel
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/config.php';

$input = Database::getJsonInput();

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = preg_replace('#^.*/api/#', '', $path);
$path = preg_replace('#\.(php|inc)$#', '', $path);
$action = $input['action'] ?? $path;

$libDir = __DIR__ . '/lib';

try {
    switch ($action) {
        case 'register': require $libDir . '/register.inc'; break;
        case 'login': require $libDir . '/login.inc'; break;
        case 'user': require $libDir . '/user.inc'; break;
        case 'balance': require $libDir . '/balance.inc'; break;
        case 'transfer': require $libDir . '/transfer.inc'; break;
        case 'transactions': require $libDir . '/transactions.inc'; break;
        case 'blockchain':
        case 'info': require $libDir . '/blockchain.inc'; break;
        case 'difficulty': require $libDir . '/difficulty.inc'; break;
        case 'latestblock': require $libDir . '/latestblock.inc'; break;
        case 'mine':
        case 'get_job':
        case 'submit_block': require $libDir . '/mine.inc'; break;
        case 'miner':
        case 'register_miner': require $libDir . '/miner.inc'; break;
        case 'rewards': require $libDir . '/rewards.inc'; break;
        case 'test': require $libDir . '/test.inc'; break;
        case 'reset': require $libDir . '/reset.inc'; break;
        default: Database::jsonError('Nieznane endpoint: ' . $action);
    }
} catch (Exception $e) {
    Database::jsonError('Blad serwera: ' . $e->getMessage());
}
