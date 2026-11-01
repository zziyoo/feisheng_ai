# 测试复现命令（2026-11-01 审查补修包）

宿主与路径按本补修环境记录；第三方复现时替换为等价环境（需无名杀 1.11.x 宿主、Chrome、Playwright）。

```bash
HOST="C:/Users/32360/Desktop/无名杀-win32-x64/resources/app"   # 无名杀宿主根（含 noname.js）
EXT="C:/Users/32360/.codex/worktrees/release-444/无名AI"        # 补修工作树（repair_commit 见 manifest.json）
CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe"
PW="C:/Users/32360/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
```

## 0. 包内可直接运行（仅需 Node，无需完整仓库/浏览器）

```bash
node tests/run-package-tests.mjs     # 纯规则 42 条 + 架构/134维契约 11 条
python tests/test-verify-zip.py      # verify.py --zip 多 manifest 回归（仅需 Python3）
python verify.py                     # 校验解压目录
python verify.py --zip feisheng-ai-skill-audit-repair-20261101.zip
```

## 1. 纯 Node 回归（无需浏览器）

```bash
node --experimental-vm-modules tools/test-skill-ai-policies.mjs        # 42 PASS（含补修 12 条）
node --experimental-vm-modules tools/test-skill-ai-architecture.mjs    # 11 PASS（含补修契约）
node tools/run-node-regressions.mjs                                    # 批一 41 项 Node 回归聚合
node tools/bench-skill-ai-policies.mjs                                 # 微基准（含 reqimou 支付评估）
node tools/test-policy-model-v2-reachability.mjs --root "$EXT"         # v2 不可达取证
```

## 2. 补修宿主场景组（21 场景 × 3 变体 + 程序化验收）

```bash
SC="qimou-far4-3sha-hp3,qimou-far3-2sha-hp2,qimou-far4-3sha-hp4,reqimou-near1-2sha-hp2,reqimou-near2-2sha-hp2,reqimou-far4-2sha-hp3,reqimou-far4-2sha-hp4-defense,reqimou-blocked-far4-hp3-3sha-tao-hp2,reqimou-blocked-far5-hp4-3sha-tao-hp2-horse,reqimou-far5-hp4-3sha-jiu-hp2-horse,reqimou-far5-hp4-3sha-wuxie-hp2-horse,reqimou-far4-hp4-3sha-tao-hp3-clampsave,reqimou-crossbow-far4-3sha-hp2,reqimou-crossbow-near1-2sha-hp2-idleskip,reqimou-multi2-pay1-killa,reqimou-multi3-pay2-killab,reqimou-far4-hp4-2sha-hp2-zhangba,reqimou-far5-hp4-2sha-hp2-zhangba-horse,reqimou-far3-hp4-2sha-hp2-chitu,reqimou-far4-hp4-2sha-hp2-noweapon,reqimou-far4-hp4-2sha-hp2-kongcheng"

for v in native policy extension; do
  node tools/skill-ai-hp-real-host.mjs --mode identity --variant $v --scenarios "$SC" --watchdog-ms 150000 \
    --host-root "$HOST" --extension-root "$EXT" --browser "$CHROME" --playwright "$PW" \
    --seed 20261030 --output repair-range-$v.json
  node tools/verify-repair-outcomes.mjs --evidence repair-range-$v.json --variant $v
done
# 看门狗超时属启动/时长抖动（批二包 flaky-retest 惯例）：单独重跑同场景并以
# --evidence 多文件合并验收（后者优先），见 REPAIR-REPORT 第七节。
```

## 3. 人类手动操作回归（真实点击路径）

```bash
node tools/reqimou-manual-ui.mjs --host-root "$HOST" --extension-root "$EXT" \
  --browser "$CHROME" --playwright "$PW" --seed 20261101 \
  --output repair-manual-ui.json
# 单用例调试：--case human-pick2（probe-ui/human-pick2/human-pick3/human-cancel-refire/
#   human-dialog-autotoggle/auto-clamp/uninstall-mid-dialog/uninstall-reinstall-lifecycle）
```

## 4. 三模式托管局

```bash
node tools/trick-real-host-smoke.mjs --mode doudizhu --autoplay --seed 20261031 \
  --host-root "$HOST" --extension-root "$EXT" --browser "$CHROME" --playwright "$PW" --output repair-mode-doudizhu.json
node tools/trick-real-host-smoke.mjs --mode versus  --autoplay --seed 20261031 \
  --host-root "$HOST" --extension-root "$EXT" --browser "$CHROME" --playwright "$PW" --output repair-mode-versus.json
```

## 5. 第一批宿主级套件（policy 变体）

```bash
node tools/trick-real-host-smoke.mjs --mode identity --skill-ai --skill-ai-policy --seed 20261030 \
  --host-root "$HOST" --extension-root "$EXT" --browser "$CHROME" --playwright "$PW" --output repair-suite-policy.json
```

## 6. 完整性校验与打包

```bash
node tools/build-repair-package.mjs          # 生成 staging + manifest.json
python verify.py                             # 校验 staging 目录
# 压缩 staging 为 feisheng-ai-skill-audit-repair-20261101.zip 后：
python verify.py --zip feisheng-ai-skill-audit-repair-20261101.zip
```

**注意**：本补修不推送、不发版、不覆盖正式安装目录；`tools/` 下全部为测试件，不进入安装目录运行时路径。
