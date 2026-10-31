/*
 * 纯规则层：不依赖 noname 宿主，便于 Node 直接回归。
 * 所有输入都是公开信息或当前玩家自己的手牌名称。
 */

export const DEFENSE_RULES = {
	/* 标准制衡在完整 phaseUse 中会先用桃回血、或只弃非防御牌；
	 * 2026-10-30 全回合复核未复现“弃闪/桃”缺陷，故不注册标准制衡。 */
	rezhiheng: { maxHpForTao: 3, maxHpForShan: 3 },
};

export function retentionAdjustment(name, hp, position, base, rule) {
	if (!rule || !Number.isFinite(Number(base)) || hp == null || hp > rule.maxHpForTao) return base;
	if (position !== 'h') return base;
	if (name === 'tao' && hp <= rule.maxHpForTao) return Math.min(Number(base), -1);
	if (name === 'shan' && hp <= rule.maxHpForShan) return Math.min(Number(base), -1);
	return base;
}

export function shouldSkipExchange(hp, handNames, rule) {
	if (!rule || hp == null || hp > rule.maxHpForTao) return false;
	if (!Array.isArray(handNames) || !handNames.length) return false;
	let protectedCount = 0;
	for (const name of handNames) {
		if (name === 'tao' || (name === 'shan' && hp <= rule.maxHpForShan)) protectedCount++;
	}
	return protectedCount > 0 && protectedCount === handNames.length;
}

export function fairButtonScore(playerId, index) {
	const source = String(playerId == null ? '' : playerId) + '|' + Math.max(0, Number(index) || 0);
	let hash = 2166136261;
	for (let i = 0; i < source.length; i++) {
		hash ^= source.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return ((hash >>> 0) % 1000) / 1000;
}

/* 旧版箜声成本 AI 的兼容性指纹。宿主改写这段表达式后不再套 shim。 */
export function olkongshengCostNeedsFix(source) {
	const text = String(source || '');
	return /getExpansions\s*\(\s*["']olkongsheng["']\s*\)\s*\+/.test(text) && text.includes('ui.selected.cards.length');
}

/* 只在一次 olkongsheng cost 调用中使用的数组视图：
 * 保留索引/长度/迭代/JSON 序列化，只让算术转换得到数量。 */
export function olkongshengExpansionView(cards) {
	if (!Array.isArray(cards)) return cards;
	const view = cards.slice();
	view.valueOf = function () { return view.length; };
	view.toString = function () { return String(view.length); };
	return view;
}

export function shouldMaskHiddenButtonChoice(isHuman, auto, skillIds) {
	if (isHuman && !auto) return false;
	return Array.isArray(skillIds) && skillIds.includes('redimeng');
}

/* 失牌收益目标（如屯田）沿用宿主特殊评分，不再叠加手牌数量奖励。 */
export function retuxiHandBonus(handCount, isEnemy, hasLossBenefit) {
	if (!isEnemy || hasLossBenefit) return 0;
	const count = Math.max(0, Number(handCount) || 0);
	return Math.min(2, count * 0.25);
}
