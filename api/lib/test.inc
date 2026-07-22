<?php
$raw = file_get_contents('php://input');
$headers = getallheaders();
echo json_encode([
    'method' => $_SERVER['REQUEST_METHOD'],
    'get' => $_GET,
    'post' => $_POST,
    'raw_input' => $raw,
    'content_type' => $_SERVER['CONTENT_TYPE'] ?? 'none',
    'headers' => $headers
], JSON_UNESCAPED_UNICODE);
