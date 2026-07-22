<?php
// Vex Hack Coin (VHC) - Glowna klasa blockchain
// Wersja: 1.0.1

require_once __DIR__ . '/database.inc';

class Blockchain {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    // -------------------------------------------------------
    // Metody pomocnicze
    // -------------------------------------------------------

    public static function calculateHash($index, $prevHash, $timestamp, $transactionsJson, $miner, $reward, $difficulty, $nonce) {
        $header = $index . '|' . $prevHash . '|' . $timestamp . '|' . $transactionsJson . '|' . $miner . '|' . $reward . '|' . $difficulty . '|' . $nonce;
        return hash('sha256', $header);
    }

    public static function isValidHash($hash, $difficulty) {
        if ($difficulty <= 0) return true;
        $prefix = str_repeat('0', $difficulty);
        return strpos($hash, $prefix) === 0;
    }

    public static function generateWalletAddress($prefix = 'VHC') {
        $random = bin2hex(random_bytes(16));
        $hash = hash('sha256', $prefix . $random . time());
        return $prefix . substr($hash, 0, 32);
    }

    // -------------------------------------------------------
    // Blok genesis
    // -------------------------------------------------------

    public static function getGenesisData() {
        // Staly timestamp bloku genesis - zgodny z schema.sql
        $timestamp = 1700000000;
        $hash = self::calculateHash(0, GENESIS_PREV_HASH, $timestamp, '[]', 'GENESIS', 0, MIN_DIFFICULTY, 0);
        return [
            'block_index' => 0,
            'previous_hash' => GENESIS_PREV_HASH,
            'current_hash' => $hash,
            'nonce' => 0,
            'miner' => 'GENESIS',
            'reward' => 0,
            'timestamp' => $timestamp,
            'difficulty' => MIN_DIFFICULTY,
            'transactions_json' => '[]',
            'transactions' => []
        ];
    }

    public function getGenesisBlock() {
        // Pobierz z BD, jesli istnieje, inaczej zwroc dane statyczne
        $block = $this->db->fetchOne("SELECT * FROM blocks WHERE block_index = 0 LIMIT 1");
        if ($block) {
            $block['transactions'] = $block['transactions_json'] ? json_decode($block['transactions_json'], true) : [];
            return $block;
        }
        return self::getGenesisData();
    }

    // -------------------------------------------------------
    // Pobieranie blokow
    // -------------------------------------------------------

    public function getLatestBlock() {
        $block = $this->db->fetchOne("SELECT * FROM blocks ORDER BY block_index DESC LIMIT 1");
        if (!$block) {
            return $this->getGenesisBlock();
        }
        if ($block['transactions_json']) {
            $block['transactions'] = json_decode($block['transactions_json'], true) ?: [];
        } else {
            $block['transactions'] = [];
        }
        return $block;
    }

    public function getBlockByIndex($index) {
        $block = $this->db->fetchOne("SELECT * FROM blocks WHERE block_index = ?", [$index]);
        if (!$block) return null;
        if ($block['transactions_json']) {
            $block['transactions'] = json_decode($block['transactions_json'], true) ?: [];
        } else {
            $block['transactions'] = [];
        }
        return $block;
    }

    public function getBlocks($limit = 20, $offset = 0) {
        $blocks = $this->db->fetchAll(
            "SELECT * FROM blocks ORDER BY block_index DESC LIMIT ? OFFSET ?",
            [$limit, $offset]
        );
        foreach ($blocks as &$block) {
            if ($block['transactions_json']) {
                $block['transactions'] = json_decode($block['transactions_json'], true) ?: [];
            } else {
                $block['transactions'] = [];
            }
        }
        return $blocks;
    }

    public function getBlockCount() {
        $row = $this->db->fetchOne("SELECT COUNT(*) as count FROM blocks");
        return $row ? (int)$row['count'] : 0;
    }

    // -------------------------------------------------------
    // Trudnosc
    // -------------------------------------------------------

    public function getCurrentDifficulty() {
        $block = $this->getLatestBlock();
        return (int)($block['difficulty'] ?? MIN_DIFFICULTY);
    }

