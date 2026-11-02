# 无名AI第二批技能优化——第三方独立审查补修报告

- 补修基线：`3bb24347710c8fac192a0d96196a9a1f479a4af1`（批二审查包 head，tag `skill-ai-20261031`）
- 补修提交：见 `manifest.json` 的 `repair_commit`（独立补修提交，不含第三批内容）
- 宿主：无名杀 1.11.7 · 扩展版本 4.4.4 · 日期：2026-11-01
- 范围：只针对独立审查指出的 1 项策略退化（P1）、1 项目标选择风险（P1-2）、1 项无限出杀次数处理缺口（P2）、1 项人类操作回归缺口。不启动第三批技能优化，不改变原生技能规则。

---

## 一、结论（先行）

| 问题 | 状态 | 修复位置 |
| --- | --- | --- |
| P1 reqimou 阻止可兑现击杀 | **已修复**（宿主复现场景转绿） | `skillAIPolicyRules.js` `reqimouOptimalX` 自救上限；`skillAIPolicies.js` `_reqimouSaveCount` |
| P1-2 支付档位与实际攻击目标不一致 | **已修复**（改为全回合收益档位 + 净收益闸） | `skillAIPolicyRules.js` `reqimouKillBenefit` + `reqimouOptimalX` 机会成本 |
| P2 `getCardUsable` 返回 Infinity | **已修复**（四态处理） | `skillAIPolicies.js` `_reqimouBaseUses`；规则层 `interpretBaseUses` |
| 人类手动操作回归缺失 | **已补齐**（真实 UI 点击路径） | 新增 `tools/reqimou-manual-ui.mjs`（7 用例） |
| 分包化后 reqimou/blocked-far5 超时 | **已定位为夹具 `game.over` 陷阱并修正**；不是策略缺陷 | `tools/skill-ai-hp-real-host.mjs` 默认抑制胜负 UI；Worker 心跳/CDP CPU/事件栈证据 |

## 二、原始证据与复现

### P1：reqimou 阻止可兑现击杀（已复现）

审查原始证据（批二包 `evidence/batch2-range-policy.json`）场景 `reqimou-blocked-far5-hp4-3sha-tao-hp2-horse`：

- 角色 4 血、3 杀 + 1 桃；敌人距离 5（+1 马）、攻击范围 1、体力 2。
- 原生对照（`batch2-range-native.json`）：`processAI` 付 4（有桃付满）→ 濒死 → 桃自救回 1 → `reqimou2` 距离 -4 → 3 杀击杀。
- 策略版：`reqimouInfeasible: 3`、`after.dead` 为空（目标存活）。

根因：补修前的支付模型把上限锁死在 `hp-1`，没有建模原生 `processAI` 的合法路线“手中有桃/酒时支付全部体力、濒死后自救”。补修后（policy 变体，seed 20261030）：`reqimouPayments = {paid: 4}`、目标死亡、`reqimouSelfRescue ≥ 1`、`reqimouInfeasible = 0`。

旁证（同批二证据 run #5，`reqimou-blocked-far4-hp3-3sha-tao-hp2`）：AI 当时只是“先吃桃回血再付 hp-1”绕过了阻断，同一家族缺陷在满血场景（桃不能当回血牌）暴露为真实阻断。

### P1-2：支付档位与实际攻击目标不一致（已复现）

独立规则复现确认：`reqimouOptimalX` 对“敌人A 距离1 血1（需付1）、敌人B 距离4 血3（需付3）”返回 1（取全目标最小值）。问题分两层：

1. **收益口径**：最小值只保证最便宜的一个目标，与回合实际爆发收益脱钩（例如 4 杀时付 3 可兑现 A+B 两杀，旧模型仍付 1）。
2. **一致性**：支付档位与后续攻击目标由两套决策决定（支付在本策略、选目标在宿主出牌 AI），无法可靠绑定具体目标。

修复采用审查允许的“更合理的收益估计”路线：档位 = **能兑现最大确定击杀收益的最小档位**（收益 = 距离可达 ∩ 手杀可击杀 ∩ 次数足够的目标集合在预算 `min(手杀数, 支付后次数)` 内按血量升序贪心的击杀数），并叠加**机会成本闸**：最大可承受收益必须严格高于“不发动”的免费收益，否则不支付。该模型不绑定单一最容易攻击的目标，也绝不宣称预算覆盖不到的爆发收益（文档化于 `reqimouOptimalX` 注释）。

### P2：`getCardUsable` 返回 Infinity（已复核并修复）

宿主 1.11.7 事实（`noname/library/element/player.js`）：

