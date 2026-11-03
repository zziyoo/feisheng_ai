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
/* 界魏延【狂骨】：原生只在“手里有足够杀”时回复；1血空手时仍摸牌。
 * 1血且可回复时优先回复，其余情况完全沿用原生判断。 */
export function kuangguChoice(input) {
	const { hp, isDamaged, recoverEffect, nativeRecover } = input || {};
	const life = Number(hp);
	const healable = !!isDamaged && Number(recoverEffect) > 0;
	if (healable && Number.isFinite(life) && life <= 1) return 'recover_hp';
	if (nativeRecover) return 'recover_hp';
	return 'draw_card';
}

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
