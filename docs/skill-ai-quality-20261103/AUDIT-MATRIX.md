# 神话再临·风/火 原生 AI 质量审查矩阵（2026-11-03）

宿主：无名杀 1.11.7；扩展：4.4.4；审查对象：风 12 项、火 14 项登记技能。
本表区分“实际运行时优化”“完成审查保留原生”“仅规则验证”，不以场景能执行代替质量结论。

## 本轮新增运行时优化

| 技能 | 原生入口（宿主源码） | 问题与证据 | 运行时改动 | 正/反向证据 |
|---|---|---|---|---|
| 界魏延·狂骨 `xinkuanggu` | `character/shenhua.js:3756` `cost`：只在“手里有足够杀”时回复 | 1血、空手、刚对距离1角色造成伤害时，原生仍选摸牌；固定局面 `quality-kuanggu-lowhp` 原生 `hp=1, draw=1` | `packs/shenhuaFeng.js` 重写 `cost` 的 AI 选择：1血且可回复时选 `recover_hp`，其余沿用原生条件；规则不变 | 正向 `quality-kuanggu-lowhp`：扩展 `recover=1, hp=2`；反向 `quality-kuanggu-midhp`：扩展仍摸牌、体力不变 |
| 袁绍·乱击 `luanji` | `character/shenhua.js:7179` `check`：目标效果压成 `sgn` 求和 | 1血、空手、无防具队友会被万箭直接打进濒死；原始执行复现 `probe-native-3.json` 中原生 `used=true, allyHp=0`。最终对照场景 `quality-luanji-ally-lethal` 为避免濒死夹具卡死，只比较 `check` 决策分：原生 6，扩展 0 | `packs/shenhuaHuo.js` 包装 `check`：原生正分时，若存在此类队友则返回 0；全敌方场景不拦截 | 正向 `quality-luanji-ally-lethal`：扩展 `check=0`、队友保持1血；反向 `shenhua-huo-luanji-wanjian-use`：全敌方场景扩展仍实际发动万箭 |
| 曹仁·据守 `jushou` | `character/shenhua.js:7543` `check` | 已翻面时发动据守会摸3张并翻回正面；原生 `hp+手牌<4` 会漏掉这一免费收益 | 原生补丁 `da232e1` + `packs/shenhuaFeng.js` 镜像：`isTurnedOver() || hp+手牌<4` | 正向 `quality-jushou-turned`：原生 `drew=0, turned=true`，补丁 `drew=3, turned=false`；反向 `quality-jushou-normal` 两者都不发动 |
| 夏侯渊·神速1 `shensu1` | `character/shenhua.js:7452` `chooseTarget.ai` | 低手牌时原生直接放弃，即使判定区有乐/兵粮/闪电会被跳过 | 原生补丁 `0749a7e`/`e0f7148` + 扩展镜像：低手牌 + 不良判定 + 正收益杀目标时仍放行 | 正向 `quality-shensu1-lowhand-lebu`：原生 `usedSha=false, judge=0`，补丁 `usedSha=true, judge=1`；反向无判定低手牌 `shenhua-shensu-negative` 仍放弃 |
| 于吉·蛊惑 `xinfu_guhuo` | `character/shenhua.js:8720` `chooseButton.check` | 1血、无真牌仍给诈称正分；被质疑失去1点体力会进入濒死 | 原生补丁 `ce66ca0` + 扩展镜像：无真牌 + 1血 + 非濒死时返回0 | 正向 `quality-guhuo-bluff-lowhp`：原生分4.70，补丁0；反向 `quality-guhuo-bluff-midhp` 3血仍4.70 |
| 张角·黄天 `huangtian2` | `character/shenhua.js:8652` `ai.result.target` | 固定返回5；1血把最后一张闪转交主公，自己失去唯一防御 | 原生补丁 `bd192a8`/`2971478` + 扩展镜像：1血且无闪电、只剩最后一张闪时返回0 | 正向 `quality-huangtian-last-shan`：原生交出闪，补丁保留；反向 `quality-huangtian-midhp` 3血双闪仍转交 |

`qimou` 为 2026-10-31 已落地的既有修复；本轮将其与 `xinkuanggu` 一并纳入原生补丁 `9df7034`，不计入“本轮新增运行时优化”数量。

## 风包 12 项逐项结论