```js
getCardUsable(card, pure) { ... num = game.checkMod(card, player, num, "cardUsable", player);
  if (typeof num != "number") return Infinity;
  if (!pure && _status.currentPhase == player) return num - player.countUsed(card); ... }
```

- 正常：`usable(1) − countUsed`（可为 0/负数）；
- 连弩（`card/standard.js` `zhuge_skill.mod.cardUsable` 标准模式返回 `Infinity`）与大量无限杀技能：返回 `Infinity`；
- 非数值：返回 `Infinity`。

补修前 `_reqimouBaseUses` 用 `Number.isFinite(num) && num >= 1` 判断，把 Infinity 与 0 都折成 1：`reqimouNeedsPayment` 把“次数已无限”误判为“需要为次数支付”，`reqimouOptimalX` 高估击杀所需档位。补修后区分四态：`Infinity`（次数不构成约束）、`≥0` 有限值（含 0=本回合已用完）、负数（按 0）、异常/未知（按原生静态口径回退 1）。

### 复现中发现的相邻缺陷（顺带修复，属 P1-2 同族）

多目标证据（policy 变体 `reqimou-crossbow-near1`）暴露：贴脸目标在连弩下**免费可杀**时，远处不可及目标仍会让 `reqimouNeedsPayment` 为真，策略为“免费可得的击杀”支付体力（净收益 0）。已由机会成本闸修复（`maxBenefit <= baselineBenefit → null`），并新增纯规则契约用例。

## 三、修复内容（最小改动）

### `score/decision/skills/skillAIPolicyRules.js`

1. 新增 `interpretBaseUses(value)`：出杀次数四态解释（Infinity/≥0/负数→0/异常→1）。
2. 新增 `reqimouKillBenefit(shaCount, baseUses, x, targets)`：支付 x 档位的确定击杀收益（纯静态口径：正收益 ∩ 无视距离合法 ∩ 手杀可击杀 ∩ 支付后距离可达 ∩ 支付后次数足够；预算 = min(手杀数, 支付后次数)，Infinity 次数时预算=手杀数；按血量升序贪心）。
3. 重写 `reqimouOptimalX`：
   - 上限：无自救牌 `hp-1`；`saveCount > 0`（自己手牌中 `canSaveCard` 为真的桃/酒数）时放宽到 `hp`（濒死自救）；
   - 档位：`maxBenefit = reqimouKillBenefit(…, maxPayment, …)`，取使收益等于 `maxBenefit` 的最小 x；
   - 机会成本：`maxBenefit <= reqimouKillBenefit(…, 0, …)`（不发动即可得的免费收益）时返回 `null`；
   - `null` 语义不变：调用方保留原生档位；gate 在“手杀可击杀但无净收益档位”时阻止无收益发动。
4. `reqimouNeedsPayment` 改用 `interpretBaseUses`（Infinity 不再构成支付理由，0 次构成）。

### `score/decision/skills/skillAIPolicies.js`

1. `_reqimouBaseUses`：`num === Infinity` 原样放行（计数 `reqimouInfiniteUses`），有限值 `max(0, floor(num))`，异常回退 1。
2. 新增 `_reqimouSaveCount(player)`：`player.countCards('hs', card => player.canSaveCard(card, player))`，与原生 gate 同口径，只读自己手牌，失败按 0 保守处理。
3. `_reqimouTargets` 每目标记录附带 `saveCount`（评估上下文，规则层从入参取）。
4. gate 与 clamp 两处 `reqimouOptimalX` 调用都传入 `saveCount`；stats 新增 `reqimouSelfRescue`、`reqimouInfiniteUses`。
5. 头部策略说明同步更新。**未改动**：技能规则、`filterCard/filterTarget`、chooseNumbers 一次性作用域、人类路径不 clamp。

### 测试与夹具（`tools/`）

