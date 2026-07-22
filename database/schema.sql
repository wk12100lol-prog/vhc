-- Vex Hack Coin (VHC) - Schema bazy danych MySQL
-- Wersja: 1.0.1

CREATE DATABASE IF NOT EXISTS vhc_blockchain
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE vhc_blockchain;

-- -----------------------------------------------------------
-- Tabela: users - uzytkownicy systemu
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    login VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(64) NOT NULL UNIQUE,
    balance DECIMAL(18, 8) NOT NULL DEFAULT 0.00000000,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wallet (wallet_address),
    INDEX idx_login (login)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
-- Tabela: sessions - sesje logowania
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
-- Tabela: blocks - lancuch blokow (blockchain)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS blocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    block_index INT NOT NULL UNIQUE,
    previous_hash VARCHAR(64) NOT NULL,
    current_hash VARCHAR(64) NOT NULL,
    nonce BIGINT NOT NULL,
    miner VARCHAR(64) NOT NULL,
    reward DECIMAL(18, 8) NOT NULL DEFAULT 1.00000000,
    timestamp INT NOT NULL,
    difficulty INT NOT NULL,
    transactions_json LONGTEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_block_index (block_index),
    INDEX idx_miner (miner),
    INDEX idx_hash (current_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
-- Tabela: transactions - transakcje
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender VARCHAR(64) NOT NULL,
    receiver VARCHAR(64) NOT NULL,
    amount DECIMAL(18, 8) NOT NULL,
    timestamp INT NOT NULL,
    block_id INT,
    FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE SET NULL,
    INDEX idx_sender (sender),
    INDEX idx_receiver (receiver),
    INDEX idx_block (block_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
-- Tabela: miners - koparki
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS miners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wallet VARCHAR(64) NOT NULL UNIQUE,
    hashrate DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45) DEFAULT NULL,
    INDEX idx_wallet (wallet)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
-- Tabela: pending_transactions - oczekujace transakcje
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS pending_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender VARCHAR(64) NOT NULL,
    receiver VARCHAR(64) NOT NULL,
    amount DECIMAL(18, 8) NOT NULL,
    timestamp INT NOT NULL,
    block_id INT DEFAULT NULL,
    status ENUM('pending', 'confirmed', 'rejected') NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sender (sender),
    INDEX idx_status (status),
    INDEX idx_block (block_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------
-- Blok genesis (pierwszy blok)
-- Uwaga: hash obliczony dla timestamp=1700000000
-- Jesli zmienisz timestamp, musisz tez zaktualizowac hash
-- oraz Blockchain::getGenesisData() w PHP
-- -----------------------------------------------------------
INSERT INTO blocks (block_index, previous_hash, current_hash, nonce, miner, reward, timestamp, difficulty, transactions_json)
VALUES (
    0,
    '0000000000000000000000000000000000000000000000000000000000000000',
    SHA2(CONCAT_WS('|', 0, '0000000000000000000000000000000000000000000000000000000000000000', 1700000000, '[]', 'GENESIS', 0, 4, 0), 256),
    0,
    'GENESIS',
    0.00000000,
    1700000000,
    4,
    '[]'
);

-- -----------------------------------------------------------
-- Tabela nagrod
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS rewards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    vhc_required DECIMAL(16,8) NOT NULL DEFAULT 0,
    stock INT NOT NULL DEFAULT 1,
    claimed INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reward_claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reward_id INT NOT NULL,
    wallet VARCHAR(66) NOT NULL,
    claimed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
