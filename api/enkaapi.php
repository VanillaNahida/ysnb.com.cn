<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$uid = isset($_GET['uid']) ? $_GET['uid'] : '';
$source = isset($_GET['source']) ? $_GET['source'] : 'enka';

if (empty($uid) || !ctype_digit($uid)) {
    http_response_code(400);
    echo json_encode(['error' => 'UID must be pure digits only']);
    exit;
}

$urls = [
    'enka' => 'https://enka.network/api/uid/' . $uid,
    'microgg' => 'https://profile.microgg.cn/api/uid/' . $uid,
    'mys' => 'http://127.0.0.1:3051/genshin/role-level'
];

$source = isset($urls[$source]) ? $source : 'enka';

if ($source === 'mys') {
    // mys API 使用 POST 请求
    $postData = json_encode(['uid' => $uid]);
    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'timeout' => 20,
            'header' => "Content-Type: application/json\r\nAccept: application/json\r\n",
            'content' => $postData
        ]
    ]);

    $result = @file_get_contents($urls['mys'], false, $ctx);

    if ($result === false) {
        http_response_code(502);
        echo json_encode(['error' => 'Failed to fetch data from mys API']);
        exit;
    }

    $data = json_decode($result, true);
    if (!$data || (isset($data['retcode']) && $data['retcode'] !== 0)) {
        http_response_code(502);
        echo json_encode(['error' => isset($data['retcode']) ? 'mys API error: retcode ' . $data['retcode'] : 'Invalid response from mys API']);
        exit;
    }

    // 将 mys API 返回格式转换为 enka 格式
    echo json_encode([
        'playerInfo' => [
            'nickname' => isset($data['nickname']) ? $data['nickname'] : '',
            'level' => isset($data['level']) ? $data['level'] : 0,
            'signature' => '', // mys API 不支持签名
            'worldLevel' => -1, // -1 表示不支持
            'finishAchievementNum' => isset($data['achievement_count']) ? $data['achievement_count'] : 0,
            '_source' => 'mys'
        ]
    ]);
    exit;
}

$url = $urls[$source];

$ctx = stream_context_create([
    'http' => [
        'method' => 'GET',
        'timeout' => 20,
        'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36\r\nAccept: application/json\r\n"
    ],
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false
    ]
]);

$result = @file_get_contents($url, false, $ctx);

if ($result === false) {
    // 检查上游是否返回了429限流
    if (isset($http_response_header)) {
        foreach ($http_response_header as $header) {
            if (preg_match('/^HTTP\/\d[\.\d]*\s+429/', $header)) {
                http_response_code(429);
                echo json_encode(['error' => '上游返回信息：查询太频繁，请稍后再试。']);
                exit;
            }
        }
    }
    http_response_code(502);
    echo json_encode(['error' => 'Failed to fetch data from API']);
    exit;
}

echo $result;
