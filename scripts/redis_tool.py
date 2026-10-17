#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
快捷查看 / 修改站点访问统计（Redis 版）

凭证从 api/config.php 读取，本脚本里不写密码。
底层调用 redis-cli（无需 pip install redis），密码通过环境变量传递，
不会出现在 ps 的命令行里。

用法：
    python3 scripts/redis_tool.py show [日期|total]          查看 PV / UV（默认今天）
    python3 scripts/redis_tool.py list                       列出所有统计键及剩余有效期
    python3 scripts/redis_tool.py set-pv <值> [日期|total]    把 PV 改成指定值
    python3 scripts/redis_tool.py set-uv <值> [日期|total]    把 UV 改成指定值
    python3 scripts/redis_tool.py reset-uv [日期|total]       清空 UV
    python3 scripts/redis_tool.py del <日期|total>            删除 PV 和 UV

日期可写 20261017 或 2026-10-17，省略则为今天（东八区）；
日期位置写 total 表示累计键（{前缀}total:pv / {前缀}total:uv，不设过期）。
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PHP = os.path.normpath(os.path.join(HERE, '..', 'api', 'config.php'))

# 需与 api/visit_count.php 中的同名常量保持一致
KEY_PREFIX = 'ysnb:visit:'
KEY_TTL = 40 * 86400

TZ = timezone(timedelta(hours=8))  # “当日”按东八区切分
TOTAL_ALIAS = 'total'              # 日期位置写它表示累计键
PFADD_BATCH = 10000                # 单次 pfadd 的成员数，避免命令行过长


def die(msg):
    sys.exit(f'错误：{msg}')


def load_config():
    """通过 php 解析 api/config.php，拿到 host / port / pass / db"""
    if not os.path.isfile(CONFIG_PHP):
        die(f'找不到配置文件 {CONFIG_PHP}，请先创建（参考 api/visit_count.php 注释）')
    try:
        proc = subprocess.run(
            ['php', '-r', 'echo json_encode(require $argv[1]);', CONFIG_PHP],
            capture_output=True, text=True, timeout=10,
        )
    except FileNotFoundError:
        die('未找到 php 命令，无法解析 api/config.php')
    except subprocess.TimeoutExpired:
        die('解析 api/config.php 超时')

    if proc.returncode != 0:
        die(f'解析 api/config.php 失败：{proc.stderr.strip() or proc.stdout.strip()}')

    try:
        cfg = json.loads(proc.stdout)
    except json.JSONDecodeError:
        die('api/config.php 没有返回合法数组，请检查文件内容')

    if not isinstance(cfg, dict) or not cfg.get('host') or not cfg.get('port'):
        die("api/config.php 结构不正确，应 return ['host' => ..., 'port' => ...]")
    return cfg


def run(args, cfg):
    """执行 redis-cli 并返回输出文本"""
    cmd = ['redis-cli', '-h', str(cfg['host']), '-p', str(cfg['port'])]
    if cfg.get('db'):
        cmd += ['-n', str(cfg['db'])]
    cmd += [str(a) for a in args]

    env = dict(os.environ)
    if cfg.get('pass'):
        # 用环境变量传密码，避免密码出现在进程命令行里
        env['REDISCLI_AUTH'] = str(cfg['pass'])

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=15)
    except FileNotFoundError:
        die('未找到 redis-cli 命令')
    except subprocess.TimeoutExpired:
        die('redis-cli 执行超时')

    text = (proc.stdout + proc.stderr).strip()
    for bad in ('NOAUTH', 'WRONGTYPE', 'Could not connect', 'Connection refused', 'ERR '):
        if bad in text:
            die(f'Redis 操作失败：{text}')
    return text


def keys_of(target):
    """target 为 total 时返回累计键，否则返回当天的 PV / UV 键"""
    if target == TOTAL_ALIAS:
        return f'{KEY_PREFIX}total:pv', f'{KEY_PREFIX}total:uv'
    return f'{KEY_PREFIX}pv:{target}', f'{KEY_PREFIX}uv:{target}'


def is_uv_key(key):
    """判断是否为 UV（HyperLogLog）键。

    当日键形如 ysnb:visit:uv:20261017，累计键形如 ysnb:visit:total:uv，
    所以不能只看键名结尾或倒数第二段，要看前缀之后的所有分段里有没有 'uv'。
    """
    suffix = key[len(KEY_PREFIX):] if key.startswith(KEY_PREFIX) else key
    return 'uv' in suffix.split(':')


def normalize_date(raw):
    raw = (raw or '').strip()
    if not raw:
        return datetime.now(TZ).strftime('%Y%m%d')
    d = raw.replace('-', '').replace('/', '')
    if not (len(d) == 8 and d.isdigit()):
        die(f'日期格式不对：{raw}（应为 20261017 或 2026-10-17）')
    return d


def normalize_target(raw):
    """把日期参数转成内部 target：total 原样返回，其余转成 20261017 形式"""
    if (raw or '').strip().lower() in (TOTAL_ALIAS, '累计'):
        return TOTAL_ALIAS
    return normalize_date(raw)


def pretty_date(date):
    return f'{date[:4]}-{date[4:6]}-{date[6:]}'


def label_of(target):
    return '累计' if target == TOTAL_ALIAS else pretty_date(target)


