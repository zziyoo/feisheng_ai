# 无名AI v4.4.4 技能AI复核与第一批优化报告

日期：2026-10-30  
范围：无名AI v4.4.4（`1fe5292`）运行时、142 将候选清单、真实宿主技能 AI  
结论：**不是重写 142 个武将**。本轮完成分支清理、基线重锚、142 将清单复核、真实宿主测试设施，以及 4 个有真实复现证据的技能 AI 改进；其余候选保持原实现并记录原因。

## 0. 结论摘要

- 基线：上游 `v4.4.4 = 1fe5292eb3022dd8d1db494617b21a12be912e61`；本机安装目录运行时代码按 CRLF 归一化后与该提交逐文件一致；真实宿主 `lib.version = 1.11.7`。
- 分支：15 条本地临时分支已归档到 `refs/archive/*` 后删除；2 个干净工作树移除；`master`、`codex/final-client-stability`、`codex/release-v4.4.4` 保留；远端/Fork 同步待显式确认。
- 142 将：P1 3、P2 50、P3 89；已复现 4、验证无问题 3、尚待验证 1、尚未验证 134。没有把原 P1/P2/P3 当成缺陷等级。
- 第一批改动：
  1. 界孙权【制衡】低血保留【桃】【闪】；
  2. 周妃旧版【箜声】修正“数组+数字”的数量表达式；
  3. 界鲁肃 `redimeng` 修正暗牌选择读取牌面（清单外变体，P0）；
  4. 界张辽【突袭】按公开手牌数选目标。
- 实测：13 个真实身份局固定场景 0 错误；身份/斗地主/2V2 三模式托管局完成（身份 1 局完成、1 局到 180s 上限仍在进行），决策 p99 分别 50.4 / 56.1 / 79.0ms，最大 81ms，远低于 800ms 回退阈值。
- 回归：40 个 Node 回归入口全部 exit=0、0 FAIL；2V2 重入、响应生命周期、影子/卸载、移动端性能、守卫、模型 v3 均保持。
- Android 真机长时多局仍未验收；本报告不把它宣传为全面性能验证。

## 1. 基线取证

详见 [baseline.json](baseline.json)。

| 项 | 值 |
|---|---|
| 扩展版本 | v4.4.4 |
| 扩展基线提交 | `1fe5292eb3022dd8d1db494617b21a12be912e61`（= `upstream/master` = 标签 `v4.4.4`） |
| 安装目录 | `C:/Users/32360/Desktop/无名杀-win32-x64/resources/app/extension/无名AI` |
| 安装目录运行时代码 | 与 v4.4.4 逐文件哈希一致（`extension.js`、`info.json`、`score/index.js`、`aiOverride.js`、`use.js`、`skills.js`、`engine.js`、`features.js`、`dimensionAdapter.js`、`policyModelV3.js`、`decisionEvaluation.js`） |
| 宿主 | 无名杀 `lib.version = 1.11.7`；app package 1.11.0；核心在 `resources/app` |
| 原方案源码参考 | `libnoname/noname b481b17552dd46e7d9ca805d5d7975b742168256` |
| 重要差异 | 原方案的行号来自 b481b17 的 `apps/core/...`，不是本机 1.11.7 的 `character/*.js`；本轮全部按本机实际文件重新定位，未沿用旧行号 |

工作区 Git HEAD 仍是旧线 `codex/final-client-stability`（`3edbc6e`），且有上一轮未提交审计资料；本次没有覆盖它。运行时与 v4.4.4 一致，所以“已安装版本 = v4.4.4 运行时”这一判断成立，但 Git 版本记录与运行内容不是同一条线。

## 2. 分支整理

详见 [branch-report.md](branch-report.md)。摘要：

