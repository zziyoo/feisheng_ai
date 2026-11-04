# 神话再临·火 原生 AI 改造对照（宿主 1.11.7）

本目录给出可直接审查的原生 AI 补丁；补丁只改武将技能的 AI 决策函数，不改技能规则、目标合法性、伤害/回复结算或非 AI 流程。

本轮为第二次修订：新增完整引擎接线（天义）、已知必胜拼点例外（天义）、濒死否决的减伤/响应复核（乱击）与护甲复核（鞬出）。三项优化按性质区分：**乱击为缺陷修复**（会把队友直接送入濒死），**天义/鞬出为质量提升**（原生合法但次优）。

## 适用源码与校验

- 宿主：无名杀 1.11.7，文件 `character/shenhua.js`
- 原文件 SHA256：`62f789e336a11a0613c68f3309ebc81640f53b4baf6c07cacde99992284e813e`
- 应用全部补丁后 SHA256：`34c057eb7b0a8877c49f73f29d6c53eb25288527f7a8814b0d008cb339035e59`
- 三个逐武将补丁均在独立基线副本上通过 `git apply --check`；累计补丁 `huo-native.patch` 亦独立通过，应用后文件通过 `node --check` 语法检查。
- 基线与风包相同（风包补丁未应用时的原始 1.11.7 源码）；如已应用风包补丁，请按行号语义人工合并，两批补丁修改的技能互不重叠。

## 应用方式

在宿主源码的独立副本或工作树中执行：

```bash
git apply docs/skill-ai-quality-20261103/huo-native/huo-native.patch
```

或按武将逐个应用 `0001`～`0003`。不要直接覆盖正式游戏安装目录；应用前先备份 `character/shenhua.js`。

原生补丁与无名AI扩展分包是两种集成方案，不要在同一个宿主同时启用；扩展分包通过 `host.wrap` 镜像同样的 AI 判断，两处同时生效时扩展在原生结果上做幂等判断，不会重复结算，但会造成维护漂移。

## 逐武将修改

| 武将 | 技能 | 性质 | 原生入口 | 原生逻辑 | 本次修改 | 提交 |
| --- | --- | --- | --- | --- | --- | --- |
| 袁绍 | 乱击 `luanji` | **缺陷修复** + 质量提升 | `check(card)`，基线 7179 | 每个目标效果压成 sgn 求和；1血空手无防具队友只贡献一个被压缩的负值；目标面不足5人时没有任何净收益门槛 | ① 存在“1血、空手、无防具、**且无护甲、无 freeShan 自动响应能力**”的可受击队友时拒绝发动（复用宿主 `hujia` 减伤与 `hasSkillTag('freeShan')`（如八阵虚拟八卦）真实判断，不凭空认定空手队友必然受伤）；② 补齐小规模门槛：目标面 <5 时净收益 `num < 1` 返回 0 | 补丁仓 `huo-final2` 0001 |
| 太史慈 | 天义 `tianyi` | 质量提升 | `ai.order`（主）+ `ai.result.player/target`（兜底），基线 6942 | 只要手里有杀就给正 order 与 0.6 player 分，从不评估拼点胜率；attitude(self)=10 将 player 分放大为使用决策主导项 | 手里最大点数 < 10（拼点双方都倾向出最大点数，拼点牌还要置入弃牌堆，输掉后 天义3 锁杀）且**不存在已知必胜拼点**时：`ai.order` 返回 0（宿主 AI 点击技能只看 get.order，order≤0 即不进入 AI 出牌序列；实测这是完整引擎下唯一不被绕过的入口），`result.player/target` 双侧归零兜底；对手手牌完全已知（`getKnownCards` 覆盖全部手牌，含唯一拼点牌已公开）且其最大点数确定更低时放行；其余分支保持原生。否决不使用负值——`get.effect` 合成为 result1×att(self)+result2×att(target)，attitude(self) 符号不稳定（完整引擎缓存上下文实测可为负），负值会被乘号翻正 | 补丁仓 `huo-final5` 0002 |
| 庞德 | 鞬出 `jianchu` | 质量提升 | `check(event, player)`，基线 3307 | 只按态度判断：任何敌人有牌就触发，弃置手牌路径会把这张杀送给目标 | 目标有装备可拆（附带杀不可响应）、目标仅剩最后一张手牌（拆掉后杀不可响应）、或目标 hp≤1 **且无护甲**（击杀动机；有护甲时 1 点伤害先被吸收，白送杀不划算）时才触发；其余敌人跳过 | 补丁仓 `huo-final2` 0003 |

### 决策差异与收益（真实宿主证据）

