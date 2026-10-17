<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

function getRandomImage($dir) {
    if (!is_dir($dir)) return null;
    $files = [];
    $iterator = new FilesystemIterator($dir);
    foreach ($iterator as $file) {
        if ($file->isFile()) {
            $ext = strtolower($file->getExtension());
            if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
                $files[] = $file->getPathname();
            }
        }
    }
    if (empty($files)) return null;
    return $files[array_rand($files)];
}

$pcFile = getRandomImage(__DIR__ . '/../assets/background/pc/');
$mobileFile = getRandomImage(__DIR__ . '/../assets/background/mobile/');

echo json_encode([
    'pc'       => $pcFile ? 'assets/background/pc/' . basename($pcFile) : null,
    'mobile'   => $mobileFile ? 'assets/background/mobile/' . basename($mobileFile) : null,
], JSON_UNESCAPED_UNICODE);
