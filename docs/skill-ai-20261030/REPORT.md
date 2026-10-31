# 无名AI v4.4.4 技能AI复核与第一批优化报告

日期：2026-10-30  
范围：无名AI v4.4.4（`1fe5292`）运行时、142 将候选清单、真实宿主技能 AI  
结论：**不是重写 142 个武将**。本轮完成分支清理、基线重锚、142 将清单复核、真实宿主测试设施，以及 4 个有真实复现证据的技能 AI 改进；其余候选保持原实现并记录原因。

## 0. 结论摘要

- 基线：`v4.4.4` 是 annotated tag，tag 对象 `22cf379`，真正提交 `1fe5292eb3022dd8d1db494617b21a12be912e61`；本机安装目录 384 个运行文件中 383 个与 v4.4.4 逐文件一致，1 个已知缺失（`client_policy_model_v2.js`，7,038,938 B；运行入口不可达）。真实宿主 `lib.version = 1.11.7`。
- 分支：15 条本地临时分支已归档到 `refs/archive/*` 后删除；2 个干净工作树移除；Fork master 已从 `78c141f` 非强制快进到 `1fe5292`；已删除独有 0 的 `feature/manual-full-package-20261017`；`fix/model-lifecycle` 保留复核。
- 142 将：P1 3、P2 49、P3 90；已复现 3、验证无问题 4、尚待验证 1、尚未验证 134。没有把原 P1/P2/P3 当成缺陷等级。
- 第一批改动：
  1. 界孙权【制衡】低血保留【桃】【闪】；
  2. 周妃旧版【箜声】修正“数组+数字”的数量表达式；
  3. 界鲁肃 `redimeng` 修正暗牌选择读取牌面（清单外变体，P0）；
  4. 界张辽【突袭】按公开手牌数选目标。
- 实测：38 个真实身份局固定场景 0 错误；身份/斗地主/2V2 三模式托管局样本 44/73/65，决策 p99 194.7 / 74.5 / 135.5ms，最大 199ms，低于 800ms 回退阈值；一次旧版身份局长局到 180s 测试上限，未标记停滞。
- 回归：41 个 Node 回归入口全部 exit=0、0 FAIL；2V2 重入、响应生命周期、影子/卸载、移动端性能、守卫、模型 v3、134 维契约均保持。
- 本地试验安装：只部署 3 个运行时文件，备份/哈希/回滚记录在 `live-install/`；安装目录本身跑 38 个真实宿主场景 + 完整引擎卸载/重装，0 错误。
- Android 真机长时多局仍未验收；本报告不把它宣传为全面性能验证。

## 1. 基线取证

详见 [baseline.json](baseline.json)。

| 项 | 值 |
|---|---|
| 扩展版本 | v4.4.4 |
| 扩展基线提交 | `1fe5292eb3022dd8d1db494617b21a12be912e61`（= `upstream/master` = 标签 `v4.4.4^{commit}`） |
| 标签对象 | `22cf3798445321385ed01582aaf35afdd5b7f63d`（annotated tag；不能当提交 SHA） |
| 安装目录 | `C:/Users/32360/Desktop/无名杀-win32-x64/resources/app/extension/无名AI` |
| 安装目录运行时代码 | 全量 384 个运行文件：383 个逐文件一致、0 个内容不同、1 个已知缺失（`score/model/net/client_policy_model_v2.js`，7,038,938 B）；严格全等为 false，行为等价为 true（该文件未被运行入口引用） |
| 宿主 | 无名杀 `lib.version = 1.11.7`；app package 1.11.0；核心在 `resources/app` |
| 原方案源码参考 | `libnoname/noname b481b17552dd46e7d9ca805d5d7975b742168256` |
| 重要差异 | 原方案的行号来自 b481b17 的 `apps/core/...`，不是本机 1.11.7 的 `character/*.js`；本轮全部按本机实际文件重新定位，未沿用旧行号 |

工作区 Git HEAD 仍是旧线 `codex/final-client-stability`（`3edbc6e`），且有上一轮未提交审计资料；本次没有覆盖它。完整比较的范围是 `extension.js`、`info.json`、`js/`、`score/`、`shadow/`、`css/`、`assets/`、`model/` 共 384 个文件；`backend/`、`artifacts/`、`docs/`、`tools/`、`tests/`、`dist/`、`data/`、`logs/` 等非客户端运行物不计入。唯一缺失的 v2 模型包在 `policyModelV2.js:33` 有动态 import，但 `policyModelV2` 适配器没有被运行入口加载（入口加载的是 V3），所以是潜在但当前不可达的缺口。不能把它说成“全量逐文件一致”；本轮改用本地试验安装补齐 3 个策略文件后，安装目录另有 `live-install/manifest.json` 记录。

