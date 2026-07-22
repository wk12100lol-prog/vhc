<?php
require_once __DIR__ . '/lib/config.inc';
require_once __DIR__ . '/lib/database.inc';
require_once __DIR__ . '/lib/helpers.inc';

$db = null;
function getDB() {
    global $db;
    if ($db === null) {
        $db = Database::getInstance();
    }
    return $db;
}

$input = getJsonInput();

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = preg_replace('#^.*/api/#', '', $path);
$path = preg_replace('#\.(php|inc)$#', '', $path);
$action = $input['action'] ?? $path;

$libDir = __DIR__ . '/lib';

try {
    switch ($action) {
        case 'test':
            jsonSuccess(['message' => 'PHP works!', 'time' => time()]);
            break;
        case 'setup':
            getDB();
            $sql = file_get_contents(__DIR__ . '/../database/schema_pg.sql');
            $db->query($sql);
            jsonSuccess(['message' => 'Schema created']);
            break;
        case 'register': getDB(); require $libDir . '/register.inc'; break;
        case 'login': getDB(); require $libDir . '/login.inc'; break;
        case 'user': getDB(); require $libDir . '/user.inc'; break;
        case 'balance': getDB(); require $libDir . '/balance.inc'; break;
        case 'transfer': getDB(); require $libDir . '/transfer.inc'; break;
        case 'transactions': getDB(); require $libDir . '/transactions.inc'; break;
        case 'blockchain':
        case 'info': getDB(); require $libDir . '/blockchain.inc'; break;
        case 'difficulty': getDB(); require $libDir . '/difficulty.inc'; break;
        case 'latestblock': getDB(); require $libDir . '/latestblock.inc'; break;
        case 'mine':
        case 'get_job':
        case 'submit_block': getDB(); require $libDir . '/mine.inc'; break;
        case 'miner':
        case 'register_miner': getDB(); require $libDir . '/miner.inc'; break;
        case 'rewards': getDB(); require $libDir . '/rewards.inc'; break;
        case 'reset': getDB(); require $libDir . '/reset.inc'; break;
        default: jsonError('Nieznane endpoint: ' . $action);
    }
} catch (Exception $e) {
    jsonError('Blad serwera: ' . $e->getMessage());
}
