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

/* ===== 第二批：生命支付与爆发时机 ===== */

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
 * 只在“杀次数可用”恰好是唯一阻塞条件、且支付能把可击杀的远处目标纳入射程时放宽：
 * - 目标当前不可达（canUse 含距离检查为假）；
 * - 原生其余条件全部成立（canUse 无视距离为真、effect>0、attackDistance<=x+1、目标 hp<=x）；
 * - 支付必须兑换成击杀：目标 hp <= min(手杀数, 1+x)；
 * - 自己不会因支付而死（hp > x）。
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

/*
 * OL界魏延【奇谋 reqimou】的两个缺陷（2026-10-31 真实宿主复现）：
 * 1. gate 只要“存在 4 距离内可打的目标”就放行，目标贴脸且一发杀可收割时也会支付；
 * 2. processAI 固定支付 hp-1（有桃/酒时甚至支付全部体力），与“距离/击杀实际需要”无关。
 * 约束：gate 只在“没有任何目标需要支付”时拦截；支付档位收紧为
 * max(1, 达距所需, 击杀所需)，且只考虑当前手杀数足够击杀的目标，不超过 hp-1。
 * 找不到可击杀目标时返回 null，由调用方保留原生行为。
 */
export function reqimouNeedsPayment(targets) {
	for (const target of Array.isArray(targets) ? targets : []) {
		if (!target || typeof target !== 'object') continue;
		if (!(Number(target.effect) > 0)) continue;
		if (!target.canUseIgnoringDistance) continue;
		const baseUses = Math.max(1, Math.floor(Number(target.baseUses) || 1));
		if (!target.currentlyInRange) return true;
		if (Number(target.hp) > baseUses) return true;
	}
	return false;
}

export function reqimouOptimalX(input) {
	const { hp, shaCount, baseUses, targets } = input || {};
	const sha = Math.max(0, Math.floor(Number(shaCount) || 0));
	const uses = Math.max(1, Math.floor(Number(baseUses) || 1));
	const life = Number(hp);
	if (!Number.isFinite(life) || life < 1) return null;
	let best = null;
	for (const target of Array.isArray(targets) ? targets : []) {
		if (!target || typeof target !== 'object') continue;
		if (!(Number(target.effect) > 0)) continue;
		if (!target.canUseIgnoringDistance) continue;
		const targetHp = Math.max(0, Math.floor(Number(target.hp) || 0));
		if (targetHp > sha) continue; // 手杀不足，永远无法兑换成击杀
		const distance = Math.max(0, Number(target.distance) || 0);
		const range = Math.max(1, Number(target.attackRange) || 1);
		const xReach = Math.max(0, distance - range);
		const xKill = Math.max(0, targetHp - uses);
		const candidate = Math.max(1, xReach, xKill);
		if (best === null || candidate < best) best = candidate;
	}
	if (best === null) return null;
	return Math.max(1, Math.min(best, Math.max(1, life - 1)));
}