def ttl_text(ttl):
    if ttl == '-2':
        return '键不存在'
    if ttl == '-1':
        return '永不过期'
    try:
        return f'剩余 {int(ttl) / 86400:.1f} 天'
    except ValueError:
        return str(ttl)


def cmd_show(cfg, target):
    pv_key, uv_key = keys_of(target)
    pv = run(['get', pv_key], cfg) or '0'
    uv = run(['pfcount', uv_key], cfg) or '0'
    ttl_pv = run(['ttl', pv_key], cfg)
    ttl_uv = run(['ttl', uv_key], cfg)

    print(f'目标  {label_of(target)}')
    print(f'PV    {pv}'.ljust(26) + f'({ttl_text(ttl_pv)})')
    print(f'UV    {uv}'.ljust(26) + f'({ttl_text(ttl_uv)})')


def cmd_list(cfg):
    raw = run(['--scan', '--pattern', f'{KEY_PREFIX}*'], cfg)
    keys = [k for k in raw.splitlines() if k.strip()]
    if not keys:
        print(f'没有找到 {KEY_PREFIX}* 开头的键。')
        return

    rows = []
    for key in keys:
        ttl = run(['ttl', key], cfg)
        if is_uv_key(key):
            kind, value = 'UV', run(['pfcount', key], cfg) or '0'
        else:
            kind, value = 'PV', run(['get', key], cfg) or '0'
        rows.append((key, kind, value, ttl))

    rows.sort(key=lambda r: r[0], reverse=True)
    print(f'{"键":<34}{"类型":<6}{"值":<10}有效期')
    print('-' * 66)
    for key, kind, value, ttl in rows:
        print(f'{key:<34}{kind:<6}{value:<10}{ttl_text(ttl)}')
    print('-' * 66)
    print(f'共 {len(rows)} 个键')


def cmd_set_pv(cfg, target, value):
    pv_key, _ = keys_of(target)
    run(['set', pv_key, str(value)], cfg)
    if target != TOTAL_ALIAS:
        run(['expire', pv_key, str(KEY_TTL)], cfg)
    print(f'{label_of(target)} 的 PV 已设为 {run(["get", pv_key], cfg)}')


def cmd_set_uv(cfg, target, value):
    """HLL 不能直接赋值，只能清空后用 N 个不同成员重建，使 PFCOUNT ≈ N"""
    _, uv_key = keys_of(target)
    old = run(['pfcount', uv_key], cfg) or '0'
    run(['del', uv_key], cfg)

    if value > 0:
        members = [f'synthetic:{i}' for i in range(value)]
        for i in range(0, len(members), PFADD_BATCH):
            run(['pfadd', uv_key] + members[i:i + PFADD_BATCH], cfg)
        if target != TOTAL_ALIAS:
            run(['expire', uv_key, str(KEY_TTL)], cfg)

    actual = run(['pfcount', uv_key], cfg) or '0'
    print(f'{label_of(target)} 的 UV：{old} → {actual}（目标 {value}）')
    if actual != str(value):
        print('  提示：HyperLogLog 是概率估算，基数越大误差越明显（约 0.81%）。')


def cmd_reset_uv(cfg, target):
    _, uv_key = keys_of(target)
    run(['del', uv_key], cfg)
    print(f'{label_of(target)} 的 UV 已清空（UV 键已删除）。')


def cmd_del(cfg, target):
    pv_key, uv_key = keys_of(target)
    run(['del', pv_key, uv_key], cfg)
    print(f'{label_of(target)} 的 PV / UV 已删除。')


def parse_value(raw):
    try:
        value = int(raw)
    except (TypeError, ValueError):
        die(f'值必须是整数：{raw}')
    if value < 0:
        die('值不能为负数')
    return value


def main():
    parser = argparse.ArgumentParser(
        description='查看 / 修改站点访问统计（Redis），凭证读取自 api/config.php',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='日期可写 20261017 或 2026-10-17，省略则为今天（东八区）；写 total 表示累计键。',
    )
    sub = parser.add_subparsers(dest='command')

    p = sub.add_parser('show', help='查看某天的 PV / UV')
    p.add_argument('date', nargs='?', default='')

    sub.add_parser('list', help='列出所有统计键')

    p = sub.add_parser('set-pv', help='把 PV 改成指定值')
    p.add_argument('value')
    p.add_argument('date', nargs='?', default='')

    p = sub.add_parser('set-uv', help='把 UV 改成指定值')
    p.add_argument('value')
    p.add_argument('date', nargs='?', default='')

    p = sub.add_parser('reset-uv', help='清空某天的 UV')
    p.add_argument('date', nargs='?', default='')

    p = sub.add_parser('del', help='删除某天的 PV 和 UV')
    p.add_argument('date')

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(0)

    cfg = load_config()

    if args.command == 'list':
        cmd_list(cfg)
        return

    date = normalize_target(args.date)
    if args.command == 'show':
        cmd_show(cfg, date)
    elif args.command == 'set-pv':
        cmd_set_pv(cfg, date, parse_value(args.value))
    elif args.command == 'set-uv':
        cmd_set_uv(cfg, date, parse_value(args.value))
    elif args.command == 'reset-uv':
        cmd_reset_uv(cfg, date)
    elif args.command == 'del':
        cmd_del(cfg, date)


if __name__ == '__main__':
    main()
