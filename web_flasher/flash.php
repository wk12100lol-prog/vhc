<?php
header('Content-Type: application/json');

$firmwarePath = __DIR__ . '/firmware/firmware.bin';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // --- Generowanie niestandardowego firmware ---
    $ssid    = trim($_POST['ssid'] ?? '');
    $pass    = trim($_POST['pass'] ?? '');
    $wallet  = trim($_POST['wallet'] ?? '');

    if (!$ssid || !$wallet) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'SSID i portfel sa wymagane']);
        exit;
    }

    // Sprawdz dlugosci (wartosc + null musi zmiescic sie w miejscu placeholdera)
    if (strlen($ssid) > 32)   { http_response_code(400); echo json_encode(['success'=>false,'error'=>'SSID max 32 znaki']); exit; }
    if (strlen($pass) > 63)   { http_response_code(400); echo json_encode(['success'=>false,'error'=>'Haslo max 63 znaki']); exit; }
    if (strlen($wallet) > 35) { http_response_code(400); echo json_encode(['success'=>false,'error'=>'Portfel max 35 znakow']); exit; }

    if (!file_exists($firmwarePath)) {
        http_response_code(500);
        echo json_encode(['success'=>false,'error'=>'Brak pliku firmware.bin']);
        exit;
    }

    // Wczytaj firmware
    $data = file_get_contents($firmwarePath);
    if ($data === false) {
        http_response_code(500);
        echo json_encode(['success'=>false,'error'=>'Nie mozna odczytac firmware.bin']);
        exit;
    }

    // Znajdz i zastepuj placeholdery (32 + 63 + 35 B z null)
    $patterns = [
        'S_______________________________' => $ssid,
        'P______________________________________________________________' => $pass,
        'W__________________________________' => $wallet,
    ];

    foreach ($patterns as $old => $new) {
        $pos = strpos($data, $old . "\0");  // szukaj z nullem
        if ($pos === false) {
            http_response_code(500);
            echo json_encode(['success'=>false, 'error'=>"Nie znaleziono placeholder-a: $old"]);
            exit;
        }
        $oldLen = strlen($old) + 1;  // +1 za null
        $newLen = strlen($new) + 1;
        if ($newLen > $oldLen) {
            http_response_code(400);
            echo json_encode(['success'=>false, 'error'=>"Nowa wartosc za dluga dla pola: $old"]);
            exit;
        }
        // Zastap dane
        $data = substr_replace($data, str_pad($new, $oldLen, "\0"), $pos, $oldLen);
    }

    // Zwroc zmodyfikowany firmware jako binarny download
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="vhc_miner.bin"');
    header('Content-Length: ' . strlen($data));
    echo $data;
    exit;
}

// --- GET: informacje o firmware ---
if (!file_exists($firmwarePath)) {
    http_response_code(500);
    echo json_encode(['success'=>false, 'error'=>'Brak firmware.bin']);
    exit;
}

$info = [
    'success' => true,
    'firmware_size' => filesize($firmwarePath),
    'firmware_date' => date('Y-m-d H:i:s', filemtime($firmwarePath)),
    'firmware_name' => 'vhc_miner.bin',
    'fields' => [
        ['name' => 'ssid',   'label' => 'Nazwa WiFi (SSID)', 'maxlength' => 32, 'placeholder' => 'Nazwa Twojej sieci WiFi'],
        ['name' => 'pass',   'label' => 'Haslo WiFi',        'maxlength' => 63, 'placeholder' => 'Haslo do sieci WiFi'],
        ['name' => 'wallet', 'label' => 'Adres portfela VHC', 'maxlength' => 35, 'placeholder' => 'Adres portfela VHC...'],
    ],
];

echo json_encode($info);