| 技能 | 原生 AI 入口 | 已检查的决策边界 | 结论 |
|---|---|---|---|
| `releiji` 雷击 | `shenhua.js:7321` cost 的 `chooseTarget.ai`；`7358` 的 `target_use.effect` | 目标敌我/伤害；`quality-releiji-linked-ally` 额外检查铁索传导 | 完成审查，保留原生：`get.damageEffect`/`get.effect` 已把连环目标按态度计入，真实局面选择未横置目标 |
| `guidao` 鬼道 | `shenhua.js:8472` cost 的选牌 `ai` | 判定差值、黑牌价值、装备折价、是否改判 | 完成审查，保留原生：已有 `guidao-replace`/`guidao-decline` 正反向 |
| `huangtian` 黄天 | `shenhua.js:8652` `huangtian2.ai.result` | 交闪/闪电、目标主公、防御牌保留 | **已实现质量提升**（原生补丁 `bd192a8`/`2971478`）：1血无闪电且只剩最后一张闪时不转交；3血双闪仍转交 |
| `xinfu_guhuo` 蛊惑 | `shenhua.js:8720` `chooseButton.check`；`8777` `backup.ai1` | 真假声明、被质疑风险、真牌选择 | **已实现质量提升**（原生补丁 `ce66ca0`）：1血无真牌不诈称；3血同局面保留原生声明分4.70 |
| `xinshensu` 神速 | `shenhua.js:7446`/`7478` 两个子技能的 `cost` | 跳过阶段、弃装备、虚拟杀目标 | **已实现质量提升**（原生补丁 `0749a7e`/`e0f7148`）：低手牌+乐/兵粮/闪电时仍用神速1；无判定低手牌仍放弃 |
| `retianxiang` 天香 | `shenhua.js:7726` cost 的 `ai2` | 伤害转移目标、体力/手牌、队友与敌人 | 完成审查，保留原生：原生已按伤害效果与态度分敌我 |
| `hongyan` 红颜 | `shenhua.js:8022` `mod.suit` | 黑桃视红桃、判定/花色联动 | 仅规则验证：无独立 AI 选择 |
| `xinkuanggu` 狂骨 | `shenhua.js:3756` cost | 回复/摸牌、1血风险 | **已实现质量提升**（见上） |
| `qimou` 奇谋 | `shenhua.js:3697` `ai.result.player` | 支付档位、远处目标、击杀收益 | 既有修复（`shouldBypassQimouCountBlock`），本表保留 |
| `jushou` 据守 | `shenhua.js:7543` `check` | `hp+hand<4` 阈值、翻面机会成本 | **已实现质量提升**（原生补丁 `da232e1`）：已翻面时摸3张并翻回正面，无额外回合成本；正常4血3手牌反向不发动 |
| `gzbuqu` 不屈 | `shenhua.js:8131` recover 子技能 | “创”移除、回复、濒死 | 完成审查，保留原生：现有伤害/负向/回复选择局面 |
| `xinliegong` 烈弓 | `shenhua.js:3796` targetprompt；`3852` `skillTagFilter` | 不可响应、加伤、出杀目标 | 完成审查，保留原生：`directHit_ai` 与 `aiOrder` 已覆盖宿主目标评分；现有命中/负向局面 |

## 火包 14 项逐项结论

