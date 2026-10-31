#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 docs/skill-ai-20261030/baseline.json。

注意：v4.4.4 是 annotated tag。`git rev-parse v4.4.4` 返回 tag 对象；
必须用 `git rev-parse v4.4.4^{commit}` 取真正的提交。
"""
import hashlib
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'skill-ai-20261030', 'baseline.json')
INSTALLED = r'C:/Users/32360/Desktop/无名杀-win32-x64/resources/app/extension/无名AI'
RUNTIME_ROOT = {'extension.js', 'info.json'}
RUNTIME_DIRS = ('js/', 'score/', 'shadow/', 'css/', 'assets/', 'model/')
CORE_FILES = [
    'extension.js', 'info.json', 'score/index.js',
    'score/decision/safety/aiOverride.js', 'score/decision/override/use.js',
    'score/decision/skills/skills.js', 'score/decision/engine/engine.js',
    'score/model/features/features.js', 'score/model/features/dimensionAdapter.js',
    'score/model/net/policyModelV3.js', 'score/decision/state/decisionEvaluation.js',
]


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True).stdout


def git_text(*args):
    return git(*args).decode('utf-8', 'replace').strip()


def sha_bytes(data):
    return hashlib.sha256(data.replace(b'\r\n', b'\n')).hexdigest()


def file_sha(path):
    with open(path, 'rb') as f:
        return sha_bytes(f.read())


def main():
    tag_object = git_text('rev-parse', 'v4.4.4')
    tag_commit = git_text('rev-parse', 'v4.4.4^{commit}')
    upstream = git_text('rev-parse', 'upstream/master')
    installed_head = subprocess.run(['git', '-C', INSTALLED, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
    installed_branch = subprocess.run(['git', '-C', INSTALLED, 'rev-parse', '--abbrev-ref', 'HEAD'], capture_output=True, text=True).stdout.strip()
    runtime_files = []
    for path in git_text('ls-tree', '-r', '--name-only', 'v4.4.4').splitlines():
        if path in RUNTIME_ROOT or path.startswith(RUNTIME_DIRS):
            runtime_files.append(path)
    rows = []
    missing, diff, identical = [], [], []
    for path in runtime_files:
        vsha = sha_bytes(git('show', 'v4.4.4:' + path))
        ip = os.path.join(INSTALLED, path)
        if not os.path.exists(ip):
            status = 'missing'
            isha = None
            missing.append(path)
        else:
            isha = file_sha(ip)
            status = 'identical' if isha == vsha else 'different'
            (identical if isha == vsha else diff).append(path)
        rows.append({'path': path, 'v4_4_4_sha256': vsha, 'installed_sha256': isha, 'status': status})
    extras = []
    known = set(runtime_files)
    for d in ('js', 'score', 'shadow', 'css', 'assets', 'model'):
        base = os.path.join(INSTALLED, d)
        if not os.path.isdir(base):
            continue
        for dirpath, _, files in os.walk(base):
            for name in files:
                rel = os.path.relpath(os.path.join(dirpath, name), INSTALLED).replace(os.sep, '/')
                if rel not in known:
                    extras.append(rel)
    core = []
    for path in CORE_FILES:
        vsha = sha_bytes(git('show', 'v4.4.4:' + path))
        ip = os.path.join(INSTALLED, path)
        isha = file_sha(ip) if os.path.exists(ip) else None
        core.append({'path': path, 'v4_4_4_sha256': vsha, 'installed_sha256': isha, 'identical': isha == vsha})
    doc = {
        'schema_version': '2.0',
        'scope_note': '本文件是本地试验安装前的安装目录基线；安装后的运行时策略文件见 live-install/manifest.json。',
        'generated_by': 'tools/build-skill-ai-baseline.py',
        'generated_at': '2026-10-30',
        'tag': 'v4.4.4',
        'tag_object': tag_object,
        'v4_4_4_tag_commit': tag_commit,
        'upstream_master_commit': upstream,
        'tag_resolution': 'git rev-parse v4.4.4 返回 annotated tag 对象；真正的提交用 v4.4.4^{commit}。旧版脚本误用了前者的 SHA 22cf379。',
        'installed_extension_dir': INSTALLED,
        'installed_git_head': installed_head,
        'installed_git_branch': installed_branch,
        'host': {
            'app_package_version': '1.11.0',
            'runtime_lib_version': '1.11.7（真实宿主探针 lib.version）',
            'core_path': r'C:/Users/32360/Desktop/无名杀-win32-x64/resources/app',
        },
        'runtime_scope': {
            'include': sorted(RUNTIME_ROOT) + [d + '**' for d in RUNTIME_DIRS],
            'exclude': {
                'backend/': '服务端代码，扩展客户端不加载',
                'artifacts/': '训练/归档产物，扩展端零引用',
                'docs/': '文档',
                'tools/': '测试/工具，扩展运行时不加载',
                'tests/': '测试',
                'dist/': '打包产物',
                '.github/': 'CI 配置',
                'data/': '运行时生成的数据，不是发布源文件',
                'logs/': '运行时生成的日志',
                'README.md/CHANGELOG.md/LICENSE/CONTRIBUTING.md/PR7D_UPDATE.md': '仓库文档/许可，不是运行时模块',
            },
            'total_v4_4_4_runtime_files': len(runtime_files),
        },
        'installed_runtime_equals_v4_4_4': len(missing) == 0 and len(diff) == 0 and len(extras) == 0,
        'installed_runtime_summary': {
            'total': len(runtime_files),
            'identical': len(identical),
            'different': len(diff),
            'missing': len(missing),
            'extra': len(extras),
        },
        'missing_files': missing,
        'different_files': diff,
        'extra_files': extras,
        'known_delta': {
            'path': 'score/model/net/client_policy_model_v2.js',
            'status': 'missing_in_installed_tree',
            'v4_4_4_size': 7038938,
            'reason': 'v4.4.3 手机端瘦包排除的 6.9MB v2 模型包；CHANGELOG 称无运行时 import。',
            'latent_gap': 'score/model/net/policyModelV2.js:33 仍有动态 import；但 policyModelV2 适配器没有从运行入口被引用（score/index.js 加载的是 policyModelV3），因此当前运行不可达。若以后手动加载 policyModelV2，会缺文件。',
        },
        'core_files': core,
        'runtime_files': rows,
        'proposal_upstream_baseline': 'libnoname/noname b481b17552dd46e7d9ca805d5d7975b742168256（原方案参考；不是本机宿主版本）',
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(json.dumps({
        'tag_object': tag_object,
        'tag_commit': tag_commit,
        'strict_equal': doc['installed_runtime_equals_v4_4_4'],
        'summary': doc['installed_runtime_summary'],
        'missing': missing,
        'different': diff,
        'extra': extras[:10],
        'written': OUT,
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
