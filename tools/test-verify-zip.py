#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""verify.py --zip 跨平台回归。

覆盖：
- Windows 压缩工具生成的反斜杠成员名与清单路径；
- Linux/macOS 的正斜杠成员名；
- "./" 前缀、根目录有无包目录；
- 根 manifest 与嵌套同名 manifest 并存；
- 根 manifest 缺失、规范化后重复成员、尺寸不符必须失败。

在包内运行：python tests/test-verify-zip.py
依赖：仅 Python 3 标准库。
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import warnings
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
VERIFY = next(
    (path for path in (os.path.join(HERE, 'verify.py'), os.path.join(HERE, '..', 'verify.py')) if os.path.exists(path)),
    None,
)
if not VERIFY:
    raise SystemExit('verify.py not found next to tests or at package root')


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def manifest_for(payloads, style='slash'):
    files = []
    for rel, data in payloads.items():
        path = rel.replace('/', '\\') if style == 'backslash' else rel
        if style == 'backslash':
            path = './' + path
        files.append({
            'path': path,
            'size': len(data),
            'sha256': sha256_bytes(data),
            'commit': None,
            'batch': 'test',
            'purpose': 'fixture',
        })
    return json.dumps({'schema_version': '1.0', 'package': {'head': 'test', 'baseline_commit': 'test'}, 'files': files}, ensure_ascii=False).encode('utf-8')


def build_package(directory, wrapper='pkgroot', style='slash', include_root_manifest=True, member_style='slash'):
    """构造包目录与成员映射；返回 zip 用的 {member_name: bytes}。"""
    payloads = {
        'a.txt': b'payload-a\n',
        'docs/manifest.json': b'{"files": [{"path": "bogus.txt", "size": 1, "sha256": "00"}]}',
        'docs/live-install/manifest.json': b'{"files": [{"path": "bogus2.txt", "size": 1, "sha256": "00"}]}',
    }
    root_manifest = manifest_for(payloads, style=style)
    os.makedirs(os.path.join(directory, 'docs', 'live-install'), exist_ok=True)
    for rel, data in payloads.items():
        full = os.path.join(directory, *rel.split('/'))
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, 'wb') as f:
            f.write(data)
    if include_root_manifest:
        with open(os.path.join(directory, 'manifest.json'), 'wb') as f:
            f.write(root_manifest)
    members = {}
    if include_root_manifest:
        members['manifest.json'] = root_manifest
    for rel, data in payloads.items():
        members[rel] = data
    if member_style == 'backslash':
        names = {('\\'.join(([wrapper] if wrapper else []) + [rel.replace('/', '\\')])): data for rel, data in members.items()}
    else:
        names = {('/'.join(([wrapper] if wrapper else []) + [rel])): data for rel, data in members.items()}
    return names


def write_zip(zip_path, members, directory_style='slash'):
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for name, data in members.items():
            zf.writestr(name, data)
        if directory_style == 'backslash':
            zf.writestr('pkgroot\\', b'')
        elif directory_style == 'slash':
            zf.writestr('pkgroot/', b'')


def run_verify(extra):
    proc = subprocess.run([sys.executable, VERIFY] + extra, capture_output=True, text=True)
    return proc.returncode, proc.stdout, proc.stderr


def main():
    root = tempfile.mkdtemp(prefix='verify-zip-')
    failures = 0

    def check(name, ok, stdout='', stderr=''):
        nonlocal failures
        print(('PASS ' if ok else 'FAIL ') + name)
        if not ok:
            failures += 1
            print(stdout)
            print(stderr)

    try:
        # 1) Linux 风格：正斜杠成员 + 解压目录
        pkg = os.path.join(root, 'linux', 'pkgroot')
        members = build_package(pkg)
        zip_linux = os.path.join(root, 'linux.zip')
        write_zip(zip_linux, members)
        code, out, err = run_verify(['--zip', zip_linux])
        check('verify.py --zip accepts POSIX member paths', code == 0 and 'VERIFY PASS' in out, out, err)
        code, out, err = run_verify(['--root', pkg])
        check('verify.py --root accepts POSIX package', code == 0 and 'VERIFY PASS' in out, out, err)

        # 2) Windows 风格：反斜杠成员 + 清单路径反斜杠/"./"
        pkg_win = os.path.join(root, 'windows', 'pkgroot')
        members_win = build_package(pkg_win, style='backslash', member_style='backslash')
        zip_win = os.path.join(root, 'windows.zip')
        write_zip(zip_win, members_win, directory_style='backslash')
        code, out, err = run_verify(['--zip', zip_win])
        check('verify.py --zip accepts Windows backslash members and manifest paths', code == 0 and 'VERIFY PASS' in out, out, err)

        # 3) 没有包目录：manifest 直接在 ZIP 根
        pkg_flat = os.path.join(root, 'flat')
        members_flat = build_package(pkg_flat, wrapper='')
        zip_flat = os.path.join(root, 'flat.zip')
        write_zip(zip_flat, members_flat)
        code, out, err = run_verify(['--zip', zip_flat])
        check('verify.py --zip accepts manifest at archive root', code == 0 and 'VERIFY PASS' in out, out, err)

        # 4) 根 manifest 缺失，只有嵌套同名 manifest → 必须失败
        bad = os.path.join(root, 'badpkg')
        os.makedirs(os.path.join(bad, 'docs'), exist_ok=True)
        with open(os.path.join(bad, 'docs', 'manifest.json'), 'w', encoding='utf-8') as f:
            f.write('{"files": []}')
        bad_zip = os.path.join(root, 'bad.zip')
        with zipfile.ZipFile(bad_zip, 'w') as zf:
            zf.writestr('badpkg\\docs\\manifest.json', '{"files": []}')
        code, out, err = run_verify(['--zip', bad_zip])
        check('verify.py --zip rejects archive without root manifest', code != 0 and 'FAIL' in out, out, err)

        # 5) 规范化后重复成员（正/反斜杠各一份）→ 必须失败
        dup_zip = os.path.join(root, 'dup.zip')
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            with zipfile.ZipFile(dup_zip, 'w') as zf:
                zf.writestr('pkgroot/manifest.json', manifest_for({'a.txt': b'x'}))
                zf.writestr('pkgroot/a.txt', b'x')
                zf.writestr('pkgroot\\a.txt', b'x')
        code, out, err = run_verify(['--zip', dup_zip])
        check('verify.py --zip rejects duplicate normalized members', code != 0 and 'DUPLICATE ZIP MEMBER' in out, out, err)

        # 6) 尺寸不符 → 必须失败
        bad_size = os.path.join(root, 'size.zip')
        manifest = json.loads(manifest_for({'a.txt': b'abc'}).decode('utf-8'))
        manifest['files'][0]['size'] = 999
        with zipfile.ZipFile(bad_size, 'w') as zf:
            zf.writestr('pkgroot/manifest.json', json.dumps(manifest).encode('utf-8'))
            zf.writestr('pkgroot/a.txt', b'abc')
        code, out, err = run_verify(['--zip', bad_size])
        check('verify.py --zip rejects size mismatch', code != 0 and 'SIZE MISMATCH' in out, out, err)
    finally:
        shutil.rmtree(root, ignore_errors=True)

    if failures:
        print('FAILURES:', failures)
        sys.exit(1)
    print('ALL PASS (verify.zip cross-platform regression)')


if __name__ == '__main__':
    main()
