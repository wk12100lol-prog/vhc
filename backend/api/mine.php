<?php
// Vex Hack Coin (VHC) - API wydobycia (kopania)
// Wersja: 1.0.0

require_once __DIR__ . '/../database.php';
require_once __DIR__ . '/../blockchain.php';

$db = Database::getInstance();
$blockchain = new Blockchain();

$input = Database::getJsonInput();
$action = $input['action'] ?? '';

if (empty($action)) {
    Database::jsonError('Brak akcji (get_job lub submit_block)');
}

switch ($action) {

    // -------------------------------------------------------
    // Pobranie zadania wydobycia
    // -------------------------------------------------------
    case 'get_job':
        $wallet = trim($input['wallet'] ?? '');

        if (empty($wallet)) {
            Database::jsonError('Podaj adres portfela');
        }

        // Sprawdz czy portfel istnieje, jesli nie - utworz wpis
        $user = $db->fetchOne("SELECT id FROM users WHERE wallet_address = ?", [$wallet]);
        if (!$user) {
            // Automatyczne utworzenie konta dla gornika
            $db->insert(
                "INSERT INTO users (login, email, password_hash, wallet_address, balance, created_at)
                 VALUES (?, ?, ?, ?, 0, NOW())",
                ['miner_' . substr($wallet, 0, 8),
                 $wallet . '@vhc.miner',
                 hash('sha256', $wallet . time()),
                 $wallet,
                 0]
            );
        }

        $job = $blockchain->createMiningJob($wallet);

        Database::jsonSuccess([
            'job' => $job,
            'message' => 'Zadanie wydobycia pobrane'
        ]);
        break;

    // -------------------------------------------------------
    // Zgloszenie znalezionego bloku
    // -------------------------------------------------------
    case 'submit_block':
        $blockData = $input['block'] ?? [];

        if (empty($blockData)) {
            Database::jsonError('Brak danych bloku');
        }

        $result = $blockchain->submitBlock($blockData);

        echo json_encode($result, JSON_UNESCAPED_UNICODE);
        break;

    default:
        Database::jsonError('Nieznana akcja: ' . $action);
}
