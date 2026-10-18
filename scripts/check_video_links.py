#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量检查视频链接存活性

读取 video-playlist.json / hotvideo.json 里的视频链接，逐个访问判断是否还能打开：
  - B 站链接：走官方 API（x/web-interface/view），code==0 才算可用
  - 其他链接：发 HTTP 请求，2xx / 3xx 算可用
最后列出无法使用的链接及其标题、所在文件、失败原因。

结果分三类：
  可用        链接正常
  不可用      B 站接口明确报错（如稿件不存在、已被删除），或 HTTP 404
  无法确认    网络异常 / 被风控拦截，需人工复核，未必真的失效

用法：
    python3 scripts/check_video_links.py                    # 检查默认两个文件
    python3 scripts/check_video_links.py a.json b.json      # 检查指定文件
    python3 scripts/check_video_links.py --workers 4        # 调整并发数
    python3 scripts/check_video_links.py --timeout 20       # 调整超时（秒）
"""

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import requests
    HAVE_REQUESTS = True
except ImportError:
    HAVE_REQUESTS = False
    import urllib.request
    import urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

DEFAULT_FILES = ['video-playlist.json', 'hotvideo.json']

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/125.0.0.0 Safari/537.36'
    ),
    'Referer': 'https://www.bilibili.com/',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Accept': 'application/json, text/plain, */*',
}

RETRIES = 2          # 网络异常时最多重试次数（不含首次）
RETRY_DELAY = 1.5    # 重试基础间隔（秒），逐次递增
API_DELAY = 0.3      # 每次请求前的小间隔，降低被 B 站风控的概率

OK, DEAD, UNKNOWN = 'ok', 'dead', 'unknown'


def extract_bvid(url):
    """从 B 站视频链接中提取 BV / av 号，非 B 站链接返回 None"""
    m = re.search(r'(BV[a-zA-Z0-9]{10})', url)
    if m:
        return m.group(1)
    m = re.search(r'av(\d+)', url, re.IGNORECASE)
    if m:
        return f'av{m.group(1)}'
    return None


def bili_api_call(bvid):
    """调用 B 站 view 接口，返回解析后的 JSON"""
    if bvid.startswith('av'):
        api_url = f'https://api.bilibili.com/x/web-interface/view?aid={bvid[2:]}'
    else:
        api_url = f'https://api.bilibili.com/x/web-interface/view?bvid={bvid}'

    if HAVE_REQUESTS:
        resp = requests.get(api_url, headers=HEADERS, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()

    req = urllib.request.Request(api_url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read().decode('utf-8'))


def http_call(url, method):
    """普通链接发一次请求，返回 HTTP 状态码"""
    if HAVE_REQUESTS:
        resp = requests.request(method, url, headers=HEADERS,
                                timeout=TIMEOUT, allow_redirects=True)
        return resp.status_code

    req = urllib.request.Request(url, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


def check_once(url):
    """单次检查，返回 (状态, 说明)"""
    bvid = extract_bvid(url)

    if bvid:
        data = bili_api_call(bvid)
        code = data.get('code')
        if code == 0:
            return OK, '可访问'
        msg = data.get('message') or '未知错误'
        return DEAD, f'B站接口 code={code}：{msg}'

    status = http_call(url, 'HEAD')
    if not (200 <= status < 400):
        # 有些站点不支持 HEAD / 对 HEAD 返回 403，换 GET 再确认一次
        status = http_call(url, 'GET')
    if 200 <= status < 400:
        return OK, '可访问'
    return DEAD, f'HTTP {status}'


def check_url(url):
    """带重试地检查一个链接"""
    last_err = ''
    for attempt in range(RETRIES + 1):
        try:
            time.sleep(API_DELAY)
            return check_once(url)
        except Exception as e:  # 网络异常 / 超时 / 风控拦截
            last_err = f'{type(e).__name__}: {e}'
            if attempt < RETRIES:
                time.sleep(RETRY_DELAY * (attempt + 1))
    return UNKNOWN, f'请求失败（重试 {RETRIES} 次）：{last_err}'


def load_entries(paths):
    """读取 JSON 文件，返回 [(文件显示名, 序号, url, 标题)]，同时返回去重后的 url 顺序"""
    entries = []
    missing = []
    for path in paths:
        name = os.path.basename(path)
        if not os.path.isfile(path):
            missing.append(name)
            continue
        try:
            with open(path, 'r', encoding='utf-8') as f:
                raw = json.load(f)
        except (OSError, ValueError) as e:
            print(f'  ⚠  读取失败，跳过 {name}：{e}')
            continue
        if not isinstance(raw, list):
            print(f'  ⚠  不是数组，跳过 {name}')
            continue
        for i, item in enumerate(raw, 1):
            url = item.get('url', '') if isinstance(item, dict) else (item or '')
            title = item.get('title', '') if isinstance(item, dict) else ''
            entries.append((name, i, str(url).strip(), str(title).strip()))
    return entries, missing


def main():
    parser = argparse.ArgumentParser(
        description='批量检查视频链接存活性（默认检查 video-playlist.json 与 hotvideo.json）',
    )
    parser.add_argument('files', nargs='*', help='要检查的 JSON 文件（默认检查站点根目录下两个列表）')
    parser.add_argument('--workers', type=int, default=5, help='并发数，默认 5')
    parser.add_argument('--timeout', type=float, default=12, help='单次请求超时秒数，默认 12')
    args = parser.parse_args()

    global TIMEOUT
    TIMEOUT = args.timeout

    paths = args.files or [os.path.join(ROOT, f) for f in DEFAULT_FILES]
    paths = [p if os.path.isabs(p) else os.path.join(ROOT, p) for p in paths]

    print('=' * 60)
    print('  视频链接存活性检查')
    print('=' * 60)

    entries, missing = load_entries(paths)
    for name in missing:
        print(f'  ⚠  文件不存在：{name}')

    if not entries:
        print('  没有可检查的链接。')
        return

    # 同一个链接可能同时出现在两个文件里，按 URL 去重，减少重复请求
    order = []          # 去重后的 url 顺序
    sources = {}        # url -> [(文件, 序号, 标题)]
    for name, i, url, title in entries:
        if not url:
            continue
        if url not in sources:
            sources[url] = []
            order.append(url)
        sources[url].append((name, i, title))

    total = len(entries)
    print(f'  共 {total} 条链接（去重后 {len(order)} 个），并发 {args.workers} 开始检查...')
    print('-' * 60)

    results = {}
    done = 0
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = {pool.submit(check_url, url): url for url in order}
        for fut in as_completed(futures):
            url = futures[fut]
            results[url] = fut.result()
            done += 1
            status = results[url][0]
            mark = {OK: '✓', DEAD: '✗', UNKNOWN: '?'}[status]
            print(f'  [{done}/{len(order)}] {mark} {url}')
            sys.stdout.flush()

    ok_urls = [u for u in order if results[u][0] == OK]
    dead_urls = [u for u in order if results[u][0] == DEAD]
    unknown_urls = [u for u in order if results[u][0] == UNKNOWN]

    def dump(title, urls):
        if not urls:
            return
        print('\n' + '=' * 60)
        print(f'  {title}（共 {len(urls)} 个）')
        print('=' * 60)
        for n, url in enumerate(urls, 1):
            status, detail = results[url]
            srcs = sources[url]
            name = srcs[0][2] or '(无标题)'
            print(f'\n[{n}] {name}')
            print(f'    链接：{url}')
            print(f'    原因：{detail}')
            for fname, idx, _ in srcs:
                print(f'    来源：{fname} 第 {idx} 条')

    dump('无法使用的链接', dead_urls)
    dump('无法确认的链接（网络异常 / 风控，需人工复核）', unknown_urls)

    print('\n' + '=' * 60)
    print(f'  检查完成：可用 {len(ok_urls)} / 不可用 {len(dead_urls)} / 无法确认 {len(unknown_urls)}'
          f'（去重后共 {len(order)} 个）')
    print('=' * 60)


if __name__ == '__main__':
    main()