## 2. 分支整理

详见 [branch-report.md](branch-report.md)。摘要：

- 15 条本地临时分支已归档后删除；归档引用 `refs/archive/*` 指向原 HEAD，可恢复。
- `codex/mobile-performance-443`、`fix/mobile-performance-4.4.3` 是 v4.4.4 直接祖先；`codex/release-v4.4.4` 是 v4.4.4 自身；其余 codex/* 的关键标识符在 v4.4.4 中命中 76%–95%，并做了定点核对（`__djscChoiceTrace`、`E_REWARD_STATE_CONFLICT`、`E_DATASET_SCOPE`、`E_AUTOFEATURE_NOT_APPLIED`、`source_auth.py`、`modeModelStore` 动态维度）。
- 本地 `master` 是旧线 QA 集成（相对 v4.4.4 独有 22、缺少 56），保留不动，不 reset、不强推。
- `upstream/fix/client-align-142` 的 2 个独有提交没有进入 v4.4.4：`18f7204` 把特征维度 134 提到 142，`25cae88` 新增 `cloudInference`；v4.4.4 仍是 134 维，且没有该文件。该分支保留，不能直接合并覆盖模型契约。
- Fork 收尾已执行：`origin/master` 从 `78c141f` 非强制快进到 `1fe5292`；独有 0 的 `feature/manual-full-package-20261017` 已删除；`fix/model-lifecycle` 保留，复核后未发现需要移植的独有功能。没有 force push、没有删除标签。

## 3. 142 将清单复核

完整数据：[142-task-list.json](142-task-list.json) / [142-task-list.csv](142-task-list.csv)。保留全部 142 个武将 ID 和技能 ID。

| 维度 | 计数 |
|---|---:|
| 总数 | 142 |
| 修订 P1 | 3（界孙权、周妃、界张辽） |
| 修订 P2 | 49（原 56 个“优先更新候选”中未复现者 + 少量部分验证） |
| 修订 P3 | 90（原“验证后决定”75 + “暂保留”11 + 已验证无问题 4） |
| 已复现 | 3 |
| 验证无问题 | 4 |
| 尚待验证 | 1 |
| 尚未验证 | 134 |
| 已实施 | 3 |
| 无需改动 | 4 |
| 未改动 | 135 |
| 真实宿主通过 | 6 |
| 真实宿主完整回合通过 | 1 |
| 部分通过 | 1 |
| 未测试 | 134 |

### 3.1 已复核的 12 个在册条目

| 武将 | 技能 | 修订优先级 | 复现状态 | 实施 | 实测 |
|---|---|---|---:|---|---|
| 界孙权 `re_sunquan` | `rezhiheng` | P1 | 已复现 | 已实施 | 完整回合3血保留桃；1/2血/防具/回复通过；4血负向对照 |
| 周妃 `zhoufei` | `olkongsheng` | P1 | 已复现 | 已实施 | 原生选3→修正1；重复[1,1]、异常恢复、数组语义通过 |
| 界张辽 `re_zhangliao` | `new_retuxi` | P1 | 已复现 | 已实施 | 原生1+2→优化4+2；屯田/友方/单/零目标通过 |
| 孙权 `sunquan` | `zhiheng` | P3 | 验证无问题 | 无需改动 | 完整回合七种局面；未复现弃闪/桃，策略已移除 |
| 黄盖 `huanggai` | `kurou` | P2 | 尚待验证 | 未改动 | 3血会发动，未发现明确越权 |
| 张辽 `zhangliao` | `tuxi` | P3 | 验证无问题 | 无需改动 | 只有队友有牌时正确放弃 |
| 刘备 `liubei` | `rende` | P3 | 验证无问题 | 无需改动 | 把牌给队友并回复 |
| 界鲁肃 `re_lusu` | `dimeng` | P3 | 验证无问题 | 无需改动 | 只读公开手牌数量，交换正确 |
| 界魏延 `re_weiyan` | `qimou` | P2 | 尚未验证 | 未改动 | 1血返回0；未做完整回合 |
| 典韦 `dianwei` | `qiangxix` | P2 | 尚未验证 | 未改动 | 2血及以下拒绝HP支付；未做完整回合 |
| 界刘备 `re_liubei` | `rerende` | P2 | 尚未验证 | 未改动 | 未建立固定场景 |
| 界黄盖 `re_huanggai` | `rekurou` | P2 | 尚未验证 | 未改动 | 依赖诈降，不能套用标准苦肉阈值 |

### 3.2 清单外发现

- `redimeng`（活动武将/界鲁肃变体，非 142 清单 ID）：混合后的暗牌选择中，原生 AI 用 `get.value(button.link)` 直接挑最高价值牌；真实宿主中第一个选择者拿走【桃】+【无中生有】。同位置置换暗牌牌面后，原生选择索引随牌值变化，优化后索引稳定为 (2,0)/(1,3)。这是明确的隐藏信息读取，按 P0 处理并已修复。清单里的 `re_lusu` 实际使用标准 `dimeng`，两者不能混为一谈。

### 3.3 对原方案的调整

1. **基线重锚**：不再使用 b481b17 的固定行号；按本机 1.11.7 重新定位（`tuxi:786`、`rende:1121`、`zhiheng:1727`、`kurou:1837`、`dimeng:5713`、`kongsheng:2120`、`olkongsheng:787`、`qimou:3661`、`qiangxix:6701`、`new_retuxi:13861`、`rezhiheng:14842`、`redimeng:3356`）。
2. **去重**：按 skill ID 注册策略，不按武将复写。`tuxi`/`new_retuxi`/`rezhiheng`/`zhiheng`/`dimeng`/`redimeng`/`kongsheng`/`olkongsheng` 是不同实现，不能互相套用。
3. **优先级重建**：原 P1/P2/P3 只是排期；本轮只在有真实复现时升级。142 中 P0 为 0；P1 3；P2 49；P3 90。标准制衡在完整回合复核后改为“验证无问题/无需改动”。
4. **交接材料**：测试包没有源码快照；已归档原始包到 `source/`，并明确“原方案参考 b481b17、本机宿主 1.11.7”的区别。无法从包内取得的内容不虚构。
5. **保留成熟策略**：标准制衡、标准突袭、标准仁德、标准缔盟、新版箜声、界黄盖诈降均未强改；标准制衡经完整回合验证无需改动，策略已移除。界张辽已有扩展目标桥，本轮只补“同等敌意下按公开手牌数”的薄策略。

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
   - 本轮新增：`skillAIPolicies` 对 `rezhiheng` 的 `check/order/result`、`new_retuxi` 的 `chooseTarget`、`redimeng` 的 `chooseButton`、`olkongsheng` 的 `cost` 做薄封装；标准 `zhiheng` 经完整回合验证后不再注册。
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

- **原始行为（完整 phaseUse）**：3血/max3、[桃,杀,杀]，原生先用【杀】，再用界制衡弃【桃】+【杀】并摸3；最终只剩【闪】。1/2血和防具场景同样存在弃桃风险。
- **修改**：`skillAIPolicies` 只在 `rezhiheng` 低血（≤3）时把【桃】【闪】的 `check` 分数压到 ≤-1，并包住 `ai.order`/`ai.result.player`；若手里全是这些防御牌则放弃换牌。4血及以上不改。
- **正向**：3血/2血/1血、只桃/只闪、混合、含回复、防具场景均保留桃/闪；全手换牌的 4血负向对照仍按原生执行。真实宿主 `policyStats.keptTao=18`、`keptShan=3`。
- **反向**：标准制衡不注册；装备区不干预；4血不禁止全手换牌；人类路径不变。
- **真实宿主**：3血 native 弃桃+杀摸3；优化保留桃、只弃非防御并摸1-2；4血 native/优化都走全手换牌（负向对照）。
- **性能/回退**：纯规则 p99 1.9µs；卸载还原；异常返回原生分。

### 5.2 周妃旧版【箜声】数量表达式

- **原始行为**：`olkongsheng.cost` 的 AI 中 `getExpansions("olkongsheng") + ui.selected.cards.length`；前者是数组，数组+数字转成字符串，阈值比较失真。
- **复现**：已有一张“箜”、3张无懈、受伤队友1手牌；原生成本AI选3张无懈（应停在1张以形成良姻回复阈值）。
- **修改**：只在该次 `cost` 调用期间，让 `getExpansions` 返回数组副本并加 `valueOf/toString=length`；不复制宿主技能、不改技能规则。数组的索引/长度/迭代/JSON 序列化保持不变；重复调用 [1,1]；人为让 chooseCard 抛错后作用域仍恢复。加入 `olkongshengCostNeedsFix` 指纹，宿主改写表达式后跳过并告警。
- **正向**：真实宿主修正后只选1张；`olkongshengCostCalls=4`（含重复/异常场景），`olkongshengCompatible=true`。
- **反向**：未在 `cost` 期间调用 `getExpansions` 的其他代码走原数组；卸载还原；宿主形态变化时不强套。
- **注意**：这是旧版 `olkongsheng`；新版 `kongsheng` 只做了表达式复核，未宣称修复。

### 5.3 界鲁肃 `redimeng` 暗牌公平选择（清单外 P0）

- **原始行为**：`redimeng` 混合两名角色的手牌后，当前选择者用 `get.value(button.link, player)` 直接挑最高价值牌；人类同一界面是暗牌。
- **复现**：混合池[桃,杀,闪,无中]，原生第一个选择者拿走桃+无中；同一局面同位置置换暗牌牌面后，原生选择索引随牌值改变（(3,0)/(1,2) → (1,2)/(0,3)）。
- **修改**：`skillAIPolicies` 的 `chooseButton` 钩子在 `redimeng` 技能上下文中，把 AI 分数改成只依赖“按钮位置+玩家id”的稳定分数；不读牌面、不使用隐藏信息。分数函数自身不抛错，不调用原生看牌评分；resolver 失败时保留 `redimengMaskFailed` 计数，不宣称安全回退。
- **正向**：真实宿主公平分配；置换牌面后两次选择索引稳定为 (2,0)/(1,3)；`fairRedimeng=9`，`redimengMaskFailed=0`。
- **反向**：人类选择者跳过；联机禁用接管时策略不安装；卸载还原；录像若重跑 AI，分数只依赖位置/玩家 id，同按钮顺序下可复现。
- **注意**：该技能不在 142 清单内（活动武将/界鲁肃变体），但正是用户要求检查的“界鲁肃缔盟隐藏手牌”问题。宿主原生漏洞的最小建议：在 `redimeng` 的 chooseButton AI 里只在暗牌对选择者公开时使用 `get.value(button.link)`，否则用常量/随机；本轮不修改本体。

### 5.4 界张辽【突袭】目标收益

- **原始行为**：三名敌人手牌 1/4/2，原生只按态度选 1+2，跳过 4；v4.4.4 扩展桥能带上 4，但第二个目标仍有时选 1 而非 2。
- **修改**：`skillAIPolicies` 只对 `new_retuxi` 的 `chooseTarget`，在原生分数上对敌人按公开手牌数加 0–2 的有界小分；不改合法目标集合，不碰标准 `tuxi`，不注册未测的 `retuxi`。屯田/`nocard` 目标不加奖励。
- **正向**：真实宿主选 4+2；屯田目标失牌 0；`retuxiTargetBonus=14`。
- **反向**：只有友方、单目标、零目标、中立目标场景均保持原生放弃/正常摸牌；友方手牌不被拿；部分场景 `attitude=3` 的中立目标不享受奖励。
- **性能/回退**：O(1)/目标；异常返回原生分；卸载还原。没有添加“无敌人则跳过”的发动护栏，因为干净原生对照已经会放弃，之前看到的是死亡污染。

### 5.5 标准孙权【制衡】（验证无问题）

- 完整 `phaseUse` 七种局面：3血/max3 会用制衡弃两杀保留桃；3血/max4 会先用桃回血；1血会先用桃；1血[闪,无懈]不发动；击杀场景先击杀再换牌；防具场景保留装备。
- **未复现**上一轮隔离 `chooseToUse` 的“选闪/桃”结果；那是夹具在局部选择函数里产生的假象。标准制衡不注册策略，保持原生；142 清单改为“验证无问题/无需改动/完整回合通过”。

## 6. 测试与性能

详见 [test-report.md](test-report.md)。

- 新增真实宿主场景 38 个，覆盖完整 phaseUse、技能成本/目标/暗牌置换、重复/异常、卸载重装；原生、仅策略、完整扩展三种对照；0 页面错误。
- 新增纯规则单测 14 条、架构契约 8 条；新增策略微基准。
- 41 个 Node 回归入口全部 exit=0、0 FAIL；2V2 10 个入口、移动端 5 个入口全部通过。
- 托管局（含 live 安装样本）：
  - 身份：44 样本，p50 37.0 / p95 171.1 / p99 194.7 / max 199ms；2 局完成，1 局旧版 runner 到 180s 上限（106 回合、无错误）。
  - 斗地主：73 样本，p50 23.0 / p95 63.6 / p99 74.5 / max 81ms；4/4 完成。
  - 2V2：65 样本，p50 32.0 / p95 100.0 / p99 135.5 / max 147ms；4/4 完成。
- 本轮观测最坏 199ms < 800ms 回退阈值；样本分布受机器负载影响，p99 不是长期保证。
- 策略纯规则：p50 0.3µs / p95 0.6µs / p99 1.9µs；最大 3027µs 为单次 GC/调度离群，不在决策路径。
- 本地试验安装：3 个运行时文件，38 场景 0 错误，完整引擎卸载/重装通过；备份/哈希/回滚见 `live-install/`。

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
- **样本量**：每模式 44–73 个决策样本；p99 接近最大，统计意义有限；身份局有 1 局旧版 runner 到 180s 上限未结束。
- **标准孙权**：完整 phaseUse 复核未复现缺陷，已从策略中移除并标记验证无问题；不再作为待修复项。
- **奇谋/强袭/界仁德/界苦肉**：只做代码复核，未做完整回合；保持未验证/未改动。
- **清单外 `redimeng`**：修复了隐藏信息读取，但它不属于 142 清单；版本归属需在后续 PR 说明。
- **宿主漂移**：策略依赖 1.11.7 的 `olkongsheng` 内部表达式和 `redimeng` 选择结构；宿主升级后如果改写这些函数，钩子会 fail-open（不报错，但不一定继续生效），需要重跑场景。
- **模型/特征契约**：没有合并 `client-align-142`；v4.4.4 仍是 134 维。没有改模型权重、训练标签、特征维度。
- **Fork 同步**：已执行；`origin/master` 快进到 `1fe5292`，独有 0 的 feature 分支已删；`fix/model-lifecycle` 保留复核。
- **安装目录缺失文件**：`client_policy_model_v2.js` 是已知的不可达 v2 模型包；如果未来手动加载 `policyModelV2`，需要先补齐该文件。
- **本地试验安装**：只改了 3 个运行时文件，回滚脚本已就绪；未做公开发布。

## 9. 后续计划

详见 [next-batches.md](next-batches.md)。按机制分组：信息范围审计 → 生命支付/停止条件 → 目标与失牌收益 → 资源与牌序 → 响应/时机。下一阶段前置条件是固定种子 + 完整回合 runner + 三模式对照；不按 142 个武将逐个重写。

## 10. Git 提交记录

本轮在既有 `codex/release-v4.4.4` 分支（基于 `v4.4.4`）上分层提交：

| 提交 | 内容 |
|---|---|
| `927464f` | `docs(skill-ai): 归档 v4.4.4 基线与 142 将复核清单` |
| `d888a1d` | `test(skill-ai): 增加真实宿主技能决策场景与策略单元测试` |
| `d74be22` | `feat(skill-ai): 低血防御保留、缔盟公平选牌、突袭目标收益与箜声数量修正` |
| `f78710e` | `docs(skill-ai): 第一批优化实测报告、分支审计与后续计划` |
| `2d02c47` | `fix(skill-ai): 解引用 annotated tag 并扩展全量运行基线` |
| `154dbd5` | `fix(skill-ai): 收紧策略边界、兼容指纹与134维契约测试` |
| `fb815a1` | `test(skill-ai): 增加完整回合、暗牌置换、特殊目标与生命周期场景` |
| `aed71a8` | `test(skill-ai): 增加完整引擎生命周期与托管停滞诊断` |
| `ca08285` | `test(skill-ai): 托管烟测安装策略并记录策略统计` |
| `5324996` | `docs(skill-ai): 二次审查、Fork 收尾与本地试验安装` |
| 本文档所在提交 | `docs(skill-ai): 补记提交记录`（见 `git log -- docs/skill-ai-20261030/REPORT.md`） |

本地试验安装部署自 `aed71a8` 的 3 个运行时文件；详见 `live-install/manifest.json`。没有改 `master`，没有 force push，没有删除发布标签。

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
- `tools/test-skill-ai-architecture.mjs`：134 维/接线契约测试
- `tools/bench-skill-ai-policies.mjs`：微基准
- `tools/build-skill-ai-baseline.py`：全量基线生成（含 tag 解引用）
- `tools/build-skill-ai-task-list.py`：清单生成脚本
- `tools/rollback-skill-ai-live.py`：本地试验安装回滚
- `live-install/`：部署清单、备份、安装目录 38 场景验证结果
- `score/decision/skills/skillAIPolicyRules.js`：纯规则
- `score/decision/skills/skillAIPolicies.js`：宿主薄适配层
