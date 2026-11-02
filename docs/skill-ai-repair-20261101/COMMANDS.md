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
node tests/run-package-tests.mjs     # 纯规则 42 条 + 架构/134维契约 16 条 + 安装/回滚 13 条
python tests/test-verify-zip.py      # verify.py --zip 跨平台路径回归（POSIX/Windows 反斜杠/重复成员/尺寸）
python verify.py                     # 校验解压目录
python verify.py --zip feisheng-ai-skill-audit-repair-20261101.zip
```

## 1. 纯 Node 回归（无需浏览器）

```bash
node --experimental-vm-modules tools/test-skill-ai-policies.mjs        # 42 PASS（含补修 12 条）
node --experimental-vm-modules tools/test-skill-ai-architecture.mjs    # 16 PASS（含分包归属/134维契约/注册表唯一性）
node tools/test-pack-install.mjs                                      # 13 PASS（预存行缺模块/失败注入/重复安装/共存/乱序回滚/冲突）
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
    --seed 20261030 --output postfix-range-$v.json
  node tools/verify-repair-outcomes.mjs --evidence postfix-range-$v.json --variant $v
done
# 运行器默认抑制宿主 game.over 胜负对话框（--allow-game-over 可关闭）：
# 技能机制场景若把所有反贼杀光，宿主会提前进入结算 UI，die 事件不返回；
# 这是夹具问题，不是策略缺陷。Worker 心跳/CDP CPU 默认开启（--no-diag 关闭）；
# --trace 额外记录事件栈 ticker、技能/chooseNumbers/loseHp/useCard/game.loop 阶段 mark。
# 长套件可用 --browser-restart-every N 每 N 场景重启浏览器，排除累积渲染进程状态；
# 宿主初始化单独用 --init-timeout-ms（默认 90s，与场景 watchdog 分开），并输出 [hp][init] 阶段日志；
# 夹具陷阱会以 fixture-stalled-in-die-after-last-enemy 快速失败，不再等满看门狗。
node tools/skill-ai-hp-real-host.mjs --mode identity --variant extension \
  --scenario reqimou-multi3-pay2-killab --watchdog-ms 90000 --seed 20261030 --trace \
  --host-root "$HOST" --extension-root "$EXT" --browser "$CHROME" --playwright "$PW" \
  --output diag-ext-multi3.json
```

历史超时/重跑不删除：`postfix-range-native-presuppress-partial.log` 保留夹具修正前的失败尝试；
最终报表以 `repair-acceptance-ledger.md` 的 initial/retest/postfix 分列。不能只提高超时阈值或反复重跑直到成功。

神话再临·风 12 项登记技能逐技能固定局面（原生/扩展对照；redimeng 使用 `out_of_scope` 场景）：

```bash
SC_REVIEW="shenhua-releiji-target,shenhua-guidao-replace,shenhua-guidao-decline,shenhua-huangtian-give,shenhua-huangtian-negative,shenhua-guhuo-claim,shenhua-guhuo-ai-use,shenhua-guhuo-real-questioned,shenhua-guhuo-fake-questioned,shenhua-guhuo-phase,shenhua-shensu-skip,shenhua-shensu-negative,shenhua-tianxiang-redirect,shenhua-tianxiang-negative,shenhua-hongyan-suit,shenhua-kuanggu-draw,shenhua-kuanggu-recover,shenhua-jushou-4hp-empty,shenhua-jushou-lowhp,shenhua-buqu-damage,shenhua-buqu-negative,shenhua-buqu-recover-choice,shenhua-liegong-hit,shenhua-liegong-negative"
node tools/trick-real-host-smoke.mjs --mode identity --skill-ai --skill-ai-extension --scenes "$SC_REVIEW" \
  --host-root "$HOST" --extension-root "$EXT" --browser "$CHROME" --playwright "$PW" \
  --output shenhua-feng-review.json
