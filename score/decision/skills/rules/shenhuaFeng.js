/* 神话再临·风 纯决策函数层：所有函数只做纯计算，不触宿主对象。
 * 与原生补丁 docs/skill-ai-quality-20261103/wind-native/ 中的同名决策保持一致。
 * 本轮（2026-11 风包质量深化轮）新增/修订的函数均标注与原生入口的对应关系。 */

/* 界魏延【奇谋 qimou】：复刻宿主 content 的支付档位，只用于 AI 复算，不改技能规则。 */
export function qimouTargetX(hp, shaCount) {
	const life = Number(hp);
	const sha = Math.floor(Number(shaCount));
	if (!Number.isFinite(life) || !Number.isFinite(sha)) return 0;
	if (life >= 4 && sha >= 3) return 3;
	if (life >= 3 && sha >= 2) return 2;
	return 1;
}

/*
 * qimou 原生 gate 的缺陷（2026-10-31 真实宿主复现）：
 * `if (lib.filter.cardUsable(card, player)) return 0` 在“杀次数未用完”时直接否决奇谋，
 * 即使目标在攻击范围外——而减距离恰恰是奇谋存在的目的。
 * 只在“杀次数可用”恰好是唯一阻塞条件、且支付能把可击杀的远处目标纳入射程时放宽。
 */
export function shouldBypassQimouCountBlock(input) {
	const { nativeResult, hp, shaCount, cardEnabled, cardUsable, targets } = input || {};
	if (Number(nativeResult) > 0) return false;
	if (!cardEnabled || !cardUsable) return false;
	const sha = Math.max(0, Math.floor(Number(shaCount) || 0));
	const life = Number(hp);
	if (!Number.isFinite(life) || life <= 1 || sha <= 0) return false;
	const x = qimouTargetX(life, sha);
	if (life <= x) return false;
	const killPotential = Math.min(sha, x + 1);
	for (const target of Array.isArray(targets) ? targets : []) {
		if (!target || typeof target !== 'object') continue;
		if (target.currentlyInRange) continue;
		if (!target.canUseIgnoringDistance) continue;
		if (!(Number(target.effect) > 0)) continue;
		const attackDistance = Number(target.attackDistance);
		if (!Number.isFinite(attackDistance) || attackDistance > x + 1) continue;
		const targetHp = Number(target.hp);
		if (!Number.isFinite(targetHp)) continue;
		if (targetHp > x) continue;
		if (targetHp > killPotential) continue;
		return true;
	}
	return false;
}

/* 界魏延【狂骨】：本轮扩展为三分支（对应原生 cost 的嵌套条件）。
 * hp<=1 回复（与宿主 chooseDrawRecover 对 hp==1 的处理一致）；
 * 杀充足时回复；其余摸牌。 */
export function kuangguChoice(input) {
	const { hp, isDamaged, recoverEffect, drawEffect, shaReady, shaUsable } = input || {};
	if (!isDamaged || !(Number(recoverEffect) > 0)) return 'draw_card';
	const life = Number(hp);
	if (Number.isFinite(life) && life <= 1) return 'recover_hp';
	const ready = Number(shaReady);
	const usable = Number(shaUsable);
	if (Number.isFinite(usable) && usable > 0 && Number.isFinite(ready) && ready >= usable) return 'recover_hp';
	if (typeof drawEffect === 'number' && Number.isFinite(drawEffect) && Number(recoverEffect) > drawEffect) return 'recover_hp';
	return 'draw_card';
}

/* 曹仁【据守】：已翻面发动；其余情况沿用原生手牌阈值。 */
export function jushouShouldActivate(input) {
	const { hp, hand, turned } = input || {};
	if (turned) return true;
	const life = Number(hp);
	const cards = Number(hand);
	if (!Number.isFinite(life) || !Number.isFinite(cards)) return false;
	if (life + cards >= 4) return false;
	return true;
}

/* 神速1：手牌<=2时原生放弃；若判定区有乐/兵粮/闪电，跳过判定本身有收益。
 * 但跳过摸牌有代价：只有虚拟杀收益不低于一次摸牌价值时才放宽。 */
export function shensu1ShouldUse(input) {
	const { check, harmfulJudge, effect, drawEffect } = input || {};
	if (!(Number(effect) > 0)) return false;
	if (check) return true;
	if (!harmfulJudge) return false;
	return Number(effect) >= Number(drawEffect);
}

/* 蛊惑扣置材料（本轮新增，对应原生 backup.ai1 的确定性门槛）：
 * 真牌恒优先；诈称材料只在低价值（与原生声明门槛 raw<6 一致）且非濒死时支付。 */
export function guhuoMaterialScore(input) {
	const { isTrueCard, materialValue, isDying, hp, cardName } = input || {};
	const value = Number(materialValue);
	if (isTrueCard) return 5;
	if (isDying) return 0;
	if (Number(hp) <= 1 && (cardName === 'shan' || cardName === 'tao')) return 0;
	if (Number.isFinite(value) && value < 6) return Math.min(4.5, 4 - value / 2);
	return 0;
}

/* 黄天（本轮修订，对应原生 result.target 的完整逻辑）：
 * 返回 null 表示交还原生评分；否则给出替代分。
 * 低体力（<=2）交牌者选中最后一张闪时保守保留。 */
export function huangtianTargetScore(input) {
	const { hp, handShan, selectedShan, selectedShandian, hasSelection } = input || {};
	const life = Number(hp);
	const shan = Number(handShan);
	if (!Number.isFinite(life) || !Number.isFinite(shan)) return null;
	if (life > 2 || shan > 1) return null;
	if (!hasSelection) return null;
	if (selectedShan) {
		return 0;
	}
	if (selectedShandian) return null;
	return 0;
}
