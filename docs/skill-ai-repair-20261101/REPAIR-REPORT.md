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
- 拆分后宿主回归：`split-suite-native.json`（68 场景）、`split-suite-policy.json`（69 场景）、`split-suite-extension.json`（69 场景）均 `passed`、无 pageerror；`split-manual-ui.json` 8 用例/7 断言全 PASS（人类输入、托管隔离、对话框内卸载、卸载/重装字节级还原）。Node 回归与包内契约见 `repair-node-tests.json`、`repair-package-tests.log`。

### 8.4 分包化后的全量复核（2026-11-01 晚）

拆分结构后重新跑了 21 场景 × 3 变体（`split-range-*.json`）：

| 变体 | 初次成功 | 初次超时 | 超时场景 | 复核重跑 | 最终未解决 |
| --- | ---: | ---: | --- | --- | ---: |
| policy | 20/21 | 1 | `reqimou-blocked-far5-hp4-3sha-tao-hp2-horse` | `split-retest-policy.json` 仍超时 | 1 |
| native | 19/21 | 2 | `reqimou-blocked-far5-...`、`reqimou-multi2-pay1-killa` | `split-retest-native.json` 2/2 成功 | 0 |
| extension | 19/21 | 2 | `reqimou-blocked-far5-...`、`reqimou-multi3-pay2-killab` | blocked-far5 重跑仍超时；multi3 重跑未完成（进程被停止，无 JSON） | 2 |

`split-manual-ui.json` 8 用例/7 断言全 PASS。分包化后复核没有放宽任何断言；上述 3 个未解决项均为宿主启动/长回合看门狗超时，不是断言失败，但**不能据此宣称第二批已无条件可合并**。历史补修台账（8.1）仍是 final-unresolved 0（基于补修提交 pre-split 证据）；本条给出分包化后的独立复核缺口，二者分开报告。

## 九、部署与回滚

本轮已按分包拆分共享核心：运行时新增 `policyCore.js`、`skillAIPolicyPacks.js`，策略拆到 `packs/` 与 `rules/`；`skillAIPolicies.js` 只保留 facade。补修包内 `deployment/deployment-plan.md` 已更新为完整文件清单；分包交付 ZIP 另含 `integration/apply-pack.mjs` 与 `rollback-pack.mjs`，只追加本分包文件与注册行，不覆盖其他开发者修改。回滚分包使用其安装记录；整体回滚仍可还原到 `3bb2434`（见包内 patches）。

**本补修不推送、不发版、不覆盖正式安装目录。**
