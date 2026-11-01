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

/* 失牌收益目标（如屯田）沿用宿主特殊评分，不再叠加手牌数量奖励。 */
export function retuxiHandBonus(handCount, isEnemy, hasLossBenefit) {
	if (!isEnemy || hasLossBenefit) return 0;
	const count = Math.max(0, Number(handCount) || 0);
	return Math.min(2, count * 0.25);
}
