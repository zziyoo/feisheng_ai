/* OL界魏延【奇谋 reqimou】的纯规则层（2026-10-31 批二 + 2026-11-01 审查补修）。 */

/* 出杀次数档位的统一解释：
 * - Infinity（诸葛连弩/无限杀技能）：次数不构成约束，绝不能回退成 1；
 * - 0 或负数（本回合已用完）：真实剩余次数；
 * - NaN/非法/未知：按原生“至少 1 次”的静态口径保守回退。 */
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
 * 1. 上限：无自救牌时 hp-1；手中有 canSaveCard 自救牌（桃/酒，只看自己手牌）
 *    时允许支付全部体力——0 血进入濒死后自救到 1，复刻原生 processAI 的合法路线。
 * 2. 档位：取“能兑现最大确定击杀收益的最小档位”；收益按全回合目标集合与
 *    手杀/次数预算评估，不绑定单一最容易攻击的目标。
 * 3. 机会成本：最大可承受收益必须严格高于“不发动”的免费收益，否则返回 null。
 * 4. 返回 null：任何可承受档位都兑现不了净收益 → 调用方保留原生档位。
 */
export function reqimouOptimalX(input) {
	const { hp, shaCount, baseUses, targets, saveCount } = input || {};
	const sha = Math.max(0, Math.floor(Number(shaCount) || 0));
	const life = Number(hp);
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