    public function calculateNewDifficulty() {
        $count = $this->getBlockCount();

        if ($count < DIFFICULTY_ADJUST_INTERVAL) {
            return max(MIN_DIFFICULTY, $this->getCurrentDifficulty());
        }

        $blocks = $this->db->fetchAll(
            "SELECT block_index, timestamp FROM blocks ORDER BY block_index DESC LIMIT ?",
            [DIFFICULTY_ADJUST_INTERVAL + 1]
        );

        if (count($blocks) < DIFFICULTY_ADJUST_INTERVAL + 1) {
            return max(MIN_DIFFICULTY, $this->getCurrentDifficulty());
        }

        $oldest = end($blocks);
        $newest = reset($blocks);

        $timeDiff = $newest['timestamp'] - $oldest['timestamp'];

        // Sredni czas bloku
        $avgBlockTime = $timeDiff / DIFFICULTY_ADJUST_INTERVAL;

        $currentDiff = $this->getCurrentDifficulty();

        // Zwiekszaj trudnosc tylko jesli bloki leca szybciej niz 5s (bardzo mocny PC)
        if ($avgBlockTime < 5) {
            return min($currentDiff + 1, MAX_DIFFICULTY);
        }

        // Zmniejszaj tylko jesli bloki leca wolniej niz 5 min (zniknely mocne koparki)
        if ($avgBlockTime > 300) {
            return max($currentDiff - 1, MIN_DIFFICULTY);
        }

        return max($currentDiff, MIN_DIFFICULTY);
    }

    // -------------------------------------------------------
    // Transakcje
    // -------------------------------------------------------

    public function getPendingTransactions() {
        return $this->db->fetchAll(
            "SELECT * FROM pending_transactions WHERE status = 'pending' ORDER BY timestamp ASC"
        );
    }

    public function addPendingTransaction($sender, $receiver, $amount) {
        if ($amount <= 0) {
            jsonError('Kwota musi byc wieksza od 0');
        }

        if ($sender === $receiver) {
            jsonError('Nie mozesz wyslac monet do samego siebie');
        }

        // Sprawdzenie salda
        $senderData = $this->db->fetchOne(
            "SELECT balance FROM users WHERE wallet_address = ?",
            [$sender]
        );
        if (!$senderData) {
            jsonError('Adres nadawcy nie istnieje');
        }
        if ($senderData['balance'] < $amount) {
            jsonError('Niewystarczajace saldo');
        }

        $timestamp = time();

        $this->db->insert(
            "INSERT INTO pending_transactions (sender, receiver, amount, timestamp, status)
             VALUES (?, ?, ?, ?, 'pending')",
            [$sender, $receiver, $amount, $timestamp]
        );

        return true;
    }

    // -------------------------------------------------------
    // Wydobycie (kopanie)
    // -------------------------------------------------------

    public function createMiningJob($wallet) {
        $latestBlock = $this->getLatestBlock();
        $difficulty = $this->calculateNewDifficulty();
        $pendingTxs = $this->getPendingTransactions();

        // Ogranicz liczba transakcji w bloku
        $txs = array_slice($pendingTxs, 0, 50);
        $nextIndex = $latestBlock['block_index'] + 1;

        // Dodaj transakcje coinbase (nagroda za blok)
        $coinbaseTx = [
            'type' => 'coinbase',
            'sender' => 'SYSTEM',
            'receiver' => $wallet,
            'amount' => BLOCK_REWARD,
            'timestamp' => time()
        ];
        array_unshift($txs, $coinbaseTx);

        $reward = BLOCK_REWARD;

        return [
            'block_index' => $nextIndex,
            'previous_hash' => $latestBlock['current_hash'],
            'transactions' => $txs,
            'miner' => $wallet,
            'reward' => $reward,
            'difficulty' => $difficulty,
            'timestamp' => time()
        ];
    }

