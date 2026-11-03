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

export const SHENHUA_HUO_POLICY_RULES = Object.freeze({
	luanjiAllyLethal,
});
