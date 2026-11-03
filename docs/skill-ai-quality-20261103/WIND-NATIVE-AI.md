# 神话再临·风 原生 AI 改造对照（宿主 1.11.7）

本目录给出可直接审查的原生 AI 补丁；补丁只改武将技能的 AI 决策函数，不改技能规则、目标合法性、伤害/回复结算或非 AI 流程。

## 适用源码与校验

- 宿主：无名杀 1.11.7，文件 `character/shenhua.js`
- 原文件 SHA256：`62f789e336a11a0613c68f3309ebc81640f53b4baf6c07cacde99992284e813e`
- 应用全部补丁后 SHA256：`a4447484d98c93c78d2fece0841277eb2919a79c7ae240bcfa1417341b46f433`
- 六个补丁均在独立基线副本上通过 `git apply --check`；累计补丁应用后哈希与 `SHA256.json` 一致。

## 应用方式

在宿主源码的独立副本或工作树中执行：

```bash
git apply docs/skill-ai-quality-20261103/wind-native/wind-native.patch
```

或按武将逐个应用 `0001`～`0005`。不要直接覆盖正式游戏安装目录；应用前先备份 `character/shenhua.js`。

原生补丁与无名AI扩展是两种集成方案。扩展分包通过 `host.wrap` 镜像同样的 AI 判断；若同时使用，建议只保留一种，避免后续维护时两处逻辑漂移。两者同时加载时，扩展会在原生结果上做幂等判断，不会重复扣血/重复摸牌。

## 逐武将修改

| 武将 | 技能 | 原生入口 | 原生逻辑 | 本次修改 | 提交 |
| --- | --- | --- | --- | --- | --- |
| 曹仁 | 据守 `jushou` | `check(event, player)`，基线 7543 | `hp + 手牌 < 4` 才发动；已翻面时再次发动会翻回正面，却没有被利用 | `player.isTurnedOver() || hp + 手牌 < 4`；已翻面时摸3张并翻回正面 | `da232e1` |
| 夏侯渊 | 神速1 `shensu1` | `cost` 内 `chooseTarget` 的 `ai`，基线 7452 | `check = 手牌 > 2` 为真才给目标正分；低手牌即使判定区有乐/兵粮/闪电也放弃 | 保留 `check` 分支；`check` 为假时，若判定区有 `lebu`/`bingliang`/`shandian` 且虚拟杀目标效果为正，仍给正分；无不良判定时保持放弃 | `0749a7e`、方向修正 `e0f7148` |
| 于吉 | 蛊惑 `xinfu_guhuo` | `chooseButton.check(button)`，基线 8720 | 1血、无真牌、有敌人时仍给诈称正分；被质疑失去1点体力会进入濒死 | 在“无真牌 + 1血 + 非濒死”时返回0；有真牌、3血或非濒死分支保持原生 | `ce66ca0` |
| 魏延 | 狂骨 `xinkuanggu` | `cost`，基线 3756 | 只有“手里足够的杀可用”时才回复；1血空手仍摸牌 | 1血且可回复时优先回复；其余沿用原生“足够杀”条件 | `9df7034` |
| 魏延 | 奇谋 `qimou` | `ai.result.player`，基线 3697 | `lib.filter.cardUsable(card, player)` 为真时直接返回0，即使远处目标在支付后可达、可击杀 | 保留原生其余条件；仅在“杀次数只是表面阻塞、支付后目标可达且可击杀、支付不自死”时返回1 | `9df7034` |
| 张角 | 黄天 `huangtian2` | `ai.result.target`，基线 8652 | 固定返回5；1血把最后一张闪转交主公，自己失去唯一防御 | 1血、无闪电、只剩最后一张闪时返回0；多闪/有闪电/非1血仍返回5 | `bd192a8`、判定修正 `2971478` |

### 决策差异与收益

- 据守：固定局面原生 `drew=0, turned=true`；补丁 `drew=3, turned=false`。反向 4血3手牌不发动，保持原生。
- 神速1：固定局面原生 `usedSha=false, judge=0`（乐照常结算）；补丁 `usedSha=true, judge=1`（跳过判定并用虚拟杀命中敌方）。无判定低手牌仍放弃。
- 蛊惑：固定局面原生声明分 `4.70`；补丁在1血无真牌时为 `0`，3血同局面仍 `4.70`。
- 狂骨：固定局面原生1血摸1张；补丁回复1点体力；3血反向仍摸牌。
- 奇谋：原生 `paid=0, enemyHpLoss=0`；补丁在 hp4/距离4/hp3 目标时 `paid=3, enemyHpLoss=4`，hp4目标反向仍 `paid=0`；hp3/距离3/hp2 目标 `paid=2, enemyHpLoss=1`。
- 黄天：原生1血交闪后 `hand=[]`、主公获得闪；补丁保留闪、不发动；3血双闪仍转交一张。

## 审查后保留原生的技能

| 技能 | 审查入口 | 保留原因 |
| --- | --- | --- |
| 雷击 `releiji` | `cost` 的 `chooseTarget.ai`；`ai.effect.target_use` | `get.damageEffect`/`get.effect` 已按态度和铁索传导计分；`quality-releiji-linked-ally` 未复现雷击队友的退化 |
| 鬼道 `guidao` | `cost` 中 `chooseCard` 的 `ai` | 已按判定值差、牌价值、装备折价和敌我态度判断；黑桃/梅花能改善的判定类型均覆盖，未找到不引入新价值常数的严格更优改法 |
| 天香 `retianxiang` | `cost` 的 `ai1/ai2`；结算时目标二选一 AI | `ai2` 已按伤害效果、目标已损体力、态度给分；1血 `da=10` 是刻意自保权重，未用未复现的规则替换 |
| 红颜 `hongyan` | `mod.suit` | 被动花色规则，无独立 AI 选择入口 |
| 不屈 `gzbuqu` | `gzbuqu_recover.content` 的 `chooseCardButton.ai` | 只选择移除哪张“创”，按重复点数优先；不改变点数唯一性，缺少可证明更优的牌张价值入口 |
| 烈弓 `xinliegong` | `check`；`ai.directHit_ai`；`mod.aiOrder` | 原生已按敌我、不可响应/加伤条件给分；命中/负向场景通过，不改目标合法性或增伤结算 |

## 证据

- `wind-native-baseline.json`：未修改宿主上的同一组固定局面（原生基线）。
- `wind-native-patched.json`：应用本补丁后的固定局面。
- `wind-native-compare.json`：逐场景原生/补丁语义对照，`semantic_all=true`；登记差异为奇谋 2 项、狂骨、据守、神速1、蛊惑、黄天。
- `wind-extension.json`：无名AI 风分包在未修改宿主上的镜像决策（含新增质量场景）。
- `wind-acceptance.json`：风分包 ZIP 的安装/宿主/回滚/134维契约验收。
- `wind-lifecycle.json`：新增据守/神速1/蛊惑/黄天钩子的安装→卸载→重装标记检查。
- 场景实现：`tools/skill-ai-host-scenes.mjs` 的 `quality-*` 场景；验收判据：`tools/accept-skill-ai-pack.mjs`。
