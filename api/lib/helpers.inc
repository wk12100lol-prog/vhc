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
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    if ($data !== null && is_array($data)) return $data;
    if (!empty($_POST)) return $_POST;
    return [];
}
