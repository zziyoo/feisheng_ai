# 测试与实测报告（2026-10-30）

## 1. 环境

| 项 | 值 |
|---|---|
| 宿主 | 无名杀 `lib.version = 1.11.7`（app package 1.11.0） |
| 扩展 | 无名AI v4.4.4，`1fe5292eb3022dd8d1db494617b21a12be912e61` |
| 浏览器 | Chrome `156.0.8078.74`，Playwright 1.62.1，headless |
| Node | v24.14.0（Windows x64，Git Bash） |
| 测试模式 | 真实身份局 8 人、斗地主、2V2（4 人 two 队） |
| 隔离 | 临时浏览器上下文；只读文件服务；不读取本机 `noname.config.txt` |

## 2. 自动化回归

命令统一在 `C:/Users/32360/.codex/worktrees/release-444/无名AI` 下执行；使用 VM 模块的测试必须带 `--experimental-vm-modules`。

```bash
node --experimental-vm-modules tools/test-skill-ai-policies.mjs
node --experimental-vm-modules tools/test-skill-ai-architecture.mjs
node --experimental-vm-modules tools/test-regressions.mjs
node --experimental-vm-modules tools/test-2v2-reentry.mjs
node --experimental-vm-modules tools/test-response-lifecycle.mjs
node --experimental-vm-modules tools/test-weights.mjs
node --experimental-vm-modules tools/test-extension-shadow-lifecycle.mjs
node --experimental-vm-modules tools/test-guard-runtime-failure.mjs
node --experimental-vm-modules tools/test-ai-boundaries.mjs
node --experimental-vm-modules tools/test-trick-boundaries.mjs
node --experimental-vm-modules tools/test-policy-model-v3.mjs
node --experimental-vm-modules tools/test-mobile-performance.mjs
node --experimental-vm-modules tools/test-mobile-shadow.mjs
node --experimental-vm-modules tools/test-mobile-db.mjs
node --experimental-vm-modules tools/test-mobile-diagnostics.mjs
node --experimental-vm-modules tools/test-mobile-v5.mjs
node --experimental-vm-modules tools/test-mobile-v3-disable.mjs
node --experimental-vm-modules tools/test-2v2-aoe.mjs
node --experimental-vm-modules tools/test-2v2-attack-choice.mjs
node --experimental-vm-modules tools/test-2v2-context.mjs
node --experimental-vm-modules tools/test-2v2-friendly-fire.mjs
node --experimental-vm-modules tools/test-2v2-lethal.mjs
node --experimental-vm-modules tools/test-2v2-material-reserve.mjs
node --experimental-vm-modules tools/test-2v2-resource-reserve.mjs
node --experimental-vm-modules tools/test-2v2-seat-tactics.mjs
node --experimental-vm-modules tools/test-2v2-settings.mjs
node --experimental-vm-modules tools/test-2v2-team.mjs
node --experimental-vm-modules tools/test-cooperation-scope.mjs
node --experimental-vm-modules tools/test-response-material-packing.mjs
node --experimental-vm-modules tools/test-removal-cooperation.mjs
node --experimental-vm-modules tools/test-suggestion-fusion.mjs
node --experimental-vm-modules tools/test-wuxie-player-intent.mjs
node --experimental-vm-modules tools/test-manual-fire-control.mjs
node --experimental-vm-modules tools/test-jiedao-pair.mjs
node --experimental-vm-modules tools/test-jiedao-response.mjs
node --experimental-vm-modules tools/test-ingest-contract.mjs
node --experimental-vm-modules tools/test-decision-audit.mjs
node --experimental-vm-modules tools/test-decision-state-fingerprint.mjs
node --experimental-vm-modules tools/test-identity.mjs
node --experimental-vm-modules tools/test-friendly-strip-plan.mjs
node --experimental-vm-modules tools/test-utility-boundaries.mjs
```

结果：**41 个入口全部 exit=0，0 FAIL**。带计数的代表结果：

| 测试 | 结果 |
|---|---:|
| test-skill-ai-policies（本次新增，纯规则） | 14 PASS |
| test-skill-ai-architecture（本次新增，134 维/接线契约） | 8 PASS |
| test-regressions（自报） | PASS 94 / FAIL 0 |
| test-response-lifecycle | 45 passed / 0 failed |
| test-weights | ALL PASS (637) |
| test-extension-shadow-lifecycle | 7 PASS |
| test-guard-runtime-failure | 2 PASS |
| test-ai-boundaries | 12 passed / 0 failed |
| test-trick-boundaries | 22 passed / 0 failed |
| test-policy-model-v3 | PASS 25 / FAIL 0（文件另有汇总行） |
| test-identity | 44 passed / 0 failed |
| test-decision-audit | 32 passed / 0 failed |
| test-decision-state-fingerprint | 13 passed / 0 failed |
| test-friendly-strip-plan | 15 passed / 0 failed |
| test-utility-boundaries | 7 passed / 0 failed |
| 2V2 系列 10 个入口 | 全部 PASS（attack-choice 17、settings 9、其余 PASS 型） |
| 移动端 5 个入口 | 全部 PASS（performance 12、shadow/db/diagnostics/v5 各 1） |
| 响应/配合/借刀/无懈 | 全部 PASS（45、16、17、17、19、20、8、22、17 等） |

