<?php
/**
 * 当日访问统计（Redis 版）
 * ------------------------------------------------------------------
 * PV：按天 INCR，记录页面被打开的次数
 * UV：按天 HyperLogLog（PFADD / PFCOUNT），记录独立访客（按 IP 去重，误差约 0.81%）
 *
 * 关于真实 IP（已在本机实测确认）：
 *   本站在阿里云边缘安全加速之后，实测 REMOTE_ADDR 就是访客真实 IP。
 *   而 X-Forwarded-For 的前置段、X-Real-IP 都可被客户端伪造（实测会原样带进来），
 *   所以这里只信任 TCP 层的 REMOTE_ADDR，绝不取 XFF / X-Real-IP，避免统计被人为刷高。
 *   若日后 REMOTE_ADDR 变成了中转节点 IP（UV 会明显偏低），再改成读 XFF 的“最后一段”，
 *   而不是第一段——最后一段才是最近一层可信代理追加的。
 *
 * 依赖：PHP redis 扩展（phpredis）。
 *   宝塔面板：软件商店 → PHP 8.4 → 安装扩展 → redis，一键装好即可。
 *   未安装时本接口不会 500，只会返回 {"ok":false}，前端静默忽略。
 *
 * 调用：GET api/visit_count.php
 *   → {"ok":true,"date":"2026-10-17","pv":123,"uv":45,"totalPv":6789,"totalUv":456}
 *
 * 键结构（前缀 ysnb:visit:）：
 *   pv:20261017   当日浏览量，40 天后过期
 *   uv:20261017   当日独立访客 HLL，40 天后过期
 *   total:pv      累计浏览量，不设过期
 *   total:uv      累计独立访客 HLL，不设过期
 *   累计 UV 单独用一个 HLL 持续累加，而不是把各天的值相加——
 *   直接相加会把同一个人在不同天重复计数，写进同一个 HLL 才能正确去重。
 *
 * 连接凭证放在 api/config.php（该文件已被 .gitignore 忽略，不随仓库分发）。
 *
 * 手工查看 / 修改数据：
 *   python3 scripts/redis_tool.py show      # 查看今天
 *   python3 scripts/redis_tool.py list      # 列出所有统计键
 */

// ============================ 配置区 ============================
const REDIS_TIMEOUT = 1.0;           // 秒；避免 Redis 卡住拖慢页面加载
const KEY_PREFIX    = 'ysnb:visit:'; // 键前缀，避免和其他应用撞键
const KEY_TTL       = 40 * 86400;    // 明细保留天数（40 天）
const SITE_TZ       = 'Asia/Shanghai'; // “当日”按东八区切分
// ================================================================

date_default_timezone_set(SITE_TZ);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond(array $payload): void
{
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

// 连接凭证从 api/config.php 读取（该文件被 .gitignore 忽略，不随仓库分发）
$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    respond(['ok' => false, 'error' => '缺少 api/config.php，请按该文件注释中的结构手动创建']);
}
$cfg = require $configFile;
if (!is_array($cfg) || !isset($cfg['host'], $cfg['port'])) {
    respond(['ok' => false, 'error' => "api/config.php 结构不正确，应 return ['host' => ..., 'port' => ...]"]);
}

// 访客 IP：只信 REMOTE_ADDR，不解析任何可被伪造的转发头
$ip      = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
$ipValid = filter_var($ip, FILTER_VALIDATE_IP) !== false;

$day   = date('Ymd');
$pvKey = KEY_PREFIX . 'pv:' . $day;
$uvKey = KEY_PREFIX . 'uv:' . $day;
// 累计键：不设过期时间，跨天持续累加
$pvTotalKey = KEY_PREFIX . 'total:pv';
$uvTotalKey = KEY_PREFIX . 'total:uv';

if (!class_exists('Redis')) {
    respond(['ok' => false, 'error' => 'PHP redis 扩展未安装']);
}

try {
    $redis = new Redis();
    $redisHost = (string) $cfg['host'];
    $redisPort = (int) $cfg['port'];
    if (!@$redis->connect($redisHost, $redisPort, REDIS_TIMEOUT)) {
        error_log('[visit_count] connect failed: ' . $redisHost . ':' . $redisPort);
        respond(['ok' => false, 'error' => 'Redis 连接失败']);
    }
    if (defined('Redis::OPT_READ_TIMEOUT')) {
        $redis->setOption(Redis::OPT_READ_TIMEOUT, REDIS_TIMEOUT);
    }
    if (!empty($cfg['pass'])) {
        $redis->auth((string) $cfg['pass']);
    }
    if (isset($cfg['db']) && (int) $cfg['db'] !== 0) {
        $redis->select((int) $cfg['db']);
    }

    // PV：本次打开 +1，同时把过期时间续到 40 天后
    $pv = (int) $redis->incr($pvKey);
    $redis->expire($pvKey, KEY_TTL);

    // UV：HyperLogLog 按 IP 去重；IP 非法时不参与去重，避免脏数据
    if ($ipValid) {
        $redis->pfadd($uvKey, [$ip]);
        $redis->expire($uvKey, KEY_TTL);
    }

    $uv = $redis->pfcount($uvKey);
    if ($uv === false) {
        $uv = 0;
    }

    // 累计总量：与当日分开统计，写入不带过期的键
    $pvTotal = (int) $redis->incr($pvTotalKey);
    if ($ipValid) {
        $redis->pfadd($uvTotalKey, [$ip]);
    }
    $uvTotal = $redis->pfcount($uvTotalKey);
    if ($uvTotal === false) {
        $uvTotal = 0;
    }

    respond([
        'ok'      => true,
        'date'    => date('Y-m-d'),
        'pv'      => $pv,
        'uv'      => (int) $uv,
        'totalPv' => $pvTotal,
        'totalUv' => (int) $uvTotal,
    ]);
} catch (Throwable $e) {
    error_log('[visit_count] ' . $e->getMessage());
    respond(['ok' => false, 'error' => 'Redis 操作异常']);
}
