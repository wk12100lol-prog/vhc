<?php
require_once __DIR__ . '/database.php';

$db = Database::getInstance();

// Auto-tworzenie tabel nagrod jesli nie istnieja
$db->query("CREATE TABLE IF NOT EXISTS rewards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    vhc_required DECIMAL(16,8) NOT NULL DEFAULT 0,
    stock INT NOT NULL DEFAULT 1,
    claimed INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$db->query("CREATE TABLE IF NOT EXISTS reward_claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reward_id INT NOT NULL,
    wallet VARCHAR(66) NOT NULL,
    claimed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$input = Database::getJsonInput();
$action = $input['action'] ?? '';

if (empty($action)) {
    Database::jsonError('Brak akcji');
}

$admin_pass = 'vexhack121koko9a';

switch ($action) {

    // -------------------------------------------------------
    // Lista dostepnych nagrod
    // -------------------------------------------------------
    case 'list':
        $rewards = $db->fetchAll(
            "SELECT * FROM rewards WHERE stock > claimed ORDER BY vhc_required ASC"
        );
        Database::jsonSuccess(['rewards' => $rewards ?: []]);
        break;

    // -------------------------------------------------------
    // Admin: dodaj nagrode
    // -------------------------------------------------------
    case 'add':
        $password = $input['password'] ?? '';
        if ($password !== $admin_pass) {
            Database::jsonError('Nieprawidlowe haslo');
        }

        $title = trim($input['title'] ?? '');
        $description = trim($input['description'] ?? '');
        $vhc_required = (float)($input['vhc_required'] ?? 0);
        $stock = (int)($input['stock'] ?? 1);

        if (empty($title) || $vhc_required <= 0 || $stock <= 0) {
            Database::jsonError('Wypelnij wszystkie pola');
        }

        $db->insert(
            "INSERT INTO rewards (title, description, vhc_required, stock, claimed) VALUES (?, ?, ?, ?, 0)",
            [$title, $description, $vhc_required, $stock]
        );

        Database::jsonSuccess(['message' => 'Nagroda dodana']);
        break;

    // -------------------------------------------------------
    // Admin: usun nagrode
    // -------------------------------------------------------
    case 'delete':
        $password = $input['password'] ?? '';
        if ($password !== $admin_pass) {
            Database::jsonError('Nieprawidlowe haslo');
        }

        $id = (int)($input['id'] ?? 0);
        if ($id <= 0) {
            Database::jsonError('Nieprawidlowe ID');
        }

        $db->query("DELETE FROM rewards WHERE id = ?", [$id]);
        Database::jsonSuccess(['message' => 'Nagroda usunieta']);
        break;

    // -------------------------------------------------------
    // Admin: ustaw trudnosc
    // -------------------------------------------------------
    case 'set_difficulty':
        $password = $input['password'] ?? '';
        if ($password !== $admin_pass) {
            Database::jsonError('Nieprawidlowe haslo');
        }

        $newDiff = (int)($input['difficulty'] ?? 0);
        if ($newDiff < MIN_DIFFICULTY || $newDiff > MAX_DIFFICULTY) {
            Database::jsonError('Trudnosc musi byc miedzy ' . MIN_DIFFICULTY . ' a ' . MAX_DIFFICULTY);
        }

        // Zaktualizuj ostatni blok
        $db->query(
            "UPDATE blocks SET difficulty = ? WHERE block_index = (SELECT MAX(block_index) FROM blocks)",
            [$newDiff]
        );

        Database::jsonSuccess(['message' => "Trudnosc ustawiona na $newDiff"]);
        break;

    // -------------------------------------------------------
    // Odbierz nagrode
    // -------------------------------------------------------
    case 'claim':
        $wallet = trim($input['wallet'] ?? '');
        $reward_id = (int)($input['reward_id'] ?? 0);

        if (empty($wallet) || $reward_id <= 0) {
            Database::jsonError('Nieprawidlowe dane');
        }

        // Sprawdz czy nagroda istnieje i ma wolne sztuki
        $reward = $db->fetchOne(
            "SELECT * FROM rewards WHERE id = ? AND stock > claimed",
            [$reward_id]
        );
        if (!$reward) {
            Database::jsonError('Nagroda niedostepna');
        }

        // Sprawdz czy uzytkownik ma wystarczajaco VHC
        $user = $db->fetchOne(
            "SELECT login, balance FROM users WHERE wallet_address = ?",
            [$wallet]
        );
        if (!$user) {
            Database::jsonError('Portfel nie istnieje');
        }
        if ((float)$user['balance'] < (float)$reward['vhc_required']) {
            Database::jsonError('Za malo VHC. Potrzebujesz ' . number_format((float)$reward['vhc_required'], 8) . ' VHC');
        }

        // Czy juz odbieral ta nagrode?
        $existing = $db->fetchOne(
            "SELECT id FROM reward_claims WHERE reward_id = ? AND wallet = ?",
            [$reward_id, $wallet]
        );
        if ($existing) {
            Database::jsonError('Juz odebrales te nagrode');
        }

        // Odejmij VHC
        $db->query(
            "UPDATE users SET balance = balance - ? WHERE wallet_address = ?",
            [$reward['vhc_required'], $wallet]
        );

        // Zapisz claim
        $db->insert(
            "INSERT INTO reward_claims (reward_id, wallet, claimed_at) VALUES (?, ?, NOW())",
            [$reward_id, $wallet]
        );

        // Inkrementuj licznik
        $db->query(
            "UPDATE rewards SET claimed = claimed + 1 WHERE id = ?",
            [$reward_id]
        );

        // Wyslij email
        $to = 'wk1210000@gmail.com';
        $subject = "VHC - {$user['login']} odebral nagrode: {$reward['title']}";
        $message = "Nick: {$user['login']}\n\n"
                 . "Odebral nagrode: {$reward['title']}\n"
                 . "Opis: {$reward['description']}\n"
                 . "Portfel: $wallet\n"
                 . "Koszt: {$reward['vhc_required']} VHC\n"
                 . "Czas: " . date('Y-m-d H:i:s');
        $headers = 'From: nagroda@vexcoin.xo.je' . "\r\n" .
                   'Reply-To: wk1210000@gmail.com' . "\r\n" .
                   'X-Mailer: PHP/' . phpversion();

        @mail($to, $subject, $message, $headers);

        Database::jsonSuccess([
            'message' => "Nagroda '{$reward['title']}' odebrana! Szczegoly wyslane na email."
        ]);
        break;

    default:
        Database::jsonError('Nieznana akcja');
}