# 去掉 --skill-ai-extension 再跑一次为原生对照
node tools/compare-shenhua-feng-review.mjs shenhua-feng-review-native.json shenhua-feng-review.json shenhua-feng-review-compare.json
# 奇谋场景会改变后续 AI 决策上下文；acceptance 会把非奇谋固定局面与奇谋场景分成两个宿主进程运行。
# 断言覆盖：AI 目标/声明/支付、真实结算、正反向分支；红颜为纯被动规则验证。
```

神话再临·火首轮与最终场景（2026-11-02）：

```bash
# 首轮 10 场景（保留历史证据）：7 项有实际发动/结算，luanji/huoji 保守局面未发动，
# bazhen/kanpo/mashu/xueyi 只验证前置或被动规则。
SC_HUO_FIRST="shenhua-huo-quhu-compare,shenhua-huo-jieming-damage,shenhua-huo-oldniepan-dying,shenhua-huo-tianyi-compare,shenhua-huo-shuangxiong-judge,shenhua-huo-luanji-wanjian,shenhua-huo-jianchu-sha,shenhua-huo-lianhuan-tiesuo,shenhua-huo-huoji-red,shenhua-huo-passive-rules"
node tools/trick-real-host-smoke.mjs --mode identity --skill-ai --scenes "$SC_HUO_FIRST"   --host-root "$HOST" --extension-root "$EXT" --browser "$CHROME" --playwright "$PW"   --output shenhua-huo-review-native-1.json

# 最终主组（37 场景；含 10 个连环固定局面；乱击/火计正向单独进程，避免跨场景 AI 状态污染）：
SC_HUO_MAIN="hp-qiangxix-2hp-target1,hp-qiangxix-2hp-weapon-target2,shenhua-huo-quhu-compare,shenhua-huo-quhu-no-target,shenhua-huo-quhu-risky-decline,shenhua-huo-jieming-damage,shenhua-huo-jieming-no-benefit,shenhua-huo-lianhuan-tiesuo,shenhua-huo-lianhuan-ally-risk,shenhua-huo-lianhuan-recast,shenhua-huo-lianhuan-unlink-ally-risk,shenhua-huo-lianhuan-keep-enemy-linked,shenhua-huo-lianhuan-full-linked-recast,shenhua-huo-lianhuan-link-enemies,shenhua-huo-lianhuan-unlinked-ally-only,shenhua-huo-lianhuan-self-linked,shenhua-huo-lianhuan-recast-blocked,shenhua-huo-oldniepan-dying,shenhua-huo-oldniepan-tao,shenhua-huo-tianyi-compare,shenhua-huo-tianyi-win-sha,shenhua-huo-tianyi-lose-sha,shenhua-huo-tianyi-lose-content,shenhua-huo-shuangxiong-judge,shenhua-huo-shuangxiong-duel,shenhua-huo-shuangxiong-no-judge,shenhua-huo-luanji-wanjian,shenhua-huo-luanji-no-pair,shenhua-huo-huoji-red,shenhua-huo-huoji-no-red,shenhua-huo-kanpo-response,shenhua-huo-kanpo-no-black,shenhua-huo-bazhen-bagua,shenhua-huo-bazhen-armor-negative,shenhua-huo-jianchu-sha,shenhua-huo-jianchu-no-equip,shenhua-huo-passive-rules"
# acceptance 的 groupOf 会额外把 shenhua-huo-luanji-wanjian-use / shenhua-huo-huoji-use 各拆成独立宿主进程。

# 连环边界 10 场景（原生/扩展逐场景；预期 semantic_all=true、exact_all=true）：
SC_LIANHUAN="shenhua-huo-lianhuan-tiesuo,shenhua-huo-lianhuan-ally-risk,shenhua-huo-lianhuan-recast,shenhua-huo-lianhuan-unlink-ally-risk,shenhua-huo-lianhuan-keep-enemy-linked,shenhua-huo-lianhuan-full-linked-recast,shenhua-huo-lianhuan-link-enemies,shenhua-huo-lianhuan-unlinked-ally-only,shenhua-huo-lianhuan-self-linked,shenhua-huo-lianhuan-recast-blocked"

# 风包比较断言负向测试（9 条）：
node tools/test-shenhua-feng-compare.mjs
# 最终合并对照（39 场景；预期 semantic_all=true、exact_all=false，仅重铸后随机摸牌差异，无策略差异）：
node tools/compare-shenhua-feng-review.mjs shenhua-huo-review-native.json shenhua-huo-review.json shenhua-huo-review-compare.json
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