- **乱击**：固定局面（队友1血有手牌、两敌满血；万箭目标面经夹具限制为3人）净收益 = 1+1-1.5 = 0.5，原生 `check=6` 照常发动；补丁 `check=0` 拒绝。反向局面（无1血队友，净收益 = 1+1-1 = 1）补丁仍返回 `6-value`，发动不变。濒死否决沿用真实宿主验证（`quality-luanji-ally-lethal` 拒绝、`quality-luanji-enemy-lethal` 全敌方照常发动）；带护甲或八阵（freeShan）的 1 血空手队友不再触发否决（规则单测覆盖）。
- **天义**：
  - 低点数：固定局面（手里 杀3/闪4/闪5，最大点数5，敌方手牌未知）原生 `useSkill tianyi` 真实发动并白弃拼点牌；修正后不发动。
  - 已知必胜例外：固定局面（最大点数5，敌方唯一拼点牌已公开、点数2，`_knowers=['everyone']` 等价明置/展示过的牌）修正后仍发动（`quality-huo-tianyi-knownwin`）。例外只使用 `getKnownCards` 完全覆盖对手手牌的公开信息，不读取隐藏牌面。
  - 高点数守卫：手里 13/12/3 时原生与修正后均发动。
  - 完整引擎：见下方「完整引擎接线」。
- **鞬出**：固定局面（敌人满血、无装备、3张手牌）原生触发鞬出——弃目标 1 张手牌后把杀送给目标（`enemyGainedSha=true`）；补丁跳过，杀正常结算。反向局面（敌人带八卦阵）原生与补丁均触发并弃置防具（直杀）。hp≤1 但有护甲的目标不再走击杀分支（护甲会吸收这 1 点伤害），其余分支不变。

### 修正后收益与代价

- 乱击：代价是小规模对局里“恰好打平”的万箭不再白烧两张牌；收益是杜绝净亏本乱击与把 1 血空手无防具队友直接送进濒死。有护甲/自动闪响应的队友不受过度保护。爆手牌状态（`needsToDiscard(-1)`）保留原生“顺手清牌”路径。
- 天义：代价是放弃低点数下的低胜率赌博；收益是保住拼点牌与杀的本回合可用性。高点数（≥10）与已知必胜拼点的主动拼点与原生完全一致。
- 鞬出：代价是放弃“弃对方手牌可能摸掉闪”的小概率收益；收益是不再在对方无装备时白送一张杀。有装备、可击杀（无护甲）、空手/单牌目标的行为与原生一致。

## 完整引擎接线（天义）

无名AI完整扩展的技能提交有多条管线（宿主自动流程点击、引擎候选直提、planner refine），且运行时评估会绕过 `ai.result.*` 的 wrap、`get.effect` 合成中 attitude(self) 符号不稳定（实测可为负，负否决值 -0.9 被乘号翻正为 +8.8——真实宿主探针证实）。逐层实验后确定**真实消费入口是 `get.order`**：宿主 AI 点击技能只看 `ai1=get.cacheOrder`，order≤0 的技能不进入 AI 出牌序列（完整引擎下该入口未被任何管线绕过）。

最终接线（三层一致）：

1. **原生补丁**：`tianyi.ai.order` 顶部加判断——最大点数<10 且无已知必胜拼点时返回 0；`result.player/target` 双侧归零兜底（对 attitude 符号免疫）。
2. **扩展分包**：`host.wrap(ai, 'order', 'tianyi:ai:order', …)` 同一判定（`tianyiLowCompare` + `tianyiKnownWinAvailable`）→ 0；result 双侧归零同源。
3. **引擎候选层（skillVetoRegistry）**：新共享注册表 `score/decision/skills/skillVetoRegistry.js`；三处查询——`skillPlayBrain.vetoSkill` 规则⑤、`activeSkillEligibility.activePlaySkills`（全部候选管线的公共枚举入口，`_candDiag.packVeto` 诊断计数）、`override/use.js` staging 守卫；分包 install 时注册、卸载时按 tag 清理，抛错 fail-open。

决策留痕：`policyStats.shenhua_huo.tianyiDecline`（order/result 门命中）、`tianyiKnownWinPass`（例外放行）、`tianyiEngineVeto`（引擎候选层否决）；引擎候选理由含 `[技能否决] 天义：手里最大点数N，无已知必胜拼点，拼点牌弃置且输后锁杀`。乱击（`check` 参与卡牌价值路径）与鞬出（触发器 `check` 不被引擎拦截）无需接线即三层一致。

## 复核后不纳入补丁的技能

