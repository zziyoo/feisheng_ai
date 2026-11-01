#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""独立校验脚本：对交付包内所有文件计算 SHA256，并与根目录 manifest.json 比对。

用法：
    python verify.py                 # 校验当前目录（解压后的包根）
    python verify.py --root <dir>    # 校验指定目录
    python verify.py --zip <zip>     # 直接校验 ZIP 内的成员（不解压）

跨平台说明：
    Windows 压缩工具可能把成员名写成反斜杠，Linux/macOS 用正斜杠；
    manifest 也可能包含 "./" 前缀或反斜杠。本脚本先把成员名与清单路径
    统一规范化为 POSIX 相对路径，再做包根定位与哈希比对。
    目录项（以 / 或 \\ 结尾）不参与文件校验；同一规范化路径重复出现视为错误。

退出码：0 = 全部一致；1 = 存在缺失/不一致/多余/重复/尺寸不符。
"""
import argparse
import hashlib
import json
import os
import posixpath
import re
import sys
import zipfile

BLOCK = 1 << 20


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(BLOCK), b''):
            h.update(chunk)
    return h.hexdigest()


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def norm_rel(name):
    """把 ZIP 成员/清单路径规范化为包内 POSIX 相对路径。

    接受 ``a\\b``、``./a/b``、``/a/b``、``C:/a/b``；拒绝绝对路径与上跳。
    返回空字符串表示包根本身（目录项）。
    """
    text = str(name).replace('\\', '/')
    text = re.sub(r'^[A-Za-z]:/', '', text)
    text = text.lstrip('/')
    while text.startswith('./'):
        text = text[2:]
    if not text:
        return ''
    normalized = posixpath.normpath(text)
    if normalized in ('.', ''):
        return ''
    if normalized == '..' or normalized.startswith('../'):
        raise ValueError('unsafe path outside package root: %r' % name)
    return normalized


def is_dir_entry(name):
    return str(name).endswith('/') or str(name).endswith('\\')


def locate_root_manifest(paths):
    """在规范化后的成员路径中定位唯一的包根 manifest。

    优先根目录 manifest.json；否则只接受唯一顶层目录下的 manifest.json。
    嵌套同名 manifest 不能被当作主清单。
    """
    if 'manifest.json' in paths:
        return ''
    candidates = sorted({
        path.rsplit('/manifest.json', 1)[0]
        for path in paths
        if path.endswith('/manifest.json') and path.count('/') == 1
    })
    if len(candidates) == 1:
        return candidates[0]
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='.')
    parser.add_argument('--zip', default=None)
    parser.add_argument('--manifest', default='manifest.json')
    args = parser.parse_args()

    duplicates = []
    unsafe = []
    if args.zip:
        with zipfile.ZipFile(args.zip) as zf:
            raw_files = []
            for info in zf.infolist():
                if info.is_dir() or is_dir_entry(info.filename):
                    continue
                raw_files.append((info.filename, zf.read(info)))
        members = {}
        for raw_name, data in raw_files:
            try:
                rel = norm_rel(raw_name)
            except ValueError as exc:
                unsafe.append(str(exc))
                continue
            if not rel:
                continue
            if rel in members:
                duplicates.append(rel)
                continue
            members[rel] = data
        mode = 'zip'
        paths = set(members)
        prefix = locate_root_manifest(paths)
        if prefix is None:
            print('FAIL: zip 根目录没有唯一的 manifest.json（顶层：%s）' % sorted({
                p.split('/', 1)[0] for p in paths
            }))
            sys.exit(1)
        manifest_name = (prefix + '/' if prefix else '') + 'manifest.json'
        manifest_raw = members[manifest_name]
        prefix_len = len(prefix) + 1 if prefix else 0
        scoped = {path[prefix_len:]: data for path, data in members.items() if path.startswith(prefix + '/' if prefix else '')}
        manifest_scoped_name = manifest_name[prefix_len:]
    else:
        root = os.path.abspath(args.root)
        manifest_path = os.path.join(root, args.manifest)
        with open(manifest_path, 'rb') as f:
            manifest_raw = f.read()
        members = {}
        for dirpath, _dirnames, filenames in os.walk(root):
            for name in filenames:
                full = os.path.join(dirpath, name)
                rel = norm_rel(os.path.relpath(full, root))
                if not rel:
                    continue
                with open(full, 'rb') as f:
                    members[rel] = f.read()
        mode = 'dir'
        scoped = members
        manifest_name = norm_rel(args.manifest)
        manifest_scoped_name = manifest_name

    try:
        manifest = json.loads(manifest_raw.decode('utf-8'))
    except Exception as exc:
        print('FAIL: manifest.json 无法解析: %s' % exc)
        sys.exit(1)

    entries = manifest.get('files')
    if not isinstance(entries, list):
        print('FAIL: manifest.files 不是数组')
        sys.exit(1)

    ok = missing = mismatched = size_mismatch = 0
    problems = list(unsafe)
    seen = set()
    for entry in entries:
        if not isinstance(entry, dict) or 'path' not in entry or 'sha256' not in entry:
            problems.append('INVALID ENTRY %r' % (entry,))
            missing += 1
            continue
        try:
            rel = norm_rel(entry['path'])
        except ValueError as exc:
            problems.append('UNSAFE ENTRY ' + str(exc))
            missing += 1
            continue
        if not rel:
            problems.append('INVALID ENTRY PATH %r' % (entry['path'],))
            missing += 1
            continue
        if rel in seen:
            problems.append('DUPLICATE MANIFEST ENTRY ' + rel)
            size_mismatch += 1
            continue
        seen.add(rel)
        data = scoped.get(rel)
        if data is None:
            missing += 1
            problems.append('MISSING ' + rel)
            continue
        actual = sha256_bytes(data)
        expected = str(entry['sha256']).lower()
        if actual == expected:
            ok += 1
        else:
            mismatched += 1
            problems.append('SHA256 MISMATCH %s expected=%s actual=%s' % (rel, expected[:16], actual[:16]))
        expected_size = entry.get('size')
        if expected_size is not None and len(data) != expected_size:
            size_mismatch += 1
            problems.append('SIZE MISMATCH %s expected=%d actual=%d' % (rel, int(expected_size), len(data)))

    listed = seen
    extra = sorted(rel for rel in scoped if rel != manifest_scoped_name and rel not in listed)
    for rel in extra:
        problems.append('EXTRA (not in manifest) ' + rel)
    for rel in sorted(set(duplicates)):
        problems.append('DUPLICATE ZIP MEMBER ' + rel)

    print('mode=%s files_listed=%d ok=%d missing=%d mismatched=%d size_mismatch=%d extra=%d duplicate=%d' % (
        mode, len(entries), ok, missing, mismatched, size_mismatch, len(extra), len(set(duplicates))))
    meta = manifest.get('package', {})
    print('head=%s baseline=%s' % (meta.get('head'), meta.get('baseline_commit')))
    for line in problems:
        print(line)
    if missing or mismatched or size_mismatch or extra or duplicates:
        sys.exit(1)
    print('VERIFY PASS')


if __name__ == '__main__':
    main()