| 技能 | 原生 AI 入口 | 已检查的决策边界 | 结论 |
|---|---|---|---|
| `qiangxix` 强袭 | `shenhua.js:6748` `ai.result` | 武器/体力支付、连弩、低血、目标 | 完成审查，保留原生：`quality-qiangxix-crossbow` 复现原生弃连弩；但 `check`/`ai1` 钩子会把丈八也改成保留，属于过度优化，无稳定入口 |
| `quhu` 驱虎 | `shenhua.js:6587` `ai.result` | 拼点目标、胜率代理、伤害目标 | 完成审查，保留原生：现有 compare/no-target/risky-decline 局面 |
| `jieming` 节命 | `shenhua.js:6648` cost 的 `chooseTarget.ai` | 自己/队友补牌、`maxHp` 上限、手牌差 | 完成审查，保留原生：自身态度为 10，原生按最大缺牌选择，未复现忽略自己 |
| `lianhuan` 连环 | `shenhua.js:412` `ai2` | 横置/解除/重铸、敌我、属性传导 | 完成审查，保留原生：`get.effect` 已按态度计入连环；上一轮已删除过度拦截覆盖 |
| `oldniepan` 涅槃 | `shenhua.js:6522` `ai.result` | 濒死自救、桃优先、限定技消耗 | 完成审查，保留原生：现有 `oldniepan-tao` 真实局面原生优先用桃 |
| `tianyi` 天义 | `shenhua.js:6934` `ai` | 拼点目标、手牌点数、出杀收益 | 完成审查，保留原生：现有 compare/win/lose 局面；拼点含隐藏信息，未做无依据改写 |
| `shuangxiong` 双雄 | `shenhua.js:7017` `shuangxiong_judge.check` | 改判定阈值、判定颜色、决斗转化 | 完成审查，保留原生：`quality-shuangxiong-3cards` 原生摸两张；强制改判可多一次决斗，但可被响应、非严格占优 |
| `luanji` 乱击 | `shenhua.js:7179` `check` | 多目标收益、材料价值、队友致死 | **已实现质量提升**（见上） |
| `xueyi` 血裔 | `shenhua.js:7227` `mod.maxHandcard` | 主公技、弃牌上限 | 仅规则验证：无独立 AI 选择 |
| `bazhen` 八阵 | `shenhua.js:6356` `bazhen_bagua.ai` | 八卦判定、护甲槽、装备价值 | 仅规则验证：被动防御，无独立主动选择 |
| `huoji` 火计 | `shenhua.js:6317` `check` | 红牌转换、手牌数、火攻收益 | 完成审查，保留原生：宿主 `huogong.ai.result.player` 在手牌≤体力时给出 -10 强保护；现有红/无红局面 |
| `kanpo` 看破 | `shenhua.js:6392` `mod.aiValue`；`6430` `check` | 黑牌价值、无懈保留、响应 | 完成审查，保留原生：原生已按无懈/黑牌顺序压价 |
| `mashu` 马术 | `standard.js:1642` `mod.globalFrom` | 距离 | 仅规则验证：被动距离 |
| `jianchu` 鞬出 | `shenhua.js:3311` `discardPlayerCard.ai` | 弃装备/手牌、不可响应、牌张交换 | 完成审查，保留原生：现有有装备/无装备局面；无装备分支的换牌是技能真实代价，未发现非法或隐藏信息读取 |

## 未采用但已记录的候选

1. **强袭 `check`/`ai1` 接管**：能让连弩场景改付体力并保留连弩，但同样会让低价值丈八改付体力；固定局面 `quality-qiangxix-zhangba` 已复现过度优化，未交付。
2. **双雄 3 张手牌改判定**：强制改判可多一次决斗，但决斗可被响应，且要放弃两张摸牌；`quality-shuangxiong-3cards` 原生摸牌并未被证明严格劣于改判，未交付。
3. **雷击连环惩罚**：原生 `get.effect` 已把连环传导计入目标评分，`quality-releiji-linked-ally` 未复现“雷击队友”的退化，未加覆盖。

## 证据

- `quality-native.json` / `quality-policy.json` / `quality-extension.json`：种子 20261030 三组固定局面。
- `quality-compare.json`：原生 vs 完整扩展；`semantic_all=true`，两条已登记策略差异（乱击队友致死否决、狂骨1血回复）单列。
- `quality-native-20261101.json` / `quality-extension-20261101.json` / `quality-compare-20261101.json`：第二个固定种子的配对，`semantic_all=true`。
- `quality-native-20261102-stalled.log`：第三个种子（20261102）在宿主固定局面启动/结算阶段停住；保留原始日志，未把它计为策略差异或通过。
- `probe-native-3.json`：乱击/狂骨/蛊惑的原始候选复现（含旧版乱击真实执行 `allyHp=0`）。
- `probe-native-4.json`：雷击连环、双雄3牌、卡牌价值。
- `probe-policy-final.json`：最终策略层在正向/反向局面上的选择。
- `native-ai-quality.patch`：上一版仅含狂骨、乱击两处原生 AI 修改的对照补丁。
- `wind-native/wind-native.patch` 与 `0001`～`0005`：本轮风包逐武将原生 AI 补丁，适用于宿主 1.11.7 `character/shenhua.js`；基线/最终 SHA256 与逐武将说明见 `WIND-NATIVE-AI.md`。
- `wind-native-baseline.json` / `wind-native-patched.json` / `wind-native-compare.json`：未修改宿主与原生补丁宿主的同场景对照，`semantic_all=true`。
- `regression-wind.json` / `regression-fire.json` / `regression-fire-positive.json`：风 26 场景、火 41 场景及正向独立进程回归。
