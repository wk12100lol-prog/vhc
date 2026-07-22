<?php
// Vex Hack Coin (VHC) - Konfiguracja
// Wersja: 1.0.0

// -------------------------------------------------------
// Ustawienia bazy danych
// -------------------------------------------------------
define('DB_HOST', 'sql301.infinityfree.com');
define('DB_NAME', 'if0_41469094_vexcoin');
define('DB_USER', 'if0_41469094');
define('DB_PASS', '121koko9a');

// -------------------------------------------------------
// Ustawienia blockchain
// -------------------------------------------------------
define('BLOCK_REWARD', 1.00000000);
define('TARGET_BLOCK_TIME', 60); // sekund (1 minuta)
define('DIFFICULTY_ADJUST_INTERVAL', 100); // co ile blokow dostosowac trudnosc
define('GENESIS_PREV_HASH', '0000000000000000000000000000000000000000000000000000000000000000');
define('MIN_DIFFICULTY', 4); // najmniejsza trudnosc
define('MAX_DIFFICULTY', 20); // najwieksza trudnosc

// -------------------------------------------------------
// Ustawienia aplikacji
// -------------------------------------------------------
define('SITE_NAME', 'Vex Hack Coin');
define('SITE_URL', 'https://vexcoin.xo.je');

// -------------------------------------------------------
// Naglowki CORS i JSON
// -------------------------------------------------------
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
