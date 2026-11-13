# 狂骨 P1 修复交接

状态：开发候选，核心真实宿主场景尚需独立验证；不能根据现有输入断言必然回复。

- 分支 `codex/shenhua-feng-kuanggu-fix`，基线 `fbe42c5983e26c0ae7d040d202978dcf9142baa7`（父提交 `a863553cdfae1b997a2fb4e2899ea84323903bcd`）；代码提交 `ede9966`。最终 HEAD 和工作区状态以 `git log -1`、`git status --short --branch` 为准。
- 原 ZIP `C:/Users/32360/Desktop/feisheng-ai-six-packs-final/packs/feisheng-ai-shenhua-feng.zip` SHA256 `7a45c323876f8b1af9408c9c4bb86388e839c13c51ef31e28aded0a2076e8ac9`，未修改。

## 根因与证据差异

扩展 `kuangguChoice` 在受伤且回复收益为正时，仅对低体力或剩余可用杀次数大于零且有足够可攻击杀的情况回复，未评估回复收益是否超过摸牌收益。封版场景选择摸牌；真实场景记录没有记录两项效果值。`shaReady` 是 `countCards('hs', card.name === 'sha' && player.hasValueTarget(card))`，受宿主合法目标判断影响；`shaUsable` 是 `getCardUsable('sha')` 给出的剩余次数，回合内会减已用数量。`get.recoverEffect(player)` 是宿主 `get.effect` 的回复效果，默认目标、施用者、观察者均为本人，满血返回 0；它并不包含摸牌收益。

交接日志的“原生候选”规则与正式双风交付补丁不同：正式文件 `C:/Users/32360/Desktop/dual-feng-final-delivery-7d79d8c/dual-feng-native-candidate.patch` 在受伤且回复收益为正时，以低体力、`shaUsable > 0 && shaReady >= shaUsable` 或 `recoverEffect > drawEffect` 选择回复。相同的 7/6 示例输入未给 `drawEffect`，因此不能由该输入独立确定正式原生结果；简单移除 `usable > 0` 会让 0/0 也回复，不能证明收益合理。基线 `7d79d8c` 的扩展源码也有旧条件，与本轮基线相同。另见仓库历史的 `wind-native.patch`，它是不同的候选，不能代替正式双风补丁。

## 修改与检查

`score/decision/skills/packs/shenhuaFeng.js` 按正式原生公式读取本人 `get.recoverEffect` 和摸牌 `get.effect`；`rules/shenhuaFeng.js` 当回复效果严格大于有限摸牌效果时选择回复，其他分支不变。效果无法获取时保持原规则。界风未调用此规则，未修改界风、共享协调器、技能结算或注册表。正式原生允许特殊非有限评分的 JavaScript 比较，扩展对非法摸牌数值保守回退；此为边界差异。

核心输入在摸牌效果 0.5 时由 `draw_card` 改为 `recover_hp`；摸牌效果等于 1 或高于 1 时仍为 `draw_card`。此结果与正式原生公式一致。未捕获真实场景的摸牌效果，不能宣称原始场景已复现修复。

本轮两文件语法检查通过；12 项规则断言覆盖上述三种收益比较、满血、零和负回复、杀可用与不可用、低体力、连续攻击资源、非法摸牌值、空输入。未运行真实宿主、六包或安装矩阵。研究信息为历史证据，不是本次验证。

## 独立验收

1. 重跑原封版单风真实场景，记录 `get.recoverEffect(player,player,player)`、`get.effect(player,{name:'draw'},player,player)`、`shaReady`、`shaUsable`，并对比未修复宿主、正式原生补丁、旧扩展、新扩展的真实选择及结算；若回复效果不高于摸牌效果且无其他分支，正式原生也应摸牌，应重新审视原断言。
2. 用真实事件分别构造回复效果高于、等于、低于摸牌效果，覆盖 7/6 核心场景、低体力、满血、负收益、有无剩余杀和连弩连续攻击；确认人工选择与结算未改变。
3. 覆盖效果回调抛错或返回异常值、取消事件、双风同时安装及卸载，确认界风不受影响。
4. 通过独立验收后另行构建新产物并校验，不覆盖封版文件。
