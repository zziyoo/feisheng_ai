# 原生 AI 修改对照补丁（无名杀 1.11.7）

补丁文件：`native-ai-quality.patch`。它只修改 AI 选择，不修改技能规则、目标合法性、伤害结算或卡牌定义。

## 适用范围

- 基线：无名杀 1.11.7 的 `character/shenhua.js`（标签对象 `22cf379` / 实际提交 `1fe5292` 对应的发布源码）。
- 仅用于宿主维护者人工审查；不要与无名AI扩展的策略覆盖同时安装，否则会重复接管同一 AI 入口。
- 其他宿主版本可能因上下文变化无法直接 `git apply`，此时只参考两处改动语义。

## 改动一：界魏延【狂骨】1血优先回复

位置：`character/shenhua.js` 的 `xinkuanggu.cost`（约 3756 行）。

原逻辑：

```js
if (player.isDamaged() && get.recoverEffect(player) > 0 && player.countCards("hs", card => ...) >= player.getCardUsable("sha")) {
  choice = "recover_hp";
} else {
  choice = "draw_card";
}
```

问题：1血且可回复、但手里没有足够杀时，原生仍选摸牌。真实宿主固定局面 `quality-kuanggu-lowhp` 中，界魏延1血空手对距离1角色造成伤害后，原生 `hp=1, draw=1`，没有把可回复的体力换回来。

补丁改为：可回复且（体力≤1 或原生“有足够杀”条件成立）时回复；其余情况仍按原生条件选择。

预期：1血时回复1点体力；3血时仍摸牌（`quality-kuanggu-midhp` 反向场景）。

## 改动二：袁绍【乱击】不为AOE牺牲1血空手无防具队友

位置：`character/shenhua.js` 的 `luanji.check`（约 7179 行）。

原逻辑把每个目标的效果压成 `sgn` 后求和，只按目标数和总值判断；1血空手无防具的队友只贡献一个被压缩的负值，仍可能被万箭直接打进濒死。

补丁在 `targets` 构建后、`num` 求和前加入：

```js
if (targets.some(function(target) {
  return get.attitude(player, target) > 0 && target.hp <= 1 && target.countCards("h") === 0 && !target.getEquip(2);
})) {
  return 0;
}
```

预期：该局面拒绝发动；全敌方、队友体力充足或仍有手牌/防具时保持原逻辑。`shenhua-huo-luanji-wanjian-use` 的全敌方真实执行仍是发动状态。

## 未纳入补丁的候选

- **强袭**：真实宿主复现了原生弃连弩再自损；但给 `check`/`ai1` 加评分会把低价值丈八也改成保留，属于过度优化。需要宿主提供可区分“选哪张武器”的稳定 AI 钩子后再评估，本补丁不包含。
- **双雄**：3张手牌强制改判可多一次决斗，但决斗可被响应且要放弃两张摸牌；固定局面没有证明严格优于原生，本补丁不包含。
- **雷击**：原生 `get.damageEffect`/`get.effect` 已把铁索传导按态度计入，固定局面未复现“雷击队友”退化，本补丁不包含。

## 验证

扩展侧对应实现在：

- `score/decision/skills/packs/shenhuaFeng.js`（`xinkuanggu.cost`）
- `score/decision/skills/packs/shenhuaHuo.js`（`luanji.check`）
- 纯规则：`score/decision/skills/rules/shenhuaFeng.js`、`rules/shenhuaHuo.js`

同一组固定局面已在原生、策略层、完整扩展三组真实宿主中运行；原生/扩展语义对照见 `quality-compare.json`、`quality-compare-20261101.json`。补丁只供人工审查，不替代这些验证。
