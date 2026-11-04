/* 神话再临·火：只做AI选择的质量校正，不改技能规则、目标合法性或结算。 */

/* 乱击：原生把每个目标的效果压成 sgn，再按人数阈值判断。
 * 1血、空手、无防具的队友一旦被万箭命中会直接进入濒死；这种情况下拒绝发动。
 * 例外（复用宿主真实响应/减伤判断，不凭空认定必然受伤）：
 * - 有护甲（hujia）时 1 点伤害先被护甲吸收，不会掉体力；
 * - 有 freeShan 技能标签（如八阵的虚拟八卦）时空手也能自动响应闪。 */
export function luanjiAllyLethal(input) {
	const { ally, hp, hand, armor, hujia, freeShan } = input || {};
	if (!ally) return false;
	const life = Number(hp);
	const cards = Number(hand);
	if (!Number.isFinite(life) || !Number.isFinite(cards)) return false;
	if (life > 1 || cards !== 0 || armor) return false;
	if (Number(hujia) > 0) return false;
	if (freeShan) return false;
	return true;
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
 * 不足 10 时胜率明显无望，还要白弃一张拼点牌，输掉后 天义3 再锁杀。
 * 这是保守默认，不是绝对禁令（见 tianyiKnownWinAvailable）。 */
export function tianyiLowCompare(input) {
	const maxNumber = Number(input && input.maxNumber);
	if (!Number.isFinite(maxNumber)) return false;
	return maxNumber < 10;
}

/* 天义局部例外：对手手牌完全已知（含唯一拼点牌已公开）且其最大点数
 * 小于己方最大点数时，胜率可以可靠估算为必胜，此时低点数也应发动。
 * candidates 只允许携带公开可知信息：knownCount 必须覆盖全部手牌数，
 * 不得以部分已知或隐藏牌面估胜率。 */
export function tianyiKnownWinAvailable(input) {
	const { maxNumber, candidates } = input || {};
	const mx = Number(maxNumber);
	if (!Number.isFinite(mx) || mx >= 10 || !Array.isArray(candidates)) return false;
	return candidates.some(function (candidate) {
		if (!candidate) return false;
		if (!candidate.hostile || !candidate.comparable) return false;
		const handCount = Number(candidate.handCount);
		const knownCount = Number(candidate.knownCount);
		const knownMax = Number(candidate.knownMax);
		if (!Number.isFinite(handCount) || handCount <= 0) return false;
		if (!Number.isFinite(knownCount) || knownCount < handCount) return false;
		if (!Number.isFinite(knownMax)) return false;
		return knownMax < mx;
	});
}

/* 驱虎：复核结论——原生 result.target 的第三方扫描（任意正伤害收益）是
 * “借刀击杀”扫描的超集，可击杀局面原生必然发动；不再提供独立规则。 */

/* 鞬出：目标有装备可拆（附带杀不可响应）、残血可补刀或仅剩最后一张手牌
 * （拆掉后杀不可响应）时才值得发动；否则弃手牌会把这张杀送给目标。
 * hp≤1 分支的动机是击杀：目标还有护甲时 1 点伤害先被护甲吸收，
 * 该分支不成立（拆装备/拆最后一张手牌分支不受影响）。 */
export function jianchuWorthwhile(input) {
	const { hostile, equips, hp, hand, hujia } = input || {};
	if (!hostile) return false;
	const life = Number(hp);
	const cards = Number(hand);
	const equipCount = Number(equips);
	if (!Number.isFinite(life) || !Number.isFinite(cards) || !Number.isFinite(equipCount)) return false;
	if (equipCount > 0) return true;
	if (cards <= 1) return true;
	return life <= 1 && !(Number(hujia) > 0);
}

export const SHENHUA_HUO_POLICY_RULES = Object.freeze({
	luanjiAllyLethal,
	luanjiNetTooLow,
	tianyiLowCompare,
	tianyiKnownWinAvailable,
	jianchuWorthwhile,
});
