<?php
// Vex Hack Coin (VHC) - API koparki (rejestracja, ping)
// Wersja: 1.0.0

require_once __DIR__ . '/database.php';

$db = Database::getInstance();

$input = Database::getJsonInput();
$action = $input['action'] ?? '';

if (empty($action)) {
    Database::jsonError('Brak akcji');
}

$wallet = trim($input['wallet'] ?? '');

switch ($action) {

    // -------------------------------------------------------
    // Rejestracja koparki
    // -------------------------------------------------------
    case 'register':
        if (empty($wallet)) {
            Database::jsonError('Podaj adres portfela');
        }

        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

        $existing = $db->fetchOne("SELECT id FROM miners WHERE wallet = ?", [$wallet]);

        if ($existing) {
            $db->query(
                "UPDATE miners SET last_seen = NOW(), ip_address = ? WHERE wallet = ?",
                [$ip, $wallet]
            );
        } else {
            $db->insert(
                "INSERT INTO miners (wallet, hashrate, last_seen, ip_address)
                 VALUES (?, 0, NOW(), ?)",
                [$wallet, $ip]
            );
        }

        Database::jsonSuccess([
            'message' => 'Koparka zarejestrowana',
            'wallet' => $wallet
        ]);
        break;

    // -------------------------------------------------------
    // Ping koparki (keepalive + hashrate)
    // -------------------------------------------------------
    case 'ping':
        if (empty($wallet)) {
            Database::jsonError('Podaj adres portfela');
        }

        $hashrate = (float)($input['hashrate'] ?? 0);
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

        $db->query(
            "UPDATE miners SET last_seen = NOW(), hashrate = ?, ip_address = ? WHERE wallet = ?",
            [$hashrate, $ip, $wallet]
        );

        Database::jsonSuccess([
            'message' => 'Ping odebrany',
            'wallet' => $wallet,
            'hashrate' => $hashrate
        ]);
        break;

    // -------------------------------------------------------
    // Lista aktywnych koparek
    // -------------------------------------------------------
    case 'list':
        $miners = $db->fetchAll(
            "SELECT wallet, hashrate, last_seen FROM miners WHERE last_seen >= DATE_SUB(NOW(), INTERVAL 1 HOUR) ORDER BY hashrate DESC LIMIT 50"
        );

        Database::jsonSuccess([
            'miners' => $miners,
            'count' => count($miners)
        ]);
        break;

    default:
        Database::jsonError('Nieznana akcja: ' . $action);
}