    public function submitBlock($blockData) {
        // -------------------------------------------------------
        // Walidacja bloku
        // -------------------------------------------------------

        $required = ['block_index', 'previous_hash', 'transactions', 'miner', 'reward', 'difficulty', 'nonce', 'hash'];
        foreach ($required as $field) {
            if (!isset($blockData[$field])) {
                jsonError("Brakujace pole: $field");
            }
        }

        $blockIndex = (int)$blockData['block_index'];
        $prevHash = $blockData['previous_hash'];
        $transactions = $blockData['transactions'];
        $miner = $blockData['miner'];
        $reward = (float)$blockData['reward'];
        $difficulty = (int)$blockData['difficulty'];
        $nonce = (int)$blockData['nonce'];
        $submittedHash = $blockData['hash'];
        $timestamp = isset($blockData['timestamp']) ? (int)$blockData['timestamp'] : time();

        // 1. Sprawdzenie czy blok o takim indeksie juz istnieje
        $existing = $this->getBlockByIndex($blockIndex);
        if ($existing) {
            jsonError("Blok #$blockIndex juz istnieje w lancuchu");
        }

        // 2. Sprawdzenie poprzedniego hasha
        $latestBlock = $this->getLatestBlock();
        if ($latestBlock['current_hash'] !== $prevHash) {
            jsonError('Nieprawidlowy hash poprzedniego bloku. Otrzymano: ' . $prevHash . ', oczekiwano: ' . $latestBlock['current_hash']);
        }

        // 3. Sprawdzenie indeksu
        $expectedIndex = $latestBlock['block_index'] + 1;
        if ($blockIndex !== $expectedIndex) {
            jsonError("Nieprawidlowy indeks bloku. Otrzymano: $blockIndex, oczekiwano: $expectedIndex");
        }

        // 4. Sprawdzenie czy reward jest prawidlowy
        if ($reward != BLOCK_REWARD) {
            jsonError("Nieprawidlowa nagroda. Otrzymano: $reward, oczekiwano: " . BLOCK_REWARD);
        }

        // 5. Sprawdzenie trudnosci
        $expectedDifficulty = $this->calculateNewDifficulty();
        if ($difficulty !== $expectedDifficulty) {
            // Dopuszczamy roznice +/- 1 ze wzgledu na race condition
            $currentDiff = $this->getCurrentDifficulty();
            if ($difficulty !== $currentDiff && $difficulty !== $currentDiff + 1 && $difficulty !== max($currentDiff - 1, MIN_DIFFICULTY)) {
                jsonError("Nieprawidlowa trudnosc. Otrzymano: $difficulty, oczekiwano: $expectedDifficulty (lub $currentDiff)");
            }
        }

        // 6. Weryfikacja hasha
        $txsJson = json_encode($transactions, JSON_UNESCAPED_UNICODE);
        $calculatedHash = self::calculateHash($blockIndex, $prevHash, $timestamp, $txsJson, $miner, $reward, $difficulty, $nonce);

        if ($calculatedHash !== $submittedHash) {
            jsonError("Nieprawidlowy hash bloku. Obliczony: $calculatedHash, otrzymany: $submittedHash");
        }

        // 7. Sprawdzenie czy hash spelnia wymagania trudnosci
        if (!self::isValidHash($submittedHash, $difficulty)) {
            jsonError("Hash bloku nie spelnia wymagania trudnosci ($difficulty zer)");
        }

        // 8. Walidacja transakcji
        $coinbaseCount = 0;
        $processedAmounts = [];   // laczna kwota wyslana przez kazdego nadawce
        $txIdsToConfirm = [];     // ID transakcji pending do potwierdzenia

        foreach ($transactions as $i => $tx) {
            if (!isset($tx['sender'], $tx['receiver'], $tx['amount'])) {
                jsonError("Nieprawidlowa struktura transakcji na pozycji $i");
            }

            if ($tx['sender'] === 'SYSTEM') {
                // Transakcja coinbase - nagroda za blok
                $coinbaseCount++;
                if ($coinbaseCount > 1) {
                    jsonError('Blok moze zawierac tylko jedna transakcje coinbase');
                }
                if ($tx['receiver'] !== $miner) {
                    jsonError('Transakcja coinbase musi byc przypisana do gornika');
                }
                if ((float)$tx['amount'] != $reward) {
                    jsonError('Nieprawidlowa kwota nagrody w transakcji coinbase');
                }
            } else {
                // Zwykla transakcja
                $sender = $tx['sender'];
                $amount = (float)$tx['amount'];

                if (!isset($processedAmounts[$sender])) {
                    $processedAmounts[$sender] = 0;
                }
                $processedAmounts[$sender] += $amount;

                // Sprawdz czy nadawca istnieje i ma wystarczajace saldo (lacznie ze wszystkimi tx w tym bloku)
                $senderData = $this->db->fetchOne(
                    "SELECT balance FROM users WHERE wallet_address = ?",
                    [$sender]
                );
                if (!$senderData) {
                    jsonError("Nadawca nie istnieje: " . $sender);
                }
                if ($senderData['balance'] < $processedAmounts[$sender]) {
                    jsonError("Niewystarczajace saldo nadawcy $sender. Posiada: {$senderData['balance']}, potrzebuje: {$processedAmounts[$sender]}");
                }

                // Sprawdz czy transakcja istnieje w pending_transactions i nie zostala juz potwierdzona
                $pendingTx = $this->db->fetchOne(
                    "SELECT id FROM pending_transactions WHERE sender = ? AND receiver = ? AND amount = ? AND status = 'pending' ORDER BY id ASC LIMIT 1",
                    [$sender, $tx['receiver'], $amount]
                );
                if (!$pendingTx) {
                    jsonError("Nie znaleziono oczekujacej transakcji: $sender -> {$tx['receiver']} ($amount VHC)");
                }
                $txIdsToConfirm[] = (int)$pendingTx['id'];
            }
        }

        // Upewnij sie, ze jest dokladnie jedna coinbase
        if ($coinbaseCount !== 1) {
            jsonError('Blok musi zawierac dokladnie jedna transakcje coinbase');
        }

        // -------------------------------------------------------
        // Zapis bloku i aktualizacja stanu
        // -------------------------------------------------------

        $this->db->beginTransaction();

        try {
            // Zapis bloku - bypass insert() to avoid any RETURNING/fetch issues
            $this->db->query(
                "INSERT INTO blocks (block_index, previous_hash, current_hash, nonce, miner, reward, timestamp, difficulty, transactions_json, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
                [$blockIndex, $prevHash, $submittedHash, $nonce, $miner, $reward, $timestamp, $difficulty, $txsJson]
            );
            // Use direct PDO lastInsertId for PostgreSQL
            $blockId = $this->db->getPdo()->lastInsertId('blocks_id_seq');
            $debug = "block_ok=$blockId";

            // Przetwarzanie transakcji
            $txIndex = 0;
            foreach ($transactions as $tx) {
                $debug .= "|tx{$txIndex}";
                if ($tx['sender'] === 'SYSTEM') {
                    // Coinbase - dodaj nagrode gornikowi
                    $debug .= "|u1";
                    $this->db->query(
                        "UPDATE users SET balance = balance + ? WHERE wallet_address = ?",
                        [$tx['amount'], $tx['receiver']]
                    );
                    $debug .= "|u1ok";
                    // Jesli gornik nie ma konta, utworz z losowym hash-em hasla
                    $minerUser = $this->db->fetchOne(
                        "SELECT id FROM users WHERE wallet_address = ?", [$tx['receiver']]
                    );
                    $debug .= "|sel=" . ($minerUser ? $minerUser['id'] : '0');
                    if (!$minerUser) {
                        $randomLogin = 'miner_' . substr(hash('sha256', $tx['receiver']), 0, 10);
                        $randomPass = hash('sha256', $tx['receiver'] . bin2hex(random_bytes(8)));
                        $debug .= "|insuser";
                        $this->db->insert(
                            "INSERT INTO users (login, email, password_hash, wallet_address, balance, created_at)
                             VALUES (?, ?, ?, ?, ?, NOW())",
                            [$randomLogin,
                             $randomLogin . '@vhc.miner',
                             password_hash($randomPass, PASSWORD_BCRYPT),
                             $tx['receiver'],
                             $tx['amount']]
                        );
                    }
                } else {
                    // Zwykla transakcja - aktualizuj salda
                    $this->db->query(
                        "UPDATE users SET balance = balance - ? WHERE wallet_address = ?",
                        [$tx['amount'], $tx['sender']]
                    );
                    $this->db->query(
                        "UPDATE users SET balance = balance + ? WHERE wallet_address = ?",
                        [$tx['amount'], $tx['receiver']]
                    );

                    // Oznacz konkretna transakcje pending jako potwierdzona
                    if (isset($txIdsToConfirm[$txIndex])) {
                        $this->db->query(
                            "UPDATE pending_transactions SET status = 'confirmed', block_id = ? WHERE id = ? AND status = 'pending'",
                            [$blockId, $txIdsToConfirm[$txIndex]]
                        );
                    }
                }

                // Zapis do historii transakcji
                $debug .= "|ins_tx";
                $this->db->query(
                    "INSERT INTO transactions (sender, receiver, amount, timestamp, block_id)
                     VALUES (?, ?, ?, ?, ?)",
                    [$tx['sender'], $tx['receiver'], $tx['amount'], $tx['timestamp'] ?? time(), $blockId]
                );
                $debug .= "|ins_tx_ok";

                $txIndex++;
            }

            $debug .= "|commit";
            $this->db->commit();

            return [
                'success' => true,
                'message' => 'Blok #' . $blockIndex . ' zostal dodany do lancucha',
                'block' => [
                    'block_index' => $blockIndex,
                    'hash' => $submittedHash,
                    'reward' => $reward,
                    'difficulty' => $difficulty
                ]
            ];

        } catch (Exception $e) {
            $msg = $e->getMessage();
            $code = $e->getCode();
            $prev = $e->getPrevious();
            $prevMsg = $prev ? ' | PREV: ' . $prev->getMessage() : '';
            $errDetail = "EX:{$msg} (code:{$code}){$prevMsg}";
            if (isset($debug)) $errDetail .= " | " . $debug;
            try { $this->db->rollback(); } catch (Exception $rb) { $errDetail .= ' | RBERR:' . $rb->getMessage(); }
            jsonError('Blad podczas zapisu bloku: ' . $errDetail);
        }
    }

