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
        case 'debug':
            jsonSuccess(['input' => $input, 'path' => $path, 'method' => $_SERVER['REQUEST_METHOD']]);
            break;
        case 'setup':
            getDB();
            $statements = [
                "CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    login VARCHAR(50) NOT NULL UNIQUE,
                    email VARCHAR(100) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    wallet_address VARCHAR(64) NOT NULL UNIQUE,
                    balance DECIMAL(18, 8) NOT NULL DEFAULT 0.00000000,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )",
                "CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address)",
                "CREATE TABLE IF NOT EXISTS sessions (
                    id SERIAL PRIMARY KEY,
                    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token VARCHAR(64) NOT NULL UNIQUE,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    expires_at TIMESTAMP NOT NULL
                )",
                "CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)",
                "CREATE TABLE IF NOT EXISTS blocks (
                    id SERIAL PRIMARY KEY,
                    block_index INT NOT NULL UNIQUE,
                    previous_hash VARCHAR(64) NOT NULL,
                    current_hash VARCHAR(64) NOT NULL,
                    nonce BIGINT NOT NULL,
                    miner VARCHAR(64) NOT NULL,
                    reward DECIMAL(18, 8) NOT NULL DEFAULT 1.00000000,
                    timestamp INT NOT NULL,
                    difficulty INT NOT NULL,
                    transactions_json TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )",
                "CREATE INDEX IF NOT EXISTS idx_blocks_index ON blocks(block_index)",
                "CREATE TABLE IF NOT EXISTS transactions (
                    id SERIAL PRIMARY KEY,
                    sender VARCHAR(64) NOT NULL,
                    receiver VARCHAR(64) NOT NULL,
                    amount DECIMAL(18, 8) NOT NULL,
                    timestamp INT NOT NULL,
                    block_id INT REFERENCES blocks(id) ON DELETE SET NULL
                )",
                "CREATE INDEX IF NOT EXISTS idx_tx_sender ON transactions(sender)",
                "CREATE TABLE IF NOT EXISTS miners (
                    id SERIAL PRIMARY KEY,
                    wallet VARCHAR(64) NOT NULL UNIQUE,
                    hashrate DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
                    last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
                    ip_address VARCHAR(45) DEFAULT NULL
                )",
                "CREATE TABLE IF NOT EXISTS pending_transactions (
                    id SERIAL PRIMARY KEY,
                    sender VARCHAR(64) NOT NULL,
                    receiver VARCHAR(64) NOT NULL,
                    amount DECIMAL(18, 8) NOT NULL,
                    timestamp INT NOT NULL,
                    block_id INT DEFAULT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )",
                "CREATE TABLE IF NOT EXISTS rewards (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    vhc_required DECIMAL(16,8) NOT NULL DEFAULT 0,
                    stock INT NOT NULL DEFAULT 1,
                    claimed INT NOT NULL DEFAULT 0,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )",
                "CREATE TABLE IF NOT EXISTS reward_claims (
                    id SERIAL PRIMARY KEY,
                    reward_id INT NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
                    wallet VARCHAR(66) NOT NULL,
                    claimed_at TIMESTAMP NOT NULL DEFAULT NOW()
                )",
                "INSERT INTO blocks (block_index, previous_hash, current_hash, nonce, miner, reward, timestamp, difficulty, transactions_json)
                SELECT 0, '0000000000000000000000000000000000000000000000000000000000000000',
                    encode(sha256(('0|0000000000000000000000000000000000000000000000000000000000000000|1700000000|[]|GENESIS|0|4|0')::bytea), 'hex'),
                    0, 'GENESIS', 0.00000000, 1700000000, 4, '[]'
                WHERE NOT EXISTS (SELECT 1 FROM blocks WHERE block_index = 0)"
            ];
            foreach ($statements as $stmt) {
                $db->query($stmt);
            }
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