- 15 条本地临时分支已归档后删除；归档引用 `refs/archive/*` 指向原 HEAD，可恢复。
- `codex/mobile-performance-443`、`fix/mobile-performance-4.4.3` 是 v4.4.4 直接祖先；`codex/release-v4.4.4` 是 v4.4.4 自身；其余 codex/* 的关键标识符在 v4.4.4 中命中 76%–95%，并做了定点核对（`__djscChoiceTrace`、`E_REWARD_STATE_CONFLICT`、`E_DATASET_SCOPE`、`E_AUTOFEATURE_NOT_APPLIED`、`source_auth.py`、`modeModelStore` 动态维度）。
- 本地 `master` 是旧线 QA 集成（相对 v4.4.4 独有 22、缺少 56），保留不动，不 reset、不强推。
- `upstream/fix/client-align-142` 的 2 个独有提交没有进入 v4.4.4：`18f7204` 把特征维度 134 提到 142，`25cae88` 新增 `cloudInference`；v4.4.4 仍是 134 维，且没有该文件。该分支保留，不能直接合并覆盖模型契约。
- Fork 主线快进与远端分支删除被执行器的破坏性操作门禁拦截，命令已列在分支报告末尾，等待用户确认。

## 3. 142 将清单复核

完整数据：[142-task-list.json](142-task-list.json) / [142-task-list.csv](142-task-list.csv)。保留全部 142 个武将 ID 和技能 ID。

| 维度 | 计数 |
|---|---:|
| 总数 | 142 |
| 修订 P1 | 3（界孙权、周妃、界张辽） |
| 修订 P2 | 50（原 56 个“优先更新候选”中未复现者 + 少量部分验证） |
| 修订 P3 | 89（原“验证后决定”75 + “暂保留”11 + 已验证无问题 3） |
| 已复现 | 4 |
| 验证无问题 | 3 |
| 尚待验证 | 1 |
| 尚未验证 | 134 |
| 已实施 | 3 |
| 部分实施/待结算复核 | 1 |
| 无需改动 | 3 |
| 未改动 | 135 |
| 真实宿主通过 | 6 |
| 部分通过 | 2 |
| 未测试 | 134 |

### 3.1 已复核的 12 个在册条目

| 武将 | 技能 | 修订优先级 | 复现状态 | 实施 | 实测 |
|---|---|---|---:|---|---|
| 界孙权 `re_sunquan` | `rezhiheng` | P1 | 已复现 | 已实施 | 3血保留桃；4血负向对照不变 |
| 周妃 `zhoufei` | `olkongsheng` | P1 | 已复现 | 已实施 | 原生选3张→修正选1张 |
| 界张辽 `re_zhangliao` | `new_retuxi` | P1 | 已复现 | 已实施 | 原生1+2→优化4+2 |
| 孙权 `sunquan` | `zhiheng` | P2 | 已复现（决策） | 已实施，结算待复核 | 1血选中闪；order 护栏命中，结算后置条件未验证 |
| 黄盖 `huanggai` | `kurou` | P2 | 尚待验证 | 未改动 | 3血会发动，未发现明确越权 |
| 张辽 `zhangliao` | `tuxi` | P3 | 验证无问题 | 无需改动 | 只有队友有牌时正确放弃 |
| 刘备 `liubei` | `rende` | P3 | 验证无问题 | 无需改动 | 把牌给队友并回复 |
| 界鲁肃 `re_lusu` | `dimeng` | P3 | 验证无问题 | 无需改动 | 只读公开手牌数量，交换正确 |
| 界魏延 `re_weiyan` | `qimou` | P2 | 尚未验证 | 未改动 | 1血返回0；未做完整回合 |
| 典韦 `dianwei` | `qiangxix` | P2 | 尚未验证 | 未改动 | 2血及以下拒绝HP支付；未做完整回合 |
| 界刘备 `re_liubei` | `rerende` | P2 | 尚未验证 | 未改动 | 未建立固定场景 |
| 界黄盖 `re_huanggai` | `rekurou` | P2 | 尚未验证 | 未改动 | 依赖诈降，不能套用标准苦肉阈值 |

### 3.2 清单外发现

- `redimeng`（活动武将/界鲁肃变体，非 142 清单 ID）：混合后的暗牌选择中，原生 AI 用 `get.value(button.link)` 直接挑最高价值牌；真实宿主中第一个选择者拿走【桃】+【无中生有】。这是明确的隐藏信息读取，按 P0 处理并已修复。清单里的 `re_lusu` 实际使用标准 `dimeng`，两者不能混为一谈。

### 3.3 对原方案的调整

1. **基线重锚**：不再使用 b481b17 的固定行号；按本机 1.11.7 重新定位（`tuxi:786`、`rende:1121`、`zhiheng:1727`、`kurou:1837`、`dimeng:5713`、`kongsheng:2120`、`olkongsheng:787`、`qimou:3661`、`qiangxix:6701`、`new_retuxi:13861`、`rezhiheng:14842`、`redimeng:3356`）。
2. **去重**：按 skill ID 注册策略，不按武将复写。`tuxi`/`new_retuxi`/`rezhiheng`/`zhiheng`/`dimeng`/`redimeng`/`kongsheng`/`olkongsheng` 是不同实现，不能互相套用。
3. **优先级重建**：原 P1/P2/P3 只是排期；本轮只在有真实复现时升级。142 中 P0 为 0；P1 3；P2 50；P3 89。
4. **交接材料**：测试包没有源码快照；已归档原始包到 `source/`，并明确“原方案参考 b481b17、本机宿主 1.11.7”的区别。无法从包内取得的内容不虚构。
5. **保留成熟策略**：标准突袭、标准仁德、标准缔盟、新版箜声、界黄盖诈降均未强改；界张辽已有扩展目标桥，本轮只补“同等敌意下按公开手牌数”的薄策略。

## 4. 技能AI接管链路（真实结论）

### 4.1 实际链路

```
宿主 phaseUse
→ Player.chooseToUse
→ 扩展 hard override（use.js，bestAction >800ms 或异常回退）
→ 宿主原生 chooseCard/get.order
→ 扩展 soft override（aiOverride：aiOrder/aiValue/effect/useful）
→ 技能内部 chooseCard/chooseTarget/chooseButton/chooseControl
→ 扩展 skill bridge（仅当 bestAction 解出 skill/target 且置信度足够）
→ 宿主 useCard/useSkill 结算
```

### 4.2 六个问题的回答

1. **哪些技能决策由无名AI实际接管？**
   - 卡牌级：软层 `aiOrder/aiValue/effect/useful`；硬层 `chooseToUse/chooseToRespond/chooseToDiscard/chooseToCompare` 否决或结束回合。
   - 技能子选择：当 `bestAction` 产出 `type='skill'` 且目标置信度 ≥0.55 时，`chooseTarget/chooseCardTarget/chooseButton/chooseControl` 桥会工作；界张辽的目标变化就是证据。
   - 本轮新增：`skillAIPolicies` 对 `rezhiheng/zhiheng` 的 `check/order/result`、`new_retuxi` 的 `chooseTarget`、`redimeng` 的 `chooseButton`、`olkongsheng` 的 `cost` 做薄封装。
2. **哪些仍由原生处理？**
   - 大多数声明式主动技的 `check(card)`（例如标准 `zhiheng` 的 `check` 在当前宿主路径没有被调用）、触发技 `tuxi` 的强制发动/放弃、大量非本轮审查技能。
   - `new_retuxi` 的原始目标 AI 仍保留，扩展只在其上做目标偏置。
3. **能否调整支付牌、目标、数量、时机、顺序？**
   - 支付牌：能通过 `check/aiValue` 影响部分技能；不是所有声明式技能都走 `check`。
   - 目标：能通过 `chooseTarget/chooseCardTarget` 桥或本轮的目标钩子影响；不改 `filterTarget`。
   - 数量：部分能通过 `selectTarget/selectCard` 的 AI 分数影响；不直接改技能规则。
   - 时机/顺序：硬层可建议结束回合/否决低价值牌；技能发动时机仍主要由宿主 `get.order`/`ai.result` 决定。
4. **是否存在“算了分但没接入选择入口”？**
   - 是。`engine` 的 `activePlaySkills → scoreSkill` 会产出技能候选，但宿主 `get.order(skillString)` 只读 `lib.skill[sid].ai.order`；`game.checkMod(..., "aiOrder")` 只在 `typeof item === "object"` 时执行（本机 `noname/get/index.js:6508`）。所以 `_djsc_engine.mod.aiOrder` 对**技能字符串**不生效。
   - 本轮没有强行把 engine 分数接到所有技能上（风险大）；改为对已复现的 4 个技能做真实入口的薄策略。这是“先接通、再扩展”，不是“全部重写”。
5. **关闭/异常时能否回退？**
   - 能。`shouldDisableOverride()`（联机）跳过软/硬接管；`isScoreEngineEnabled()` 关闭时不安装；硬层有 800ms/异常回退、熔断和降级；`uninstallScoreEngine` 会调用 `uninstallSkillAIPolicies` 还原本轮包装。
   - 本轮策略全部是 try/catch + 原函数备份；异常时返回原生分数；`redimeng` 公平钩子只对 AI 选择者生效，人类路径不变。
6. **会不会重复接管/重入？**
   - 既有：`isDecisionEvaluating()` 防决策内再入、安装 token、`__djsc...Consumed` 哨兵、事务幂等。
   - 本轮：策略只读 hp/公开手牌数/自己手牌名称，不调用 `bestAction`，不触发新的选择事件；`chooseButton/chooseTarget` 钩子带 `__djsc...` 标记，避免同事件重复包装；卸载时只在“当前函数仍是我们的包装”时还原。

## 5. 第一批优化（逐项）

### 5.1 界孙权【制衡】低血防御保留

- **原始行为**：3血、手牌[桃,杀,杀]，原生界制衡全手换牌，弃桃+两杀，摸4；4血同类手牌原生也不发动（负向对照）。
- **修改**：`skillAIPolicies` 在低血（≤3）时把【桃】、【闪】的 `check` 分数压到 ≤-1，并包住 `ai.order`/`ai.result.player`；若手里全是这些防御牌，直接不换。4血及以上不改。
- **正向**：3血保留桃，弃两杀，摸2；真实宿主 `policyStats.keptTao=4`。
- **反向**：4血保持原生；标准/其他技能不注册；装备区不干预。
- **真实宿主**：原生 3→4 张（弃桃）；优化 3→3 张（桃仍在）。4血原生与优化都不发动。
- **性能/回退**：纯规则 p99 1.9µs；卸载还原；异常返回原生分。

### 5.2 周妃旧版【箜声】数量表达式

- **原始行为**：`olkongsheng.cost` 的 AI 中 `getExpansions("olkongsheng") + ui.selected.cards.length`；前者是数组，数组+数字转成字符串，阈值比较失真。
- **复现**：已有一张“箜”、3张无懈、受伤队友1手牌；原生成本AI选3张无懈（应停在1张以形成良姻回复阈值）。
- **修改**：只在该次 `cost` 调用期间，让 `getExpansions` 返回数组副本并加 `valueOf/toString=length`；不复制宿主技能、不改技能规则、不改变数组迭代/取值。
- **正向**：真实宿主修正后只选1张；`olkongshengCostCalls=1`。
- **反向**：未在 `cost` 期间调用 `getExpansions` 的其他代码走原数组；卸载还原。
- **注意**：这是旧版 `olkongsheng`；新版 `kongsheng` 只做了表达式复核，未宣称修复。

### 5.3 界鲁肃 `redimeng` 暗牌公平选择（清单外 P0）

- **原始行为**：`redimeng` 混合两名角色的手牌后，当前选择者用 `get.value(button.link, player)` 直接挑最高价值牌；人类同一界面是暗牌。
- **复现**：混合池[桃,杀,闪,无中]，原生第一个选择者拿走桃+无中。
- **修改**：`skillAIPolicies` 的 `chooseButton` 钩子在 `redimeng` 技能上下文中，把 AI 分数改成只依赖“按钮位置+玩家id”的稳定分数；不读牌面、不使用隐藏信息。
- **正向**：真实宿主公平分配为[闪,桃]/[杀,无中]；`fairRedimeng=3`。
- **反向**：人类选择者跳过；联机禁用接管；卸载还原。
- **注意**：该技能不在 142 清单内（活动武将/界鲁肃变体），但正是用户要求检查的“界鲁肃缔盟隐藏手牌”问题。

### 5.4 界张辽【突袭】目标收益

- **原始行为**：三名敌人手牌 1/4/2，原生只按态度选 1+2，跳过 4；v4.4.4 扩展桥能带上 4，但第二个目标仍有时选 1 而非 2。
- **修改**：`skillAIPolicies` 对 `new_retuxi/retuxi` 的 `chooseTarget`，在原生分数上只对敌人按公开手牌数加 0–2 的有界小分；不改合法目标集合，不碰标准 `tuxi`。
- **正向**：真实宿主选 4+2；`retuxiTargetBonus=7`。
- **反向**：只有队友有牌时仍不会选队友（原生态度分为负）；标准 `tuxi` 保持原行为。
- **性能/回退**：O(1)/目标；异常返回原生分；卸载还原。

### 5.5 标准孙权【制衡】（部分）

- 1血[闪,桃]时原生 AI 选中闪作为成本；共享策略的 `ai.order` 护栏在真实宿主命中（`skippedOrder=1/2`）。
- 但隔离夹具的结算后置条件受宿主“试探性选牌”影响，无法据此确认最终手牌；**不宣称完整修复**。该技能保持 P2，后续用完整 `phaseUse` 回合复核。

## 6. 测试与性能

详见 [test-report.md](test-report.md)。

- 新增真实宿主场景 13 个，覆盖身份/技能成本/目标/暗牌选择；原生、仅策略、完整扩展三种对照；0 页面错误。
- 新增纯规则单测 10 条；新增策略微基准。
- 40 个 Node 回归入口全部 exit=0、0 FAIL；2V2 10 个入口、移动端 5 个入口全部通过。
- 托管局（完整扩展）：
  - 身份：40 样本，p50 32.0 / p95 47.1 / p99 50.4 / max 52ms；1 局完成，1 局到 180s 上限仍在进行（106 回合、无错误）。
  - 斗地主：53 样本，p50 20.0 / p95 33.8 / p99 56.1 / max 66ms；3/3 完成。
  - 2V2：50 样本，p50 28.5 / p95 61.0 / p99 79.0 / max 81ms；3/3 完成。
- 策略纯规则：p50 0.3µs / p95 0.6µs / p99 1.9µs；最大 3027µs 为单次 GC/调度离群，不在决策路径。
- 场景总耗时包含清场/动画/延时，p50 约 1.15s、最大 4.5s，不能当作决策耗时。

## 7. 保留的 v4.4.4 修复

本轮没有改这些模块，回归通过：

- 2V2 重入保护：`test-2v2-reentry` + 2V2 系列 10 个入口全部通过；2V2 真实托管 3/3 完成。
- 响应生命周期：`test-response-lifecycle` 45/0；`__djscChoiceTrace` 存在。
- 模型非阻塞恢复/影子/热更：`test-policy-model-v3` 25/0、`test-mobile-shadow`、`test-mobile-v5`、`test-mobile-v3-disable`、`test-extension-shadow-lifecycle`。
- 面板按需加载/卸载：面板相关回归在 v4.4.4 集内通过；`test-extension-shadow-lifecycle` 覆盖安装/卸载代际。
- 护栏安全回退：`test-guard-runtime-failure` 2/2。
- 更新器/卸载生命周期：`test-extension-shadow-lifecycle` 7 PASS，`test-mobile-performance` 12 PASS。

## 8. 风险与未验证

- **Android 长时多局**：未验收；不能把本轮短时间结果当作全面性能结论。
- **样本量**：每模式 40–53 个决策样本；p99 接近最大，统计意义有限；身份局有 1 局到 180s 上限未结束。
- **标准孙权结算**：只验证了决策命中，未验证完整结算；保持 P2。
- **奇谋/强袭/界仁德/界苦肉**：只做代码复核，未做完整回合；保持未验证/未改动。
- **清单外 `redimeng`**：修复了隐藏信息读取，但它不属于 142 清单；版本归属需在后续 PR 说明。
- **宿主漂移**：策略依赖 1.11.7 的 `olkongsheng` 内部表达式和 `redimeng` 选择结构；宿主升级后如果改写这些函数，钩子会 fail-open（不报错，但不一定继续生效），需要重跑场景。
- **模型/特征契约**：没有合并 `client-align-142`；v4.4.4 仍是 134 维。没有改模型权重、训练标签、特征维度。
- **Fork 同步**：未执行，等待确认。

## 9. 后续计划

详见 [next-batches.md](next-batches.md)。按机制分组：信息范围审计 → 生命支付/停止条件 → 目标与失牌收益 → 资源与牌序 → 响应/时机。下一阶段前置条件是固定种子 + 完整回合 runner + 三模式对照；不按 142 个武将逐个重写。

## 10. Git 提交记录

本轮在既有 `codex/release-v4.4.4` 分支（基于 `v4.4.4`）上分层提交：

| 提交 | 内容 |
|---|---|
| `927464f` | `docs(skill-ai): 归档 v4.4.4 基线与 142 将复核清单` |
| `d888a1d` | `test(skill-ai): 增加真实宿主技能决策场景与策略单元测试` |
| `d74be22` | `feat(skill-ai): 低血防御保留、缔盟公平选牌、突袭目标收益与箜声数量修正` |
| 本文档所在提交 | `docs(skill-ai): 第一批优化实测报告、分支审计与后续计划`（见 `git log -- docs/skill-ai-20261030/REPORT.md`） |

没有改 `master`，没有 force push，没有删除发布标签。主工作树 `codex/final-client-stability` 的未提交资料未动。

## 11. 交付物

- `REPORT.md`（本文件）
- `branch-report.md`：分支逐条处理
- `test-report.md`：命令、结果、性能、限制
- `next-batches.md`：按机制的后续计划
- `baseline.json`：v4.4.4/安装目录/宿主哈希
- `142-task-list.json` / `142-task-list.csv`：全部 142 个 ID 的复核状态
- `source/`：原始测试包资料（候选清单、测试任务、模板、GitHub 源码清单、测试说明）
- `tools/skill-ai-host-scenes.mjs`：真实宿主技能场景
- `tools/test-skill-ai-policies.mjs`：纯规则单测
- `tools/bench-skill-ai-policies.mjs`：微基准
- `tools/build-skill-ai-task-list.py`：清单生成脚本
- `score/decision/skills/skillAIPolicyRules.js`：纯规则
- `score/decision/skills/skillAIPolicies.js`：宿主薄适配层
