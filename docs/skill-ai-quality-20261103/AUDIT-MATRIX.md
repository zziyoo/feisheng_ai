# 神话再临·风 原生 AI 质量审查矩阵（2026-11-03）

宿主：无名杀 1.11.7；扩展：4.4.4；审查对象：风 12 项登记技能。
本表区分“实际运行时优化”“完成审查保留原生”“仅规则验证”，不以场景能执行代替质量结论。

## 运行时优化

| 技能 | 原生入口（宿主源码） | 问题与证据 | 运行时改动 | 正/反向证据 |
|---|---|---|---|---|
| 界魏延·狂骨 `xinkuanggu` | `character/shenhua.js:3756` `cost`：只在“手里有足够杀”时回复 | 1血、空手、刚对距离1角色造成伤害时，原生仍选摸牌；固定局面 `quality-kuanggu-lowhp` 原生 `hp=1, draw=1` | `packs/shenhuaFeng.js` 重写 `cost` 的 AI 选择：1血且可回复时选 `recover_hp`，其余沿用原生条件；规则不变 | 正向 `quality-kuanggu-lowhp`：扩展 `recover=1, hp=2`；反向 `quality-kuanggu-midhp`：扩展仍摸牌、体力不变 |
| 曹仁·据守 `jushou` | `character/shenhua.js:7543` `check` | 已翻面时发动据守会摸3张并翻回正面；原生 `hp+手牌<4` 会漏掉这一免费收益 | 原生补丁 `da232e1` + `packs/shenhuaFeng.js` 镜像：`isTurnedOver() || hp+手牌<4` | 正向 `quality-jushou-turned`：原生 `drew=0, turned=true`，补丁 `drew=3, turned=false`；反向 `quality-jushou-normal` 两者都不发动 |
| 夏侯渊·神速1 `shensu1` | `character/shenhua.js:7452` `chooseTarget.ai` | 低手牌时原生直接放弃，即使判定区有乐/兵粮/闪电会被跳过；旧补丁只要存在不良判定就发动，未比较放弃摸牌的代价 | 原生补丁 `0749a7e`/`e0f7148`/`27e46d3` + 扩展镜像：低手牌 + 不良判定 + 虚拟杀收益不低于一次摸牌价值时放行 | 正向 `quality-shensu1-lowhand-lebu`：原生 `usedSha=false, judge=0`，补丁 `usedSha=true, judge=1`；反向 `quality-shensu1-reverse-lowvalue`：所有敌方各两张闪时收益 `3.861 < 9.9`，补丁/扩展不发动，乐正常判定并移除；无判定低手牌 `shenhua-shensu-negative` 仍放弃 |
| 于吉·蛊惑 `xinfu_guhuo` | `character/shenhua.js:8720` `chooseButton.check` | 1血、无真牌仍给诈称正分；宿主 1.11.7 的假牌结算为“此牌作废”（不直接失去体力），但会损失扣置的防御牌；旧守卫在1血一律拦截，连可弃闪电的合理诈称也被改走丈八 | 原生补丁 `ce66ca0`/`751b29a` + 扩展镜像：1血无真牌时，只有存在可弃低价值非防御牌（非闪/非桃且 `get.value < 6`）才保留诈称；否则返回0 | 评分：`quality-guhuo-bluff-lowhp` 原生4.70→扩展0，3血同局面仍4.70，但该评分局面不能证明真实行为差异。完整出牌：`quality-guhuo-full-lowhp-fake-lastshan` 原生最终也未发动（先选sha声明后放弃），扩展不声明，双方均保留闪；`quality-guhuo-full-lowhp-true-sha-forced`、`quality-guhuo-full-lowhp-fake-expendable`、`quality-guhuo-full-midhp-fake-expendable` 原生/扩展均实际发动并记录扣牌/伤害/质疑结果 |
| 张角主公技·黄天响应者 `huangtian2` | `character/shenhua.js:8652` `ai.result.target` | `huangtian` 是张角主公技，`huangtian2` 由其他群势力角色在出牌阶段响应；该 AI 评价的是交牌者把【闪】/【闪电】交给张角的目标分。固定返回5；交牌者1血时把最后一张闪交给张角，自己失去唯一防御；旧补丁在有闪电时直接放行，仍可能交闪 | 原生补丁 `bd192a8`/`2971478`/`7dabb0b` + 扩展镜像：读取 `ui.selected.cards`；1血选中闪且无备用闪返回0；选中闪电返回5；多闪/非1血保持5；已选牌但无法辨别时保守返回0 | 正向 `quality-huangtian-last-shan`：原生交出闪，补丁保留；`quality-huangtian-last-shan-with-shandian`：双方都只交闪电、保留闪；`quality-huangtian-forced-shan-with-shandian`：强制选闪时原生仍交最后闪，补丁/扩展评分为0并保留；反向 `quality-huangtian-midhp` 3血双闪仍转交 |

`qimou` 为 2026-10-31 已落地的既有修复；本轮将其与 `xinkuanggu` 一并纳入原生补丁 `9df7034`，不计入本轮新增运行时优化数量。

## 风包 12 项逐项结论

