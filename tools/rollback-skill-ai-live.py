#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""回滚本地试验安装的 3 个运行时文件。默认只打印计划；必须显式 --apply。"""
import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'skill-ai-20261030', 'live-install')
MANIFEST = os.path.join(OUT, 'manifest.json')


def sha(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read().replace(b'\r\n', b'\n')).hexdigest()


def main():
    apply = '--apply' in sys.argv
    manifest = json.load(open(MANIFEST, encoding='utf-8'))
    live = manifest['live_install_dir']
    plan = []
    for row in manifest['files']:
        target = os.path.join(live, row['path'].replace('/', os.sep))
        if row.get('pre_absent'):
            plan.append(('delete', target, None, row['post_sha256']))
        else:
            backup = os.path.join(OUT, row['backup'])
            plan.append(('restore', target, backup, row['pre_sha256']))
    for action, target, source, expected in plan:
        print(action, target, '<-', source or '(remove)')
        if not apply:
            continue
        if action == 'delete':
            if os.path.exists(target):
                if sha(target) != expected:
                    raise SystemExit('ABORT: current file changed, refusing to delete: ' + target)
                os.remove(target)
        else:
            if not os.path.exists(source):
                raise SystemExit('ABORT: backup missing: ' + source)
            if sha(source) != expected:
                raise SystemExit('ABORT: backup hash mismatch: ' + source)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.copy2(source, target)
            if sha(target) != expected:
                raise SystemExit('ABORT: restored hash mismatch: ' + target)
    print('APPLIED' if apply else 'DRY-RUN (add --apply to rollback)')


if __name__ == '__main__':
    main()
