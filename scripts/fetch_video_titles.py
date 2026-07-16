#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
读取 video-playlist.json 和 hotvideo.json 中的 B 站视频链接，
通过 B 站官方 API 获取每个视频的标题，将数据格式从纯字符串数组转换为对象数组。
"""

import json
import re
import os
import time
import sys

try:
    import requests
    HAVE_REQUESTS = True
except ImportError:
    HAVE_REQUESTS = False
    import urllib.request
    import urllib.error

FILES = ['video-playlist.json', 'hotvideo.json']

API_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/125.0.0.0 Safari/537.36'
    ),
    'Referer': 'https://www.bilibili.com/',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Accept': 'application/json, text/plain, */*',
}

TIMEOUT = 15
DELAY = 1.0  # 请求间隔


def extract_bvid(url):
    """从 B 站视频链接中提取 BV 号"""
    m = re.search(r'(BV[a-zA-Z0-9]{10})', url)
    if m:
        return m.group(1)
    # 也支持 av 号
    m = re.search(r'av(\d+)', url, re.IGNORECASE)
    if m:
        return f'av{m.group(1)}'
    return None


def fetch_title_via_api(url):
    """通过 B 站 API 获取视频标题"""
    bvid = extract_bvid(url)
    if not bvid:
        raise Exception("无法从链接中提取 BV/AV 号")

    api_url = f'https://api.bilibili.com/x/web-interface/view?bvid={bvid}'
    prefix = bvid[:2]  # av 开头的情况

    if bvid.startswith('av'):
        api_url = f'https://api.bilibili.com/x/web-interface/view?aid={bvid[2:]}'

    if HAVE_REQUESTS:
        resp = requests.get(api_url, headers=API_HEADERS, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    else:
        req = urllib.request.Request(api_url, headers=API_HEADERS)
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            data = json.loads(r.read().decode('utf-8'))

    if data.get('code') != 0:
        msg = data.get('message', '未知错误')
        raise Exception(f"API 返回错误: {msg}")

    title = data.get('data', {}).get('title', '')
    if not title:
        raise Exception("API 返回数据中无标题")
    return title.strip()


def convert_file(file_path):
    """读取并转换一个 JSON 文件"""
    if not os.path.exists(file_path):
        print(f"  ⚠  文件不存在，跳过：{file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        raw = json.load(f)

    if not isinstance(raw, list):
        print(f"  ⚠  文件格式不是数组，跳过：{file_path}")
        return

    # 检查是否已经是新格式
    if raw and isinstance(raw[0], dict):
        print(f"  ℹ  {file_path} 已包含标题，将补充缺失的")
        items = raw
    else:
        # 旧格式：纯字符串数组
        items = [{"url": u} for u in raw]

    total = len(items)
    updated = 0
    errors = 0

    print(f"\n【{file_path}】（共 {total} 条）")
    print("-" * 60)

    for i, item in enumerate(items):
        url = item.get("url", "")
        if not url:
            print(f"  [{i+1}/{total}] 跳过：缺少 URL")
            errors += 1
            continue

        # 已有标题则跳过
        if item.get("title", "").strip():
            print(f"  [{i+1}/{total}] 已有标题，跳过：{item['title'][:40]}")
            continue

        print(f"  [{i+1}/{total}] {url}", end=" ... ")
        sys.stdout.flush()

        try:
            title = fetch_title_via_api(url)
            item["title"] = title
            updated += 1
            print(f"✓ {title[:50]}")
        except Exception as e:
            item["title"] = ""
            errors += 1
            print(f"✗ {e}")

        if i < total - 1:
            time.sleep(DELAY)

    # 写回文件
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=4)
        f.write('\n')

    print("-" * 60)
    print(f"  完成：成功 {updated} / 失败 {errors} / 总计 {total}")
    return updated, errors


def main():
    print("=" * 60)
    print("  B 站视频标题获取工具（API 模式）")
    print("=" * 60)

    total_ok = 0
    total_err = 0

    for fname in FILES:
        result = convert_file(fname)
        if result:
            ok, err = result
            total_ok += ok
            total_err += err

    print("\n" + "=" * 60)
    print(f"  全部完成：成功 {total_ok} / 失败 {total_err}")
    print("=" * 60)


if __name__ == '__main__':
    main()
