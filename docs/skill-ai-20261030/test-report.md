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

结果：**40 个入口全部 exit=0，0 FAIL**。带计数的代表结果：

| 测试 | 结果 |
|---|---:|
| test-skill-ai-policies（本次新增，纯规则） | 10 PASS |
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
  --output "$TEMP/skill-ai-native.json"

# 仅策略层
node tools/trick-real-host-smoke.mjs --mode identity --skill-ai --skill-ai-policy \
  --host-root "$HOST" --extension-root "$EXT" --browser "$CHROME" --playwright "$PW" \
  --output "$TEMP/skill-ai-policy.json"

# 完整扩展
node tools/trick-real-host-smoke.mjs --mode identity --skill-ai --skill-ai-extension \
  --host-root "$HOST" --extension-root "$EXT" --browser "$CHROME" --playwright "$PW" \
  --output "$TEMP/skill-ai-extension.json"
```

场景结果（原生 → 完整扩展）：

| 场景 | 原生行为 | 优化后 | 判定 |
|---|---|---|---|
| 界孙权 3血 [桃,杀,杀] | 全手换牌，弃桃+两杀，摸4 | 保留桃，弃两杀，摸2 | 已修复；4血负向对照不变 |
| 周妃旧版箜声：已有1张箜，3张无懈，受伤队友1手 | 成本AI选3张无懈 | 只选1张，命中良姻回复阈值 | 已修复（数组+数字笔误） |
| 界鲁肃 redimeng：混合池[桃,杀,闪,无中] | 第一个选择者拿走桃+无中 | 公平分配为[闪,桃]/[杀,无中] | 已修复（隐藏牌面） |
| 界张辽 new_retuxi：敌人手牌 1/4/2 | 选1+2，跳过4 | 选4+2 | 已修复（目标收益） |
| 标准张辽 tuxi：只有队友有手牌 | 放弃发动，正常摸2 | 不变 | 验证无问题 |
| 标准刘备 rende：敌人空手、队友3手 | 把牌给队友并回复1血 | 不变 | 验证无问题 |
| 标准鲁肃 dimeng：队友1手/敌人3手 | 正确交换，只读公开数量 | 不变 | 验证无问题 |
| 标准周妃 kongsheng（新版） | 暂存数组/数量判断正常 | 不变 | 验证无问题（旧版 olkongsheng 另修） |
| 标准孙权 zhiheng 1血 [闪,桃] | 原生选中闪作为成本 | 策略的 ai.order 护栏命中（skippedOrder=1）；隔离夹具结算后置条件受宿主试探性选牌影响 | **部分通过，未宣称完整修复** |
| 标准黄盖 kurou 3血1手 | 发动，降到2血摸2 | 不变 | 待验证，无明显越权 |

## 4. 托管局性能

完整扩展，真实宿主，自动托管直到 `game.over` 或 180s 上限；耗时取 `engine.getDecisionLog()[].elapsedMs`（决策入口 `bestAction`）。每模式合并多局样本。

```bash
node tools/trick-real-host-smoke.mjs --mode identity --autoplay --host-root "$HOST" --extension-root "$EXT" --browser "$CHROME" --playwright "$PW" --output "$TEMP/identity.json"
node tools/trick-real-host-smoke.mjs --mode doudizhu --autoplay ...
node tools/trick-real-host-smoke.mjs --mode versus --autoplay ...
```

| 模式 | 局数/完成 | 决策样本 | p50 | p95 | p99 | 最大 | 备注 |
|---|---:|---:|---:|---:|---:|---:|---|
| 身份 | 2 局，1 完成 1 到 180s 上限 | 40 | 32.0ms | 47.1ms | 50.4ms | 52ms | 超时局已 106 回合、无错误，仍在进行；不当作挂起 |
| 斗地主 | 3/3 完成 | 53 | 20.0ms | 33.8ms | 56.1ms | 66ms | 6–15 回合/局 |
| 2V2 | 3/3 完成 | 50 | 28.5ms | 61.0ms | 79.0ms | 81ms | 8–19 回合/局 |

结论：最坏单次决策 81ms，远低于硬接管 `800ms` 超时阈值；没有出现 `timeout`、`error`、`blocked` 或页面异常。样本量 40–53；p99 接近最大值，统计意义有限，后续应扩大样本。

策略纯规则微基准（`node tools/bench-skill-ai-policies.mjs`，20 万次，三项规则一批）：

| 指标 | 值 |
|---|---:|
| p50 | 0.3µs |
| p95 | 0.6µs |
| p99 | 1.9µs |
| 最大 | 3027µs（GC/调度噪声，单次离群；不在决策路径） |

场景总耗时（含清场、发牌、UI/延时/结算）p50 约 1.15s、p95 约 2.8s、最大 4.5s；这不是决策耗时，不能与上表混读。最慢场景 `rende-target` 约 4.5s，主要是宿主结算/动画/延时。

## 5. 测试基础设施能力与限制

已支持：

- 固定身份、座次、技能、手牌、体力、装备、标记和事件。
- 执行真实宿主入口：`chooseToUse`、`phaseDraw`、`phaseZhunbei`、`olkongsheng.cost`、`redimeng` 的 `chooseButton`。
- 记录选中的技能/牌/目标、结算后的公开手牌/体力/装备、策略命中计数、场景耗时。
- 原生/仅策略/完整扩展三种对照；同一夹具重复运行。
- 捕获页面异常、宿主错误、非法目标、队友误伤、错误支付等。

未覆盖/限制：

- 没有固定随机种子；卡牌抽取仍是真随机，**没有伪造理想摸牌**。固定的是局面和输入牌。
- 多数场景是单事件/单阶段，不是完整回合；标准孙权 zhiheng 的结算后置条件因此未作为完整通过。
- 身份局有 1 局到 180s 测试上限仍未结束；不能据此宣称长时间稳定性。
- 未跑 Android 真机长时多局；v4.4.4 的 Android 长时间稳定性仍未验收，本报告不宣传为全面性能验证。
- 未做联机/远端玩家测试；`redimeng` 公平钩子在联机禁用接管时不会安装。
- 2V2 只测了本地真实宿主的 4 人 two 队模式，未测联机 2V2。