说明：直接运行 3 个 VM 测试（`test-extension-shadow-lifecycle`、`test-mobile-performance`、`test-mobile-shadow`、`test-mobile-db`）会报 `vm.SyntheticModule is not a constructor`；这是缺少 `--experimental-vm-modules` 的调用方式问题，补参数后全部通过。没有代码回归。

## 3. 真实宿主技能场景

场景文件：`tools/skill-ai-host-scenes.mjs`；运行器：`tools/trick-real-host-smoke.mjs --skill-ai`。

```bash
PW="C:/Users/32360/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe"
HOST="C:/Users/32360/Desktop/无名杀-win32-x64/resources/app"
EXT="C:/Users/32360/.codex/worktrees/release-444/无名AI"

# 原生基线
node tools/trick-real-host-smoke.mjs --mode identity --skill-ai \
  --host-root "$HOST" --extension-root "$EXT" --browser "$CHROME" --playwright "$PW" \
  --seed 20261030 --output "$TEMP/skill-ai-native.json"

# 仅策略层
node tools/trick-real-host-smoke.mjs --mode identity --skill-ai --skill-ai-policy \
  --host-root "$HOST" --extension-root "$EXT" --browser "$CHROME" --playwright "$PW" \
  --seed 20261030 --output "$TEMP/skill-ai-policy.json"

# 完整扩展
node tools/trick-real-host-smoke.mjs --mode identity --skill-ai --skill-ai-extension \
  --host-root "$HOST" --extension-root "$EXT" --browser "$CHROME" --playwright "$PW" \
  --seed 20261030 --output "$TEMP/skill-ai-extension.json"
```

场景结果（原生 → 完整扩展）：

| 场景 | 原生行为 | 优化后 | 判定 |
|---|---|---|---|
| 界孙权完整 phaseUse：3血/max3 [桃,杀,杀] | 弃桃+两杀，摸3 | 弃两杀、保留桃，摸1 | 已修复；完整回合 |
| 界孙权 1/2血、只桃/只闪、含回复、防具 | 低血可能弃防御 | 保留桃/闪，只弃非防御；4血仍全手换牌 | 已修复；4血负向对照 |
| 周妃旧版箜声：1张箜、3张无懈、受伤队友1手 | 成本AI选3张无懈 | 选1张；重复调用 [1,1]；异常后作用域恢复 | 已修复（数组+数字）；宿主指纹保护 |
| 界鲁肃 redimeng：混合池[桃,杀,闪,无中] | 第一个选择者拿走桃+无中 | 公平分配；同位置置换牌面后两次选择索引一致（seed 20261030 下 (2,3)/(0,1)） | 已修复（隐藏牌面） |
| 界张辽 new_retuxi：敌人手牌 1/4/2 | 选1+2，跳过4 | 选4+2；屯田目标 0 失牌 | 已修复（目标收益） |
| 界张辽：只有友方、单目标、零目标、中立目标 | 原生放弃/正常摸牌 | 不变，友方手牌不被拿 | 验证无问题；没有加发动护栏 |
| 标准张辽 tuxi：只有队友有手牌 | 放弃发动，正常摸2 | 不变 | 验证无问题 |
| 标准刘备 rende：敌人空手、队友3手 | 把牌给队友并回复1血 | 不变 | 验证无问题 |
| 标准鲁肃 dimeng：队友1手/敌人3手 | 正确交换，只读公开数量 | 不变 | 验证无问题 |
| 标准周妃 kongsheng（新版） | 暂存数组/数量判断正常 | 不变 | 验证无问题（旧版另修） |
| 标准孙权完整 phaseUse：3血/1血/击杀/防具 | 3血弃两杀保留桃；1血先用桃；击杀/防具正常 | 不做策略改动 | 验证无问题；上一轮“选闪”是隔离夹具假象 |
| 响应入口（武圣+决斗） | 用【杀】响应，保留【桃】，体力不变 | 响应历史非空 | 通过（真实 chooseToRespond） |
| 策略层卸载/重装 | — | policy-lifecycle true→false→true；full-engine-lifecycle false→true | 通过 |
| 启用门禁 | — | `isScoreEngineEnabled` true→false→true | 通过 |

## 4. 托管局性能

完整扩展，真实宿主，自动托管直到 `game.over` 或 180s 上限；耗时取 `engine.getDecisionLog()[].elapsedMs`（决策入口 `bestAction`）。每模式合并多局样本。

```bash
node tools/trick-real-host-smoke.mjs --mode identity --autoplay --host-root "$HOST" --extension-root "$EXT" --browser "$CHROME" --playwright "$PW" --output "$TEMP/identity.json"
node tools/trick-real-host-smoke.mjs --mode doudizhu --autoplay ...
node tools/trick-real-host-smoke.mjs --mode versus --autoplay ...
```

