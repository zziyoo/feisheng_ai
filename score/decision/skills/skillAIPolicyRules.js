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
 * OL界魏延【奇谋 reqimou】的宿主缺陷（2026-10-31 真实宿主复现）：
 * 1. gate 只要“存在 4 距离内可打的目标”就放行，目标贴脸且一发杀可收割时也会支付；
 * 2. processAI 固定支付 hp-1（有桃/酒时甚至支付全部体力），与“距离/击杀实际需要”无关。
 * 本层约束（2026-10-31 批二 + 2026-11-01 审查补修）：
 * - 攻击范围使用宿主真实 API `getAttackRange()`（含武器/技能修正），距离用 `get.distance`；
 * - 不可承受的候选绝不截断成“付得起但达不到目标”的档位；
 * - 返回 null 表示没有可行候选：调用方保留原生档位；若同时存在“手杀可击杀”的目标，
 *   说明任何可承受支付都无法兑现击杀，gate 会阻止这次无收益发动。
 * - 支付收益模型与自救上限见 reqimouOptimalX 注释（2026-11-01 补修 P1/P1-2）。
 */
/*
 * 出杀次数档位的统一解释（2026-11-01 审查补修 P2）：
 * - Infinity（诸葛连弩/无限杀技能）：次数不构成约束，绝不能回退成 1，
 *   否则 AI 会把“次数已无限”误判为“还需支付换次数”而无意义支付体力；
 * - 0 或负数（本回合已用完）：真实剩余次数，支付 x 后为 x 次；
 * - NaN/非法/未知：按原生“至少 1 次”的静态口径保守回退。
 */
export function interpretBaseUses(value) {
	const num = Number(value);
	if (num === Infinity) return Infinity;
	if (Number.isFinite(num)) return Math.max(0, Math.floor(num));
	return 1;
}

/* 支付 x 后的出杀次数（reqimou2 的 cardUsable mod 在基础上加 x）。 */
function reqimouUsesAfter(baseUses, x) {
	const uses = interpretBaseUses(baseUses);
	return uses === Infinity ? Infinity : uses + Math.max(0, x);
}

export function reqimouNeedsPayment(targets) {
	for (const target of Array.isArray(targets) ? targets : []) {
		if (!target || typeof target !== 'object') continue;
		if (!(Number(target.effect) > 0)) continue;
		if (!target.canUseIgnoringDistance) continue;
		const baseUses = interpretBaseUses(target.baseUses);
		if (!target.currentlyInRange) return true;
		if (Number(target.hp) > baseUses) return true;
	}
	return false;
}

/*
 * 支付 x 档位下的“确定击杀收益”（纯静态口径，不读隐藏手牌、不做概率模拟）：
 * 目标计入条件 = 正收益 ∩ 无视距离合法 ∩ 手杀可击杀 ∩ 支付后距离可达 ∩ 支付后次数足够；
 * 预算 = min(手杀数, 支付后出杀次数)（Infinity 次数时预算=手杀数），
 * 按血量升序贪心统计预算内最多能击杀几个目标。
 */
export function reqimouKillBenefit(shaCount, baseUses, x, targets) {
	const sha = Math.max(0, Math.floor(Number(shaCount) || 0));
	if (!sha) return 0;
	const uses = reqimouUsesAfter(baseUses, x);
	if (uses !== Infinity && uses < 1) return 0;
	const budget = uses === Infinity ? sha : Math.min(sha, uses);
	const costs = [];
	for (const target of Array.isArray(targets) ? targets : []) {
		if (!target || typeof target !== 'object') continue;
		if (!(Number(target.effect) > 0)) continue;
		if (!target.canUseIgnoringDistance) continue;
		const targetHp = Math.max(0, Math.floor(Number(target.hp) || 0));
		if (!targetHp || targetHp > sha) continue;
		const distance = Math.max(0, Number(target.distance) || 0);
		const range = Number.isFinite(Number(target.attackRange)) ? Math.max(0, Number(target.attackRange)) : 1;
		if (distance > range + Math.max(0, x)) continue;
		if (uses !== Infinity && uses < targetHp) continue;
		costs.push(targetHp);
	}
	if (!costs.length) return 0;
	costs.sort((a, b) => a - b);
	let remaining = budget;
	let kills = 0;
	for (const cost of costs) {
		if (cost > remaining) break;
		remaining -= cost;
		kills++;
	}
	return kills;
}

/*
 * 支付档位与回合收益绑定（2026-11-01 审查补修 P1/P1-2）：
 * 1. 上限：无自救牌时 hp-1（必剩 1 点）；手中有 canSaveCard 自救牌（桃/酒，只看自己手牌）
 *    时允许支付全部体力——0 血进入濒死后自救到 1，复刻原生 processAI 的合法路线。
 *    自救牌不构成“无条件付满”的理由：只有当更小档位兑现不了同样的击杀收益时才会用满。
 * 2. 档位：不再取“所有目标的最小需求”，而是“能兑现最大确定击杀收益的最小档位”。
 *    收益按全回合目标集合与手杀/次数预算评估，不绑定单一最容易攻击的目标；
 *    收益不变时绝不加价（min-x 平局），也绝不宣称预算覆盖不到的爆发收益。
 * 3. 机会成本：最大可承受收益必须严格高于“不发动”的免费收益（射程内、现有次数即可击杀），
 *    否则返回 null——不为免费可得的击杀支付体力（含连弩无限次数下“为加次数”的白付）。
 * 4. 返回 null：任何可承受档位都兑现不了净收益 → 调用方保留原生档位；
 *    若同时存在“手杀可击杀”的目标，gate 会阻止这次无收益发动。
 */
export function reqimouOptimalX(input) {
	const { hp, shaCount, baseUses, targets, saveCount } = input || {};
	const sha = Math.max(0, Math.floor(Number(shaCount) || 0));
	const life = Number(hp);
	/* hp-1 至少要剩 1 点体力；1 血及以下一律回退原生（gate 本身也会拦截 hp<3）。 */
	if (!Number.isFinite(life) || life < 2) return null;
	if (!sha) return null;
	const selfRescue = Math.max(0, Math.floor(Number(saveCount) || 0));
	const maxPayment = selfRescue > 0 ? life : Math.max(1, life - 1);
	const baselineBenefit = reqimouKillBenefit(shaCount, baseUses, 0, targets);
	const maxBenefit = reqimouKillBenefit(shaCount, baseUses, maxPayment, targets);
	if (!maxBenefit || maxBenefit <= baselineBenefit) return null;
	for (let x = 1; x <= maxPayment; x++) {
		if (reqimouKillBenefit(shaCount, baseUses, x, targets) >= maxBenefit) return x;
	}
	return null;
}

/* 是否存在“当前手杀数足以击杀”的目标（静态口径）。
 * 用于 gate 区分两类空结果：手杀可击杀但支付不可承受 → 阻止无收益发动；
 * 手杀不足以击杀 → 保留原生爆发/摸牌路线。 */
export function reqimouKillableByHand(shaCount, targets) {
	const sha = Math.max(0, Math.floor(Number(shaCount) || 0));
	if (!sha) return false;
	for (const target of Array.isArray(targets) ? targets : []) {
		if (!target || typeof target !== 'object') continue;
		if (!(Number(target.effect) > 0)) continue;
		if (!target.canUseIgnoringDistance) continue;
		const hp = Number(target.hp);
		if (Number.isFinite(hp) && hp <= sha) return true;
	}
	return false;
}
