<?php
function jsonSuccess($data = []) {
    echo json_encode(array_merge(['success' => true], $data), JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError($message, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function getJsonInput() {
    // Try $_POST first (form-urlencoded, works everywhere)
    if (!empty($_POST)) return $_POST;
    // Try php://input for raw JSON body
    $raw = file_get_contents('php://input');
    if (!empty($raw)) {
        $data = json_decode($raw, true);
        if (is_array($data)) return $data;
        // If not JSON but has content, try parse_str
        parse_str($raw, $parsed);
        if (!empty($parsed)) return $parsed;
    }
    // Try reading from Vercel-specific sources
    $stdin = fopen('php://stdin', 'r');
    if ($stdin) {
        $raw2 = stream_get_contents($stdin);
        fclose($stdin);
        if (!empty($raw2)) {
            $data = json_decode($raw2, true);
            if (is_array($data)) return $data;
        }
    }
    return [];
}
