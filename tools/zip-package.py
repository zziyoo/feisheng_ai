#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 staging 目录打成可复现 ZIP：成员按 POSIX 路径排序，时间戳固定。"""
import os
import sys
import zipfile

FIXED_DATE = (2026, 11, 1, 0, 0, 0)


def main():
    if len(sys.argv) != 3:
        raise SystemExit('usage: python zip-package.py <stage-dir> <zip-path>')
    stage, output = sys.argv[1], sys.argv[2]
    files = []
    for dirpath, _dirnames, filenames in os.walk(stage):
        for name in filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, stage).replace(os.sep, '/')
            files.append((rel, full))
    files.sort(key=lambda item: item[0])
    os.makedirs(os.path.dirname(os.path.abspath(output)), exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zf:
        for rel, full in files:
            info = zipfile.ZipInfo(rel, date_time=FIXED_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o644 & 0xFFFF) << 16
            with open(full, 'rb') as f:
                zf.writestr(info, f.read())
    print('wrote %s (%d files)' % (output, len(files)))


if __name__ == '__main__':
    main()
