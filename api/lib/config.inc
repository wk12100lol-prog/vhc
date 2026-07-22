<?php
// Vex Hack Coin (VHC) - Konfiguracja
// Wersja: 1.0.0

// -------------------------------------------------------
// Ustawienia bazy danych
// -------------------------------------------------------
define('DB_HOST', 'ep-quiet-truth-axwblon3-pooler.c-4.us-east-2.aws.neon.tech');
define('DB_PORT', '5432');
define('DB_NAME', 'neondb');
define('DB_USER', 'neondb_owner');
define('DB_PASS', 'npg_vaEFiKk3qB7r');
define('DB_DRIVER', 'pgsql');

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
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
