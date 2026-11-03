/* 神话再临·火：只做AI选择的质量校正，不改技能规则、目标合法性或结算。 */

/* 乱击：原生把每个目标的效果压成 sgn，再按人数阈值判断。
 * 1血、空手、无防具的队友一旦被万箭命中会直接进入濒死；这种情况下拒绝发动。 */
export function luanjiAllyLethal(input) {
	const { ally, hp, hand, armor } = input || {};
	if (!ally) return false;
	const life = Number(hp);
	const cards = Number(hand);
	if (!Number.isFinite(life) || !Number.isFinite(cards)) return false;
	return life <= 1 && cards === 0 && !armor;
}

/* 乱击：原生只对 ≥5 人的目标面设净收益门槛；更小的对局里净收益为 0 甚至为负
 * 也会烧掉两张牌。镜像原生补丁：非爆手牌状态下，各规模都要求净收益达标。 */
export function luanjiNetTooLow(input) {
	const { count, net, overLimit } = input || {};
	const n = Number(count);
	const value = Number(net);
	if (!Number.isFinite(n) || !Number.isFinite(value)) return false;
	if (overLimit) return false;
	if (n >= 7) return value < 2;
	if (n >= 5) return value < 1.5;
	return value < 1;
}

/* 天义：拼点双方都倾向出最大点数，且拼点牌会置入弃牌堆；手里最大点数
 * 不足 10 时胜率明显无望，还要白弃一张拼点牌，输掉后 天义3 再锁杀。 */
export function tianyiLowCompare(input) {
	const maxNumber = Number(input && input.maxNumber);
	if (!Number.isFinite(maxNumber)) return false;
	return maxNumber < 10;
}

/* 驱虎：复核结论——原生 result.target 的第三方扫描（任意正伤害收益）是
 * “借刀击杀”扫描的超集，可击杀局面原生必然发动；不再提供独立规则。 */

/* 鞬出：目标有装备可拆（附带杀不可响应）、残血可补刀或仅剩最后一张手牌
 * （拆掉后杀不可响应）时才值得发动；否则弃手牌会把这张杀送给目标。 */
export function jianchuWorthwhile(input) {
	const { hostile, equips, hp, hand } = input || {};
	if (!hostile) return false;
	const life = Number(hp);
	const cards = Number(hand);
	const equipCount = Number(equips);
	if (!Number.isFinite(life) || !Number.isFinite(cards) || !Number.isFinite(equipCount)) return false;
	return equipCount > 0 || life <= 1 || cards <= 1;
}

export const SHENHUA_HUO_POLICY_RULES = Object.freeze({
	luanjiAllyLethal,
	luanjiNetTooLow,
	tianyiLowCompare,
	jianchuWorthwhile,
});