    // -------------------------------------------------------
    // Statystyki blockchain
    // -------------------------------------------------------

    public function getBlockchainInfo() {
        $blockCount = $this->getBlockCount();

        $txCount = $this->db->fetchOne("SELECT COUNT(*) as count FROM transactions");
        $txCount = $txCount ? (int)$txCount['count'] : 0;

        $totalSupply = $this->db->fetchOne("SELECT COALESCE(SUM(reward), 0) as total FROM blocks");
        $totalSupply = $totalSupply ? (float)$totalSupply['total'] : 0;

        $latestBlock = $this->getLatestBlock();
        $difficulty = $this->getCurrentDifficulty();
        $nextDifficulty = $this->calculateNewDifficulty();

        $activeMiners = $this->db->fetchOne(
            "SELECT COUNT(*) as count FROM miners WHERE last_seen >= NOW() - INTERVAL '1 HOUR'"
        );
        $activeMiners = $activeMiners ? (int)$activeMiners['count'] : 0;

        $lastHourBlocks = $this->db->fetchOne(
            "SELECT COUNT(*) as count FROM blocks WHERE created_at >= NOW() - INTERVAL '1 HOUR'"
        );
        $lastHourBlocks = $lastHourBlocks ? (int)$lastHourBlocks['count'] : 0;

        return [
            'success' => true,
            'data' => [
                'block_count' => $blockCount,
                'transaction_count' => $txCount,
                'total_supply' => $totalSupply,
                'current_difficulty' => $difficulty,
                'next_difficulty' => $nextDifficulty,
                'latest_block' => $latestBlock,
                'active_miners' => $activeMiners,
                'blocks_last_hour' => $lastHourBlocks,
                'target_block_time' => TARGET_BLOCK_TIME,
                'block_reward' => BLOCK_REWARD
            ]
        ];
    }
}

// Okresl akcje - z index.php ($action) lub z URL (bezposrednie wywolanie)
if (!isset($action)) {
    $action = $_GET['action'] ?? $_POST['action'] ?? '';
    if (empty($action)) {
        $input = getJsonInput();
        $action = $input['action'] ?? '';
    }
}

$bchain = new Blockchain();
switch ($action) {
    case 'info':
    case 'blockchain':
        $result = $bchain->getBlockchainInfo();
        echo json_encode($result, JSON_UNESCAPED_UNICODE);
        break;
    case 'blocks':
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        $blocks = $bchain->getBlocks($limit, $offset);
        echo json_encode(['success' => true, 'blocks' => $blocks], JSON_UNESCAPED_UNICODE);
        break;
    default:
        // Bezposrednie wywolanie pliku z nieznana akcja
        if ((basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? ''))) {
            jsonError('Nieznana akcja: ' . ($action ?? ''));
        }
}