## 6. 合并验收台账、分包构建与逐包验收

```bash
node tools/build-skill-ai-acceptance-ledger.mjs \
  --evidence-dir "C:/Users/32360/Desktop/repair-baseline/evidence" \
  --out "C:/Users/32360/Desktop/repair-baseline/evidence/repair-acceptance-ledger.json"
node tools/build-pack-acceptance-matrix.mjs \
  --dir "C:/Users/32360/Desktop/repair-baseline/evidence" \
  --out "C:/Users/32360/Desktop/repair-baseline/evidence/pack-acceptance-matrix.json"

# 构建器使用 PATH 中 git；仓库/证据/输出/stage 均可配置
node tools/build-skill-ai-pack.mjs --pack refresh_standard \
  --repo "$EXT" --evidence "C:/Users/32360/Desktop/repair-baseline/evidence" \
  --out "C:/Users/32360/Desktop/feisheng-ai-packs" \
  --stage-root "C:/Users/32360/Desktop/repair-baseline/pack-stage"
node tools/build-skill-ai-pack.mjs --all ...   # 全部分包阶段包
node tools/build-skill-ai-pack.mjs --all ... --worktree-source   # 仅测试，不用于正式交付

# 实际 ZIP 逐包验收（解压/包内测试/干净副本安装/技能场景/卸载/重装/134维）
# --scenes 指定该包对应技能的真实宿主场景；--baseline-dir 让组合验收逐包对照单包签名。
node tools/accept-skill-ai-pack.mjs --zip <pack.zip> --repo "$EXT" \
  --scenes <scene1,scene2> --host-root "$HOST" --browser "$CHROME" --playwright "$PW" \
  --workdir <临时目录> --out <evidence>/accept-<pack>.json
# 多 ZIP 一起传：额外验证共存、他人注册行保留、乱序回滚、单包/组合契约分列
node tools/accept-skill-ai-pack.mjs --zip a.zip --zip b.zip ... \
  --scenes <所有包场景并集> --baseline-dir <evidence> --baseline-prefix accept- \
  --out accept-combined.json
# 上游 v4.4.4 干净副本：先验证未应用 score/index.diff 时 apply 拒绝，
# 再应用补丁、安装、宿主场景、卸载/回滚；--base-ref 1fe5292 --prefix accept-upstream-
node tools/run-pack-acceptance-all.mjs --packs-dir <packs> --evidence <evidence> \
  --repo "$EXT" --host-root "$HOST" --browser "$CHROME" --playwright "$PW" \
  --base-ref 1fe5292 --prefix accept-upstream-
# 不抑制 game.over 的有界完整对局（独立于技能固定场景）
node tools/test-fullgame-settlement.mjs --host-root "$HOST" --extension-root "$EXT" \
  --browser "$CHROME" --playwright "$PW" --output <evidence>/fullgame-settlement.json
# 注意：逐包验收工具需要 --repo 指向完整无名AI仓库（含 tools/ 与宿主运行器），
# 主审查包内的 source/ 是子集，不能直接作为 --repo。
```

分包 ZIP 默认输出到仓库同级 `feisheng-ai-packs/`；每包内含集成/回滚脚本、checklist、原始证据、manifest 与 verify.py。
`apply-pack.mjs` 预检注册表依赖并备份将被修改文件；失败自动恢复，重复安装幂等；回滚最后一个包保留空注册表。
`DJSC_PACK_TEST_FAIL_AFTER=<n>` 仅用于失败注入测试。

## 7. 完整性校验与打包

```bash
node tools/build-repair-package.mjs          # 生成 staging + manifest.json
python verify.py                             # 校验 staging 目录
# 压缩 staging 为 feisheng-ai-skill-audit-repair-20261101.zip 后：
python verify.py --zip feisheng-ai-skill-audit-repair-20261101.zip
```

**注意**：本补修不推送、不发版、不覆盖正式安装目录；`tools/` 下全部为测试件，不进入安装目录运行时路径。
