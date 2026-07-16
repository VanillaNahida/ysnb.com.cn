#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
快速编辑 video-playlist.json 或 hotvideo.json
输入 B 站视频链接，自动标准化为 https://www.bilibili.com/video/BVxxxxxx 格式
"""

import json
import re
import sys
import os
import time

try:
    import requests
    HAVE_REQUESTS = True
except ImportError:
    HAVE_REQUESTS = False
    import urllib.request
    import urllib.error

FILES = {
    '1': 'video-playlist.json',
    '2': 'hotvideo.json',
}

def normalize_bilibili_url(url):
    """将 B 站链接标准化为 https://www.bilibili.com/video/BVxxxxxx 格式"""
    url = url.strip()
    # 匹配 BV 号（BV 开头 + 10 位字母数字）
    m = re.search(r'(BV[a-zA-Z0-9]{10})', url)
    if m:
        bv = m.group(1)
        return f'https://www.bilibili.com/video/{bv}'
    # 匹配 av 号
    m = re.search(r'av(\d+)', url, re.IGNORECASE)
    if m:
        return f'https://www.bilibili.com/video/av{m.group(1)}'
    return url


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


def extract_bvid(url):
    """从 B 站视频链接中提取 BV 号"""
    m = re.search(r'(BV[a-zA-Z0-9]{10})', url)
    if m:
        return m.group(1)
    m = re.search(r'av(\d+)', url, re.IGNORECASE)
    if m:
        return f'av{m.group(1)}'
    return None


def fetch_title(url):
    """通过 B 站 API 获取视频标题"""
    bvid = extract_bvid(url)
    if not bvid:
        return None
    if bvid.startswith('av'):
        api_url = f'https://api.bilibili.com/x/web-interface/view?aid={bvid[2:]}'
    else:
        api_url = f'https://api.bilibili.com/x/web-interface/view?bvid={bvid}'
    try:
        if HAVE_REQUESTS:
            resp = requests.get(api_url, headers=API_HEADERS, timeout=15)
            resp.raise_for_status()
            data = resp.json()
        else:
            req = urllib.request.Request(api_url, headers=API_HEADERS)
            with urllib.request.urlopen(req, timeout=15) as r:
                data = json.loads(r.read().decode('utf-8'))
        if data.get('code') == 0:
            title = data.get('data', {}).get('title', '')
            return title.strip() if title else None
    except Exception:
        pass
    return None


def load_json(path):
    if not os.path.exists(path):
        return []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            raw = json.load(f)
        # 统一转为对象格式 {url, title}
        if raw and isinstance(raw[0], str):
            return [{"url": u, "title": ""} for u in raw]
        return raw
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
        f.write('\n')


def main():
    print('=== B 站视频链接添加工具 ===\n')

    # 选择文件
    print('请选择要编辑的文件：')
    for k, v in FILES.items():
        print(f'  {k}. {v}')
    print()

    choice = input('请输入 1 或 2：').strip()
    while choice not in FILES:
        choice = input('输入无效，请重新输入 1 或 2：').strip()

    file_path = FILES[choice]
    data = load_json(file_path)
    existing_urls = {item["url"] for item in data if "url" in item}
    added = 0

    print(f'\n已加载 {file_path}，当前共 {len(data)} 条链接。')
    print('请输入 B 站视频链接，输入 exit 或按 Ctrl+C 退出。\n')

    while True:
        try:
            raw = input('请输入链接 > ').strip()
        except (KeyboardInterrupt, EOFError):
            print('\n已退出。')
            break

        if not raw:
            continue
        if raw.lower() in ('exit', 'quit', 'q'):
            break

        normalized = normalize_bilibili_url(raw)
        if normalized in existing_urls:
            print(f'  ⚠  链接已存在，跳过：{normalized}')
            continue

        # 自动获取视频标题
        print(f'  正在获取标题...', end=' ')
        sys.stdout.flush()
        title = fetch_title(normalized)
        if title:
            print(f'✓ {title[:50]}')
        else:
            title = ''
            print('（暂未获取到，下次运行 fetch_video_titles.py 可补全）')

        data.append({"url": normalized, "title": title})
        existing_urls.add(normalized)
        added += 1
        print(f'  ✓ 已添加：{normalized}')

    if added > 0:
        save_json(file_path, data)
        print(f'\n共添加 {added} 条链接，已保存到 {file_path}（共 {len(data)} 条）。')
    else:
        print('\n未添加任何新链接。')


if __name__ == '__main__':
    main()
