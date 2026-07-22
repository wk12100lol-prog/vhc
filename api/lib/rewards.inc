<?php
require_once __DIR__ . '/database.inc';

$db = Database::getInstance();

// Auto-tworzenie tabel nagrod jesli nie istnieja
$db->query("CREATE TABLE IF NOT EXISTS rewards (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    vhc_required DECIMAL(16,8) NOT NULL DEFAULT 0,
    stock INT NOT NULL DEFAULT 1,
    claimed INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)");

$db->query("CREATE TABLE IF NOT EXISTS reward_claims (
    id SERIAL PRIMARY KEY,
    reward_id INT NOT NULL,
    wallet VARCHAR(66) NOT NULL,
    claimed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE
)");

$input = getJsonInput();
$action = $input['action'] ?? '';

if (empty($action)) {
    jsonError('Brak akcji');
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
        jsonSuccess(['rewards' => $rewards ?: []]);
        break;

    // -------------------------------------------------------
    // Admin: dodaj nagrode
    // -------------------------------------------------------
    case 'add':
        $password = $input['password'] ?? '';
        if ($password !== $admin_pass) {
            jsonError('Nieprawidlowe haslo');
        }

        $title = trim($input['title'] ?? '');
        $description = trim($input['description'] ?? '');
        $vhc_required = (float)($input['vhc_required'] ?? 0);
        $stock = (int)($input['stock'] ?? 1);

        if (empty($title) || $vhc_required <= 0 || $stock <= 0) {
            jsonError('Wypelnij wszystkie pola');
        }

        $db->insert(
            "INSERT INTO rewards (title, description, vhc_required, stock, claimed) VALUES (?, ?, ?, ?, 0)",
            [$title, $description, $vhc_required, $stock]
        );

        jsonSuccess(['message' => 'Nagroda dodana']);
        break;

    // -------------------------------------------------------
    // Admin: usun nagrode
    // -------------------------------------------------------
    case 'delete':
        $password = $input['password'] ?? '';
        if ($password !== $admin_pass) {
            jsonError('Nieprawidlowe haslo');
        }

        $id = (int)($input['id'] ?? 0);
        if ($id <= 0) {
            jsonError('Nieprawidlowe ID');
        }

        $db->query("DELETE FROM rewards WHERE id = ?", [$id]);
        jsonSuccess(['message' => 'Nagroda usunieta']);
        break;

    // -------------------------------------------------------
    // Admin: ustaw trudnosc
    // -------------------------------------------------------
    case 'set_difficulty':
        $password = $input['password'] ?? '';
        if ($password !== $admin_pass) {
            jsonError('Nieprawidlowe haslo');
        }

        $newDiff = (int)($input['difficulty'] ?? 0);
        if ($newDiff < MIN_DIFFICULTY || $newDiff > MAX_DIFFICULTY) {
            jsonError('Trudnosc musi byc miedzy ' . MIN_DIFFICULTY . ' a ' . MAX_DIFFICULTY);
        }

        // Zaktualizuj ostatni blok
        $db->query(
            "UPDATE blocks SET difficulty = ? WHERE block_index = (SELECT MAX(block_index) FROM blocks)",
            [$newDiff]
        );

        jsonSuccess(['message' => "Trudnosc ustawiona na $newDiff"]);
        break;

    // -------------------------------------------------------
    // Odbierz nagrode
    // -------------------------------------------------------
    case 'claim':
        $wallet = trim($input['wallet'] ?? '');
        $reward_id = (int)($input['reward_id'] ?? 0);

        if (empty($wallet) || $reward_id <= 0) {
            jsonError('Nieprawidlowe dane');
        }

        // Sprawdz czy nagroda istnieje i ma wolne sztuki
        $reward = $db->fetchOne(
            "SELECT * FROM rewards WHERE id = ? AND stock > claimed",
            [$reward_id]
        );
        if (!$reward) {
            jsonError('Nagroda niedostepna');
        }

        // Sprawdz czy uzytkownik ma wystarczajaco VHC
        $user = $db->fetchOne(
            "SELECT login, balance FROM users WHERE wallet_address = ?",
            [$wallet]
        );
        if (!$user) {
            jsonError('Portfel nie istnieje');
        }
        if ((float)$user['balance'] < (float)$reward['vhc_required']) {
            jsonError('Za malo VHC. Potrzebujesz ' . number_format((float)$reward['vhc_required'], 8) . ' VHC');
        }

        // Czy juz odbieral ta nagrode?
        $existing = $db->fetchOne(
            "SELECT id FROM reward_claims WHERE reward_id = ? AND wallet = ?",
            [$reward_id, $wallet]
        );
        if ($existing) {
            jsonError('Juz odebrales te nagrode');
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

        jsonSuccess([
            'message' => "Nagroda '{$reward['title']}' odebrana! Szczegoly wyslane na email."
        ]);
        break;

    default:
        jsonError('Nieznana akcja');
}