- `test-skill-ai-policies.mjs`：30 → **42 条**（原 30 条全部保留并通过；新增自救上限 4 条、收益档位绑定 4 条、次数四态 4 条）。
- `test-skill-ai-architecture.mjs`：10 → **11 条**（原 10 条保留，其中 `candidate > maxPayment` 断言随实现演进更新为自救上限与收益档位断言；新增“次数四态与收益档位契约”）。
- `skill-ai-hp-real-host.mjs`：新增 7 个补修场景（jiu 自救 / wuxie 反向 / clampsave / 连弩×2 / 多目标×2）、`fanSeats`/`targets` 多目标夹具、`reqimouPayments` 支付探针、可参数化看门狗（`--watchdog-ms`，默认 90s）。修复两处夹具语义：目标座位强制为反贼（near1/near2/qimou-far3 曾被重构破坏）、连弩场景不带狂骨（无限出杀×黑判摸牌会形成超长出杀循环）、multi2 加第三反贼（8 血、不可及）避免“反贼全灭”触发 game.over 结算画面。
- 新增 `verify-repair-outcomes.mjs`（程序化验收，14 项断言 × 3 变体）、`run-node-regressions.mjs`（批一 41 项 Node 回归聚合入口）、`reqimou-manual-ui.mjs`（人类手动 UI 回归）、`build-repair-package.mjs`（本补修包构建）。
- `bench-skill-ai-policies.mjs`：新增 reqimou 支付评估微基准（3 目标 needsPayment + 2×optimalX p50 ≈ 2µs，p99 ≈ 8µs）。

## 四、测试与实测结果（原始证据见包内 evidence/）

| 验收项（审查第五节） | 结果 | 证据 |
| --- | --- | --- |
| 1. 包内独立规则及契约测试 | **42 条纯规则 + 15 条架构/134维契约全部 PASS** | `repair-package-tests.log` |
| 2. 第一批全部回归（41 项 Node） | **41/41 PASS** | `repair-node-tests.json` |
| 2b. 第一批宿主级套件（41+ 场景，policy 变体） | **PASS** | `repair-suite-policy.json` |
| 3. 第二批正向与反向宿主场景（21 场景 × 3 变体 + 程序化验收 14 项断言/变体） | **最终未解决 0**；初次成功 native 20/21、policy 19/21、extension 20/21；历史超时 native 9 次、policy 2 次、extension 1 次；末次尝试仍失败 1 次（native `reqimou-multi2-pay1-killa`，此前已有 2 次成功） | `repair-range-{native,policy,extension}.json` + `repair-flaky-retest-1..8.json` + `repair-final-retest-{native,policy,extension}.json` + `repair-acceptance-ledger.{json,md}` |
| 4. 有效击杀与不值得支付两类对照 | **PASS**（far5-tao/jiu 付满自救击杀；wuxie/空城/防御目标不支付或不承诺击杀） | 同上 |
| 5. 多目标支付及最终攻击结果验证 | **PASS**（双目标付1兑现A、B不可及且未对B出杀；三目标付2兑现两杀） | 同上 |
| 6. 无限杀次数与装备交互 | **PASS**（连弩 far4 付3减距离击杀；near1 免费+无限次数不提前支付；丈八/赤兔/绝影档位与纯规则一致） | 同上 |
| 7. 人类手动输入验证（真实点击） | **7 用例 + 7 断言全 PASS**：手动发动、选2/选3 结算一致、扩展不篡改（含高于AI最优档的选择）、结束回合放弃后重发动、对话框内切托管走原生 processAI、托管整回合 clamp 3→2、对话框内卸载、卸载/重装字节级还原 | `repair-manual-ui.json` |
| 8. 身份、斗地主及 2V2 兼容 | **PASS**（doudizhu/versus 完整托管对局烟测 passed；身份模式为上述全部场景） | `repair-mode-{doudizhu,versus}.json` |
| 9. 策略卸载、重装与回滚 | **PASS**（手动 UI 用例：content 字节级还原、重新挂载、对话框内卸载无崩溃） | `repair-manual-ui.json` |
| 10. 性能检查和 134 维模型契约 | **PASS**（微基准见上；134 维/版本/v2 未接线契约 11 条全过） | `repair-package-tests.log` |

### 人类操作回归的具体结论（审查第四节逐项）

- 人类手动发动 reqimou：真实点击技能按钮（宿主语义：`enable: phaseUse` 无目标技能点击即发动）→ 数字对话框 → 选值 → 确定。✅
- 自主选择不同体力支付值：选 1/2/3 结算值与输入一致（`storage.reqimou2`、`loseHp`、摸牌数三重一致）。✅
- 扩展启用后不篡改人类选择：人类打开的 `chooseNumbers` 不安装 clamp（`reqimouClampCalls=0`），选 3（高于 AI 最优档 2）结算仍为 3。✅
- 取消选择、重新发动及切换托管：reqimou 的数字对话框为强制（无取消按钮，宿主规则）；“放弃本次出牌”的真实控件是“结束回合”，放弃后重新进入出牌阶段可再次发动；数字对话框内切换托管 → 原生 `processAI`（hp-1）结算，策略不接管人类已打开的窗口（`reqimouClampCalls=0`）；托管整回合 → clamp 生效（3→2）且兑现致命。✅
- 异常、卸载与重新安装：卸载后 `lib.skill.reqimou.content` 字节级还原（两次卸载采样一致）、重装后钩子重新挂载（`__djscSkillPolicy` 标记）、数字对话框内卸载后结算仍与输入一致、全程无 pageerror。✅
- 实际结算值与人类输入一致：上述全部用例 `payments == [{paid: 输入值}]`。✅

