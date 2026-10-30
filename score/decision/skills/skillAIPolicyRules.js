/*
 * 纯规则层：不依赖 noname 宿主，便于 Node 直接回归。
 * 所有输入都是公开信息或当前玩家自己的手牌名称。
 */

export const DEFENSE_RULES = {
	zhiheng: { maxHpForTao: 3, maxHpForShan: 3 },
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
