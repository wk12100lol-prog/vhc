-- Vex Hack Coin (VHC) - Schema PostgreSQL (Neon)
-- Wersja: 2.0.0

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    login VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(64) NOT NULL UNIQUE,
    balance DECIMAL(18, 8) NOT NULL DEFAULT 0.00000000,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);

CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS blocks (
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
);
CREATE INDEX IF NOT EXISTS idx_blocks_index ON blocks(block_index);
CREATE INDEX IF NOT EXISTS idx_blocks_miner ON blocks(miner);
CREATE INDEX IF NOT EXISTS idx_blocks_hash ON blocks(current_hash);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    sender VARCHAR(64) NOT NULL,
    receiver VARCHAR(64) NOT NULL,
    amount DECIMAL(18, 8) NOT NULL,
    timestamp INT NOT NULL,
    block_id INT REFERENCES blocks(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_sender ON transactions(sender);
CREATE INDEX IF NOT EXISTS idx_tx_receiver ON transactions(receiver);
CREATE INDEX IF NOT EXISTS idx_tx_block ON transactions(block_id);

CREATE TABLE IF NOT EXISTS miners (
    id SERIAL PRIMARY KEY,
    wallet VARCHAR(64) NOT NULL UNIQUE,
    hashrate DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45) DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_miners_wallet ON miners(wallet);

CREATE TABLE IF NOT EXISTS pending_transactions (
    id SERIAL PRIMARY KEY,
    sender VARCHAR(64) NOT NULL,
    receiver VARCHAR(64) NOT NULL,
    amount DECIMAL(18, 8) NOT NULL,
    timestamp INT NOT NULL,
    block_id INT DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ptx_sender ON pending_transactions(sender);
CREATE INDEX IF NOT EXISTS idx_ptx_status ON pending_transactions(status);
CREATE INDEX IF NOT EXISTS idx_ptx_block ON pending_transactions(block_id);

CREATE TABLE IF NOT EXISTS rewards (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    vhc_required DECIMAL(16,8) NOT NULL DEFAULT 0,
    stock INT NOT NULL DEFAULT 1,
    claimed INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reward_claims (
    id SERIAL PRIMARY KEY,
    reward_id INT NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
    wallet VARCHAR(66) NOT NULL,
    claimed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Genesis block
INSERT INTO blocks (block_index, previous_hash, current_hash, nonce, miner, reward, timestamp, difficulty, transactions_json)
SELECT 0, '0000000000000000000000000000000000000000000000000000000000000000',
    encode(sha256(('0|0000000000000000000000000000000000000000000000000000000000000000|1700000000|[]|GENESIS|0|4|0')::bytea), 'hex'),
    0, 'GENESIS', 0.00000000, 1700000000, 4, '[]'
WHERE NOT EXISTS (SELECT 1 FROM blocks WHERE block_index = 0);