## 五、与原生行为的差异声明（策略意图内）

1. **自救支付**：原生有桃/酒即付满（即使无收益）；策略仅在“付满能兑现更优确定击杀收益”时允许付满，且 clamp 只会下调 AI 的档位。`reqimou-blocked-far5-hp4-3sha-tao-hp2-horse` 两变体均击杀，支付一致（4）。
2. **免费击杀不支付**：贴脸目标在现有次数/射程下即可击杀（含连弩无限次数）时，策略阻止发动（`reqimouInfeasible`）；原生会支付 hp-1（crossbow-near1 native 对照付 3）。这是审查 P2 明确要求的修正。
3. **伤害/摸牌型发动不受干预**：目标静态不可击杀时（如八卦+闪的 4 血目标、手杀不足），策略保留原生发动（付 hp-1 换距离+伤害+摸牌）。与批二交付口径一致，审查未推翻。

## 六、未复现/不成缺陷的记录（与已复现缺陷分开）

1. **审查 P1-2 的“支付不足导致打不到 B”未复现为硬缺陷**：支付 1 后 B（距离4）不可及，宿主 `canUse` 会阻止对 B 出杀，不存在“支付与攻击目标不一致导致的非法结算”。真实风险是**收益机会成本**（少杀/白付），已由收益档位+机会成本闸修复；多目标宿主回合证据显示支付档位与最终击杀一致（双目标：付1杀A、B未被打；三目标：付2杀A+B）。
2. **`reqimou-blocked-far4-hp3-3sha-tao-hp2`（批二基线场景）在批二证据中目标已死亡**（AI 先吃桃回血绕过 gate），不构成“可兑现击杀被阻断”的实锤；补修后同场景由自救路径直达击杀，行为更直接。
3. **托管/人工路径的“取消”**：reqimou 数字对话框为宿主强制对话框（无取消），不属于可取消步骤；可取消点（出牌阶段放弃、重新发动）已用真实控件（“结束回合”）覆盖并记录。

## 七、已知限制与风险

1. **支付档位与实际攻击目标无法强绑定**：攻击目标由宿主出牌 AI 在支付之后决定（身份模式下扩展的致命目标评估仅接入 2V2）。收益档位保证“存在可兑现的击杀计划”，不保证宿主 AI 一定按计划消耗杀（如完整扩展引擎可能先用杀攻击其他射程内目标，此时 clamp 据实判断、不收紧）。extension 变体的多目标证据（付2兑现两杀）与该限制一致。
2. **击杀模型为静态确定口径**：不考虑闪/八卦概率（与原生 `get.effect` 口径一致）；防御性目标的“支付只买距离/伤害”行为不变。
3. **批次运行的看门狗超时（逐次保留，不覆盖）**：宿主完整加载 + 全回合演进的场景族存在启动/时长抖动。初次批次运行 top-level 状态为 failed：native 1 个超时、policy 2 个超时、extension 1 个超时；独立重跑（`repair-flaky-retest-1..8.json`，以及复核时的 `repair-final-retest-*.json`）最终让 21×3 个场景都至少成功一次（最终未解决 0）。但 native `reqimou-multi2-pay1-killa` 在最近一次 240s 独立重跑中仍超时，故“末次尝试失败”保留 1 次；它此前有 2 次成功证据，不能据此宣称该场景稳定。完整逐场景尝试见 `repair-acceptance-ledger.json`，其中“最终未解决”和“末次尝试失败”分开统计。
4. **.manual UI 套件依赖真实宿主 DOM**（技能按钮/数字 select/托管按钮），宿主 UI 结构变化需同步维护。

## 八、证据收尾、verify.py 与分包机制（2026-11-01 复核）

### 8.1 重跑证据补齐

原审查包只带了 `repair-range-*.json`，看不到重跑记录；本轮已找回并纳入：