| 模式 | 局数/完成 | 决策样本 | p50 | p95 | p99 | 最大 | 备注 |
|---|---:|---:|---:|---:|---:|---:|---|
| 身份 | 3 局（2 完成；1 旧版 runner 到 180s 上限） | 44 | 37.0ms | 171.1ms | 194.7ms | 199ms | 含 4 个 live 样本；超时局已 106 回合/112 用牌，未标记停滞 |
| 斗地主 | 4/4 完成 | 73 | 23.0ms | 63.6ms | 74.5ms | 81ms | 6–15 回合/局 |
| 2V2 | 4/4 完成 | 65 | 32.0ms | 100.0ms | 135.5ms | 147ms | 7–19 回合/局 |

结论：本轮观测最坏单次决策 199ms，仍低于硬接管 `800ms` 超时阈值；`overrideStats` 未出现 `timeout`/`error`，live 局的 stall/timeout 标记均为空。样本量 44–73，且包含机器负载不同的多轮运行（live 样本含策略钩子，早期样本为引擎-only），p99 不能视为长期性能保证；后续需在固定机器和更多局数下复测。

停滞/超时区分：新版 runner 每 20s 采样 `phases/uses/event/paused`，同类状态持续 60s 才标记 `stalled`；到 180s 仍未 `done` 标记 `timedOut`。旧版那次 180s 身份局已到 106 回合/112 用牌，未显示停滞迹象，但当时还没有该诊断字段，只能按“长局到测试上限”记录。

策略纯规则微基准（`node tools/bench-skill-ai-policies.mjs`，20 万次，三项规则一批）：

| 指标 | 值 |
|---|---:|
| p50 | 0.3µs |
| p95 | 0.6µs |
| p99 | 1.9µs |
| 最大 | 3027µs（GC/调度噪声，单次离群；不在决策路径） |

场景总耗时（含清场、发牌、UI/延时/结算）p50 约 1.15s、p95 约 2.8s、最大 4.5s；这不是决策耗时，不能与上表混读。最慢场景 `rende-target` 约 4.5s，主要是宿主结算/动画/延时。

### 4.1 本地试验安装验证

- 部署集合：`git diff --name-only 1fe5292..116af5f -- score js shadow css assets model extension.js info.json` 只有 3 个文件：`score/index.js`、`score/decision/skills/skillAIPolicies.js`、`score/decision/skills/skillAIPolicyRules.js`。
- 安装前：安装目录 `score/index.js` 归一化 SHA256 = `a2fa58e4...`（与 v4.4.4 一致）；两个策略文件不存在。
- 安装后：3 个文件与 `116af5f` 的 blob 一致；`live-install/manifest.json` 记录了 pre/post 哈希与备份路径。
- 用**安装目录本身**作为 extension-root 跑 40 个场景：`status=passed`、`errors=[]`；`policyStats`：`keptTao=18`、`keptShan=3`、`fairRedimeng=9`、`retuxiTargetBonus=14`、`olkongshengCostCalls=4`、`redimengMaskFailed=0`。
- `policy-lifecycle`：true → uninstall false → reinstall true；`full-engine-lifecycle`：uninstall false → reinstall true，`error=null`。
- 回滚：`python tools/rollback-skill-ai-live.py` 先打印计划，确认后加 `--apply`；会校验当前/备份哈希后再恢复/删除。
- 未改版本号、更新公告、发布标签；这是本地试验安装，不是公开发行。

## 5. 测试基础设施能力与限制

已支持：

- 固定身份、座次、技能、手牌、体力、装备、标记和事件。
- 执行真实宿主入口：`chooseToUse`、`phaseDraw`、`phaseZhunbei`、`olkongsheng.cost`、`redimeng` 的 `chooseButton`。
- 记录选中的技能/牌/目标、结算后的公开手牌/体力/装备、策略命中计数、场景耗时。
- 原生/仅策略/完整扩展三种对照；同一夹具重复运行。
- 捕获页面异常、宿主错误、非法目标、队友误伤、错误支付等。
- `--seed 20261030`：在页面加载前替换 `Math.random`，同一 seed 的两次 policy-only 运行在制衡、缔盟、箜声、突袭、响应、门禁等关键场景输出一致；不伪造摸牌结果。

未覆盖/限制：

- 没有固定随机种子；卡牌抽取仍是真随机，**没有伪造理想摸牌**。固定的是局面和输入牌。
- 新增长场景包含完整 `phaseUse`（标准/界制衡、击杀、防具、回复机会）；但敌方回合/濒死救援仍不是每个技能都有完整回合。
- 身份局有 1 局到 180s 测试上限仍未结束；新版已能标记 `stalled`/`timedOut`，但不能据此宣称长时间稳定性。
- 未跑 Android 真机长时多局；v4.4.4 的 Android 长时间稳定性仍未验收，本报告不宣传为全面性能验证。
- 未做联机/远端玩家测试；`redimeng` 公平钩子在联机禁用接管时不会安装。
- 2V2 只测了本地真实宿主的 4 人 two 队模式，未测联机 2V2。