| 武将 | 技能 | 复核结论 |
| --- | --- | --- |
| 荀彧 | 驱虎 `quhu` | 原生 `result.target` 的第三方扫描（范围内存在任意正伤害收益即发动）是“借刀击杀”扫描的**超集**：可借刀击杀的局面（范围内有 1 血敌人、手里有高点数）原生本就会真实发动并完成击杀（真实宿主 `quality-huo-quhu-kill` 原生 `useSkill quhu` 且造成伤害）。`result.player` 的节命价值门槛（`-20/0/1/max` 分档）通过 attitude(self)=10 的放大项参与否决，卖血分支是有意设计。未找到可证明的发动缺口。 |
| 荀彧 | 节命 `jieming` | 真实宿主固定局面证实 `get.attitude(player, player)=10`：原生已会把补牌目标评为荀彧自己（空手自补到 min(5,maxHp)），nogain 降权、敌方负分排除、多人受伤按 `getIndex(event.num)` 分别选人均正确。曾提交的“允许自补”补丁为无效改动，已撤销（`quality-huo-jieming-self` 双方行为一致）。 |
| 庞统 | 连环 `lianhuan` | `ai1`（材料 6-value）、`ai2`（逐目标 `get.effect(tiesuo)`）、重铸/使用双路径均接入宿主评分；上一轮“一律跳过已横置”的错误实现已撤销且未恢复。未发现新的明确缺陷。 |
| 庞统 | 涅槃 `oldniepan` | `save: true` + `order: 1` 为濒死最后手段；桃/酒救援按 order 先行，`result.player` 濒死必救。`hp<=2 && he<=1` 分支在 dying-only filter 下不可达，属无害死代码，未动。 |
| 典韦 | 强袭 `qiangxix` | 原生会优先弃武器支付（真实宿主复现连弩被弃），但宿主没有稳定的“选哪张武器”AI 钩子：给 `check`/`ai1` 加评分会把丈八也改为保留，属过度优化。维持上一轮结论。 |
| 卧龙 | 火计 `huoji` | `check` 只做材料价值门槛（爆手牌 6-value / 平常 3-value）；火攻的成功率、已知牌花色匹配、无懈时机、自弃选择均由 `lib.card.huogong` 的 AI 承担（`card/extra.js`，含 `isAllCardsKnown` 精确匹配与 `huogong2` 防重复）。`viewAsFilter` 返回 undefined 按 `=== false` 约定为启用，非缺陷。 |
| 卧龙 | 看破 `kanpo` | 材料选择 `8 - value` 取最低价值黑牌；是否响应锦囊由无懈共享判定链（`chiling` 已特判）决定，未发现浪费桃/闪路径（标准牌堆无黑色闪）。 |
| 颜良文丑 | 双雄 `shuangxiong` | 判定门槛（手牌>体力 或 >3）与 `viewas.check`（`getUseValue(决斗) - getUseValue(原牌)`）均接入宿主估值；3张手牌强制改判在固定局面未证明严格优于摸牌，维持上一轮结论。 |
| 袁绍 | 血裔 `xueyi` | 纯被动：手牌上限 mod，`shenhua-huo-passive-rules` 已验证生效，无决策入口。 |
| 卧龙 | 八阵 `bazhen` | 空防具位虚拟八卦：`inherit: "bagua_skill"` 继承宿主八卦 AI（respondShan/freeShan/effect），无独立缺陷。 |
| 庞德/马超 | 马术 `mashu` | 纯被动距离 mod，`shenhua-huo-passive-rules` 已验证 -1 生效，无决策入口。 |

## 验证

- 纯规则单测（Node，无浏览器）：`score/decision/skills/rules/shenhuaHuo.js` 的 `luanjiAllyLethal`（含护甲/freeShan 例外）/ `luanjiNetTooLow` / `tianyiLowCompare` / `tianyiKnownWinAvailable`（含部分已知、平点、非敌、高点数反例）/ `jianchuWorthwhile`（含护甲反例）直接 import 断言，全部通过（见 `huo-rules-unit.json`）。
- 真实宿主固定局面（identity 8人局夹具，`tools/trick-real-host-smoke.mjs --skill-ai`）：
  - 原生基线：`huo-quality-native.json`（10 场景呈现待修正行为）
  - 策略层（扩展镜像）：`huo-quality-policy.json`
  - 完整扩展引擎：`huo-quality-extension.json`（**10/10 场景与策略层完全一致**：天义低点数 `usedTianyi=false`、高点数/knownwin 放行、乱击 check 否决、鞬出跳过；`policyStats.shenhua_huo` 三项计数留痕）
- 夹具限制说明：身份局固定夹具为 8 人，万箭目标面恒为 7 人，小规模净收益分支无法在完整结算里自然出现；`quality-huo-luanji-net` 在**决策探针**里把 `canUse` 限制到受控的 3 个目标后调用真实的 `luanji.check`（含扩展接管），不做任何结算。该分支的数值语义由 Node 纯规则单测覆盖，濒死否决与全敌方守卫由真实结算场景覆盖。
- 扩展侧镜像：`score/decision/skills/packs/shenhuaHuo.js`（`luanji:check`、`tianyi:result:player`、`jianchu:check` 三处 `host.wrap` + 天义引擎否决注册），与补丁逐条对应；两者二选一使用。

## 探索过程中被证据否决并撤销的修改

为避免后来者重蹈覆辙，记录三处已被真实宿主数据否决的候选修改：

1. **节命“允许自补”**：`get.attitude(player, player)` 在本宿主身份局为 10 而非 0，原生本来就会自补；补丁为无效改动，已撤销。
2. **驱虎“击杀机会加分”**：`result.target` 的第三方扫描是击杀扫描的超集，可击杀局面原生必然发动；补丁无行为差异，已撤销。
3. **天义“target 侧归零”**：`result.player(0.6) × attitude(self)(10) = +6` 是使用决策的主导项，仅将 target 侧归零无法否决发动（真实宿主仍 `useSkill tianyi`）；必须改 player 侧。