| 技能 | 原生 AI 入口 | 已检查的决策边界 | 结论 |
|---|---|---|---|
| `releiji` 雷击 | `shenhua.js:7321` cost 的 `chooseTarget.ai`；`7358` 的 `target_use.effect` | 目标敌我/伤害；`quality-releiji-linked-ally` 额外检查铁索传导 | 完成审查，保留原生：`get.damageEffect`/`get.effect` 已把连环目标按态度计入，真实局面选择未横置目标 |
| `guidao` 鬼道 | `shenhua.js:8472` cost 的选牌 `ai` | 判定差值、黑牌价值、装备折价、是否改判 | 完成审查，保留原生：已有 `guidao-replace`/`guidao-decline` 正反向 |
| `huangtian` 黄天 | `shenhua.js:8652` `huangtian2.ai.result` | 张角主公技的响应 AI：其他群势力角色在出牌阶段决定是否把闪/闪电交给张角；交闪/闪电、本次实际选牌、防御牌保留 | **已实现质量提升**（原生补丁 `bd192a8`/`2971478`/`7dabb0b`）：交牌者1血选中闪且无备用闪时不转交；选中闪电可转交并保留唯一闪；3血双闪仍转交 |
| `xinfu_guhuo` 蛊惑 | `shenhua.js:8720` `chooseButton.check`；`8777` `backup.ai1` | 真假声明、可弃牌、被质疑风险、真牌选择 | **评分阶段改善**（原生补丁 `ce66ca0`/`751b29a`）：1血无可弃低价值牌时声明分0；有闪电等可弃牌时保留合理诈称；3血同局面保留原生声明分4.70。完整1血仅闪场景原生最终也未发动，因此不宣称已阻止真实错误出牌 |
| `xinshensu` 神速 | `shenhua.js:7446`/`7478` 两个子技能的 `cost` | 跳过阶段、弃装备、虚拟杀目标、放弃摸牌的机会成本 | **已实现质量提升**（原生补丁 `0749a7e`/`e0f7148`/`27e46d3`）：低手牌+乐/兵粮/闪电且收益高于摸牌价值时仍用神速1；收益不足时放弃并正常判定 |
| `retianxiang` 天香 | `shenhua.js:7726` cost 的 `ai2` | 伤害转移目标、体力/手牌、队友与敌人 | 完成审查，保留原生：原生已按伤害效果与态度分敌我 |
| `hongyan` 红颜 | `shenhua.js:8022` `mod.suit` | 黑桃视红桃、判定/花色联动 | 仅规则验证：无独立 AI 选择 |
| `xinkuanggu` 狂骨 | `shenhua.js:3756` cost | 回复/摸牌、1血风险 | **已实现质量提升**（见上） |
| `qimou` 奇谋 | `shenhua.js:3697` `ai.result.player` | 支付档位、远处目标、击杀收益 | 既有修复（`shouldBypassQimouCountBlock`），本表保留 |
| `jushou` 据守 | `shenhua.js:7543` `check` | `hp+hand<4` 阈值、翻面机会成本 | **已实现质量提升**（原生补丁 `da232e1`）：已翻面时摸3张并翻回正面，无额外回合成本；正常4血3手牌反向不发动 |
| `gzbuqu` 不屈 | `shenhua.js:8131` recover 子技能 | “创”移除、回复、濒死 | 完成审查，保留原生：现有伤害/负向/回复选择局面 |
| `xinliegong` 烈弓 | `shenhua.js:3796` targetprompt；`3852` `skillTagFilter` | 不可响应、加伤、出杀目标 | 完成审查，保留原生：`directHit_ai` 与 `aiOrder` 已覆盖宿主目标评分；现有命中/负向局面 |

## 未采用但已记录的候选

1. **雷击连环惩罚**：原生 `get.effect` 已把连环传导计入目标评分，`quality-releiji-linked-ally` 未复现“雷击队友”的退化，未加覆盖。

## 证据

### 随正式风包交付

- `wind-native/wind-native.patch` 与 `wind-native/0001`～`0005`：本轮风包逐武将原生 AI 补丁，适用于宿主 1.11.7 `character/shenhua.js`；基线/最终 SHA256 与逐武将说明见 `WIND-NATIVE-AI.md`。
- `wind-native-baseline.json` / `wind-native-patched.json` / `wind-native-compare.json`：未修改宿主与原生补丁宿主的同场景对照，`semantic_all=true`。
- `wind-native-baseline-patched.json`：原生基线 vs 原生补丁，20 场景 `semantic_all=true`，4 条已登记策略差异。
- `wind-native-patched-extension-compare.json`：原生补丁 vs 完整扩展，20 场景 `semantic_all=true`；受影响技能逐场景一致，仅保留既有的 `shenhua-guhuo-fake-questioned` 技能选择差异。
- `wind-extension.json`：完整扩展 20 场景；1血/3血蛊惑完整出牌、神速1反向机会成本、黄天强制选闪与自然选闪电均有实际结算记录。
- `WIND-NATIVE-AI.md`：逐武将说明、基线/最终 SHA256、黄天归属与触发条件、蛊惑评分/行为边界。

### 仓库与交付目录（不放进 ZIP）

- `wind-acceptance.json` / `accept-shenhua_feng.json`：风包 ZIP 42 场景/40 条技能检查，安装/宿主/原生对照/回滚/重装/134维全部通过。
- `wind-lifecycle.json`：新增据守/神速1/蛊惑/黄天钩子的安装→卸载→重装标记检查。
- 早期审查过程证据保留在仓库 `docs/skill-ai-quality-20261103/`；其中部分生成于最终补修前，不作为最终行为判据。
- 旧版 `native-ai-quality.patch` 已移除，不再随包交付；正式风包原生补丁只用 `wind-native/`。