- 初次批次：`repair-range-native.json`（20/21 成功，`reqimou-multi2-pay1-killa` 超时）、`repair-range-policy.json`（19/21，blocked-far5 与 clampsave 超时）、`repair-range-extension.json`（20/21，far4-2sha-hp3 超时）。
- 历史重跑：`repair-flaky-retest-1..8.json`（其中 2/3/6 仍含超时，未删除）。
- 复核重跑：`repair-final-retest-{native,policy,extension}.json`（policy 2/2、extension 1/1 成功；native 3/4 成功，multi2 仍超时）。
- 合并台账：`repair-acceptance-ledger.json` / `.md`，逐场景列出 initial → retest 的每一次状态、时间、错误，分别统计“最终未解决”与“末次尝试失败”。

最终计数：final-unresolved = 0/63；last-attempt-failures = 1/63（native multi2），该场景此前有 2 次成功证据。没有为了通过测试放宽断言；重跑只复跑同场景。

### 8.2 verify.py 跨平台路径

`verify.py` 现在先规范化 ZIP 成员/清单路径（`\`→`/`、`./`、盘符、目录项），再定位唯一包根 `manifest.json`；重复规范化成员、尺寸不符、缺失、多余均失败。回归 `python tests/test-verify-zip.py` 覆盖 POSIX、Windows 反斜杠、根 manifest、嵌套 manifest、重复成员、尺寸不符共 7 项，全部 PASS。

### 8.3 分包任务结构与打包机制

- `142-task-list.json` 升级为 schema 4.0：16 个真实分包（标准包 4 个版本组、神话再临 6 包、界限突破 5 包、清单外 1 类），每个分包独立状态；技能状态保留，分包状态由技能汇总，只有全包审查完成且无阻塞才 `可交付`。
- 共享核心 + 分包注册：`policyCore.js` 只负责安装/卸载/备份/统计；`packs/<id>.js` 只注册自己的技能；`rules/<id>.js` 为纯规则；`skillAIPolicyPacks.js` 的 marker 是唯一合并点。技能归属唯一性、分包互不 import、134 维契约由架构测试覆盖。
- `tools/build-skill-ai-pack.mjs` 按包生成独立 ZIP（代码、共享核心、patch、验收清单、原始证据、测试、manifest、verify.py、集成/回滚脚本）。当前生成 5 个**阶段性**包：
  - `feisheng-ai-refresh-standard.zip`
  - `feisheng-ai-shenhua-feng.zip`
  - `feisheng-ai-refresh-feng.zip`
  - `feisheng-ai-shenhua-lei.zip`
  - `feisheng-ai-out-of-scope.zip`
  它们都不是完整分包交付；未验证技能见各包 `checklist.md`。`apply-pack.mjs`/`rollback-pack.mjs` 已在临时扩展根上验证两包先后安装、回滚 A 保留 B、回滚 B 保留共享核心、重新安装 A。
- 安装/回滚事务化（2026-11-01 深夜补修，2026-11-02 补一致性）：apply 先预检注册表所有 `./packs/*.js` 导入真实存在、备份将被修改的注册表，再用临时文件+rename 写入；失败（含 `DJSC_PACK_TEST_FAIL_AFTER` 注入）自动恢复安装前状态，未完成事务下次 apply 自动清理。回滚只撤销本包内容；回滚最后一个分包时保留带 marker 的空注册表，避免 facade 卸载后模块加载失败。2026-11-02 增加“注册表预存本包行但模块缺失”拒绝安装与旧记录回滚阻止。`node tools/test-pack-install.mjs` 13 条全 PASS（失败注入、重复安装、A/B 共存、乱序回滚、共享核心冲突、注册表缺模块、预存行缺模块、他人修改保护）。
- 打包器去本机路径硬编码：使用 PATH 中 `git`，仓库/证据/输出/stage 目录均可用 `--repo/--evidence/--out/--stage-root`（或 `DJSC_*` 环境变量）配置；不再要求其他开发者具备本机 Codex 路径。
- 逐包验收工具 `tools/accept-skill-ai-pack.mjs`：对**实际 ZIP** 解压、`verify.py --zip/--dir`、包内测试、干净扩展副本单包安装、宿主真实加载、卸载后再次加载、重装、134 维契约哈希、注册表依赖；多 ZIP 模式额外验证五包共存、他人注册行保留与乱序回滚。不能用主审查包或共享核心单测替代逐包验收。
- 逐包验收结果（2026-11-02）：`refresh_standard`、`shenhua_feng`、`refresh_feng`、`shenhua_lei`、`out_of_scope` 单包均 PASS；五包共存/乱序回滚/他人注册行保留 PASS。结果见 `accept-<pack>.json`、`accept-combined.json`、`pack-acceptance-matrix.md`；`out_of_scope` 因此标记 `可交付`。
- 拆分后宿主回归：`split-suite-native.json`（68 场景）、`split-suite-policy.json`（69 场景）、`split-suite-extension.json`（69 场景）均 `passed`、无 pageerror；`split-manual-ui.json` 8 用例/7 断言全 PASS（人类输入、托管隔离、对话框内卸载、卸载/重装字节级还原）。Node 回归与包内契约见 `repair-node-tests.json`、`repair-package-tests.log`。

### 8.4 分包化后的全量复核（2026-11-01 晚）

拆分结构后重新跑了 21 场景 × 3 变体（`split-range-*.json`）：

| 变体 | 初次成功 | 初次超时 | 超时场景 | 复核重跑 | 最终未解决 |
| --- | ---: | ---: | --- | --- | ---: |
| policy | 20/21 | 1 | `reqimou-blocked-far5-hp4-3sha-tao-hp2-horse` | `split-retest-policy.json` 仍超时 | 1 |
| native | 19/21 | 2 | `reqimou-blocked-far5-...`、`reqimou-multi2-pay1-killa` | `split-retest-native.json` 2/2 成功 | 0 |
| extension | 19/21 | 2 | `reqimou-blocked-far5-...`、`reqimou-multi3-pay2-killab` | blocked-far5 重跑仍超时；multi3 重跑未完成（进程被停止，无 JSON） | 2 |

`split-manual-ui.json` 8 用例/7 断言全 PASS。分包化后复核没有放宽任何断言；上述 3 个未解决项均为宿主启动/长回合看门狗超时，不是断言失败，但**不能据此宣称第二批已无条件可合并**。历史补修台账（8.1）仍是 final-unresolved 0（基于补修提交 pre-split 证据）；本条给出分包化后的独立复核缺口，二者分开报告。上述未解决项已在 8.5 用独立诊断定位为夹具 `game.over` 陷阱并修正；修正后的 21×3 完整重跑结果见 8.5。

### 8.5 reqimou 超时独立诊断与夹具修正（2026-11-01 深夜）

8.4 的 3 个未解决项不能继续用“看门狗抖动”解释。本轮先修诊断工具，再做可复现归因：

- 旧版看门狗在页面里直接读 `_status`，但页面只暴露 `realHost._status`；`page.evaluate` 的 ReferenceError 被 `.catch(() => {})` 吞掉，历史 `[hp][watchdog]` 状态实际是盲的。现改为 `realHost._status`，并增加 2s 事件栈 ticker。
- 独立于页面主线程的证据：blob Worker 每 500ms 用绝对 origin `fetch` 心跳到 Node；Node 侧用 CDP `SystemInfo.getProcessInfo` 每秒采样浏览器/渲染进程累计 CPU。二者默认开启（`--no-diag` 可关），因此完整批次失败也会留下心跳/CPU；`--trace` 额外记录宿主就绪、场景开始、`game.loop`、`phaseUse`、技能、`chooseNumbers`、`loseHp`、`useCard`、`recover`、`die` 等阶段 mark。长套件另可用 `--browser-restart-every N` 每 N 场景重启浏览器，排除累积渲染进程状态。
- `reqimou-multi3`（extension）稳定复现：Worker 在 60s 内送达 122 次心跳（最大间隔 1.543s），主线程未同步卡死；最后事件栈为 `die → dying → damage → sha → useCard → chooseToUse → phaseUse → hpScene`，`aliveFans=0`，3 次 `op:die`；`diag-ext-multi3-nosentinel-fastfail.json` 记录到宿主 `game.over` 调用。渲染进程在最后 mark 后 100.9s 仅增 10.918s CPU（约 10.8%），属于空闲等待而非死循环。
- 根因是**夹具**把三个反贼全部击杀，宿主进入 `game.over` 胜负结算 UI，随后 `die` 事件不返回；不是 reqimou 策略循环，也不是分包共享核心重复包装。`reqimou-blocked-far5` 在未修正夹具的批次里同样可能杀光反贼，因此 native/policy/extension 都可能偶发；native 与 policy 的同场景 trace 均多次通过。
- 最小夹具修正：`tools/skill-ai-hp-real-host.mjs` 默认抑制 `game.over` 对话框（`--allow-game-over` 可关闭），并保留 `fixture-stalled-in-die-after-last-enemy` 快速失败守卫。**不修改技能、AI 或断言**；反贼全灭后主循环仍结束，支付/击杀断言照常执行。曾试验的高血量 sentinel 反贼不充分（xinkuanggu 抽杀可继续击杀），已移除。
- 拆包前后对比：用 `d396e10` 的 pre-split `skillAIPolicies.js`/`skillAIPolicyRules.js` 叠加到当前扩展（其余模块同源），相同 seed、相同场景运行；与 post-split 结果一致，未发现拆分导致的安装顺序/重复包装回归。共享核心 `install()` 幂等、注册表 import/条目一一对应、卸载只在当前包装仍是本层时恢复，已加入 16 条架构测试。
- policy 首轮完整重跑在场景 12（clampsave）的主机初始化 `page.waitForFunction` 30s 超时，20/21 完成；该失败发生在场景开始前，不是断言失败。日志/JSON 保留为 `postfix-range-policy-startupfailure.*`。随后用 `--browser-restart-every 1`（每个场景新浏览器）重跑，以排除累积渲染进程状态；结果见台账。
- 修正后 native 完整重跑 21/21：其中 `reqimou-blocked-far5` 与 `reqimou-multi3` 各触发 1 次 `game.over` 并被夹具抑制，随后 `phaseUse`/`game.loop` 正常结束；支付分别为 4/3，native 断言 14 条全 PASS。policy/extension 的完整重跑结果见台账与 `postfix-range-{policy,extension}.json`。
| 变体 | 场景 | 通过 | 超时 | 其他失败 | 未解决 | 备注 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| native | 21 | 21 | 0 | 0 | 0 | blocked-far5/multi3 各 1 次 game.over 被抑制；14 条验收 PASS |
| policy | 21 | 20 | 0 | 1（host init） | 0 | 首轮 wuxie 在场景前 host init 30s 超时；单场景重跑通过；14 条验收 PASS |
| extension | 21 | 20 | 0 | 1（host init） | 0 | 首轮 multi3 在场景前 host init 90s 超时；单场景重跑通过；14 条验收 PASS |
最终台账（`repair-acceptance-ledger.json/md`）：native `postfix 21/21`；policy `postfix 20/21 + 1 次 host-init 重跑成功`；extension 同；三者 `final_unresolved=0`、`last_attempt_failures=0`；历史失败次数 native/policy/extension = 9/4/2，逐条保留（含初始超时、旧重跑、host-init 失败与 partial 日志）。

- 修正后完整 21 场景 × 3 变体见 `postfix-range-{native,policy,extension}.json`；结果与历史失败分列于 `repair-acceptance-ledger.md`，不删除 `postfix-range-native-presuppress-partial.log` 与 `split-range-*` 中的超时记录。

### 8.6 交付边界补修与神话再临·风审查（2026-11-02）

- **注册表一致性漏洞**：第三方复现“注册表预存本包 import/注册行、分包模块缺失”时，旧 apply 会补齐模块并成功，旧 rollback 因 `mode=already` 不删注册行，最终留下悬空导入。现改为安装前一致性拒绝：注册表已含本包任一行且本包文件缺失时不写任何文件；旧安装记录遇到同类状态回滚时硬性阻止删除（`--force` 也不放行）。新增 2 条回归，安装/回滚测试 13/13 PASS。
- **逐包真实技能场景**：acceptance 按包绑定场景，`refresh_standard=rezhiheng-3hp,new-retuxi-order`、`shenhua_feng=hp-qimou-* + 24 个固定审查场景`、`refresh_feng=hp-reqimou-distance4-hp3`、`shenhua_lei=olkongsheng-array-count,olkongsheng-repeat`、`out_of_scope=redimeng-hidden-info,redimeng-permute-values`；组合验收取并集并逐包对照单包签名。redimeng 单包结果：`fairRedimeng=9`、`redimengMaskFailed=0`，同位置置换索引一致（(2,3)/(0,1)），结算前后牌张守恒。
- **上游 1fe5292**：新增 `--base-ref 1fe5292 --wire-index-diff`。在干净归档上先确认未接线 apply 拒绝，再应用包内 `score/index.diff`，随后逐包安装、真实技能场景、卸载/回滚、重装；五包单包与组合全部 PASS。上游源码包必须显式接线，不是直接安装包。
- **验收矩阵口径**：新增 `contract.single` / `contract.combined`，矩阵单包契约与组合契约分列；未执行显示“未执行”，不把未运行项误报为失败。组合行 `contract_passed=true` 来自实际共存安装/134 维检查。
- **不抑制 game.over 的完整对局**：新增 `tools/test-fullgame-settlement.mjs`，斗地主 seed 20261030：`done=true`、`overCalls=1`、`result=true`、3 phases / 17 uses / 12 decisions，无 pageerror。默认抑制夹具仍保留，二者互不替代。
- **神话再临·风**：12 项登记技能全部审查。`qimou` 已修复；`releiji/guidao/huangtian/xinfu_guhuo/xinshensu/retianxiang/hongyan/xinkuanggu/jushou/gzbuqu/xinliegong` 均建立真实宿主固定局面，原生与已安装扩展的决策语义一致（天香仅对称敌人目标座位不同；蛊惑假声明+确定质疑时原生取消、扩展放弃，单列为策略差异），未复现需改缺陷，状态为 `已验证无问题`。证据见 `shenhua-feng-review.json`、`shenhua-feng-review-native.json`、`shenhua-feng-review-compare.json`；分包状态升级为 `可交付`，待外部集成回执后再考虑 `已交付`。

### 8.7 神话再临·风技能级验收补强（2026-11-02 晚）

本节回答“16 个场景都执行了，是否等于 11 项技能都验证过”的问题。结论：旧版只记录了场景数据，acceptance 仍主要断言奇谋；本轮把逐技能关键行为写成可执行断言，并保留旧证据不改写。

- **鬼道记录根因**：旧夹具写 `result = await ally.judge(...)`，宿主的 `await event` 返回 `undefined`，真正判定结果在 `judgeEvent.result`。因此旧证据出现 `judging={}`、`replaced=false`，但手牌已经交换（黑桃杀换入、原红桃无懈进入张角手牌）。现改为读取 `judgeEvent.result`，并同时断言判定花色/点数、AI 选牌、获得原判定牌三件事；新增 `shenhua-guidao-decline`：判定已是黑桃时 AI 放弃无收益改判、手牌不变。
- **蛊惑不再“按钮选了就算过”**：新增 `shenhua-guhuo-ai-use`（AI 实际声明杀并使用隐藏牌命中敌方，目标属于敌方且非自己）、`shenhua-guhuo-real-questioned`（真杀被质疑后仍命中、质疑者获得缠怨）、`shenhua-guhuo-fake-questioned`（假声明被质疑：原生取消；扩展 AI 在确定质疑下选择放弃，二者均无伤害、无缠怨）。`shenhua-guhuo-claim/-phase` 保留为历史观察，不再作为“已验证”的唯一依据。
- **其他技能**：雷击补目标+2 雷电伤害结算；黄天补交闪/黄天3/无闪不发动；神速补跳判定+虚拟杀命中/手牌不足不发动；天香补敌方目标+失去体力/无红桃正常受伤；狂骨补距离 1 伤害后摸牌/回复两分支；据守补满血不发动/低血摸3翻面；不屈补翻创存活/未到0血不翻/回复时 chooseCardButton 移创 AI；烈弓补 directHit+extraDamage=1 与负向 1 点伤害。红颜明确为纯被动规则验证，不新增无意义 AI 策略。
- **验收执行**：`accept-skill-ai-pack` 对风包执行 3 个奇谋场景 + 24 个固定审查场景，共 23 条技能级检查（含奇谋）；原生/扩展逐场景对照 `semantic_all=true`、`exact_all=false`，差异单列为：天香对称目标座位不同；蛊惑假声明场景原生取消/扩展放弃（策略差异）。奇谋场景会改变后续 AI 决策上下文，acceptance 将奇谋与非奇谋场景分成两个宿主进程运行，避免跨场景影响；这不是放宽断言。
- **状态口径**：新增 `validation_level`：`规则结算验证通过`、`AI决策验证通过`、`正反向决策验证通过`、`部分验证`、`确认缺陷并已修复`。风包 12 项：qimou=确认缺陷并已修复；hongyan=规则结算验证通过；releiji/xinkuanggu/gzbuqu=AI决策验证通过；其余 7 项=正反向决策验证通过。`142-task-list` 与分包 `checklist.md` 已写入该字段；未覆盖关键 AI 分支的技能不再笼统写“完全验证无问题”。

## 九、部署与回滚

本轮已按分包拆分共享核心：运行时新增 `policyCore.js`、`skillAIPolicyPacks.js`，策略拆到 `packs/` 与 `rules/`；`skillAIPolicies.js` 只保留 facade。补修包内 `deployment/deployment-plan.md` 已更新为完整文件清单；分包交付 ZIP 另含 `integration/apply-pack.mjs` 与 `rollback-pack.mjs`，只追加本分包文件与注册行，不覆盖其他开发者修改。回滚分包使用其安装记录；整体回滚仍可还原到 `3bb2434`（见包内 patches）。

**本补修不推送、不发版、不覆盖正式安装目录。**
