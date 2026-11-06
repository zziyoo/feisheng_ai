import { lib, game, get } from '../policyCore.js?v=41a';
import { localUtility, bestLocalPlan } from './boundedSkillUtility.js?v=41a';

/* 局部尺度：一张未知摸牌取 4.5，仅用于同一技能内部比较。
 * 不与 get.effect、画像分或其他技能的效用直接相加。 */
const DRAW = 4.5;

function costOf(player, card, hand) {
	const raw = Number(get.value(card, player));
	if (!Number.isFinite(raw)) return null;
	return Math.max(0, raw);
}

/* 每类资源只在方案确实耗尽时计一次额外机会成本；牌面价值另计。 */
function exhaustionCost(player, hand, group) {
	const removed = group.map(e => e.card);
	let cost = 0;
	for (const name of ['tao', 'shan', 'wuxie', 'sha']) {
		const owned = hand.filter(card => get.name(card, player) === name);
		if (!owned.length || !owned.every(card => removed.includes(card))) continue;
		if (name === 'tao') cost += player.hp <= 2 ? 3 : 1;
		else if (name === 'shan') cost += game.hasPlayer(p => p !== player && get.attitude(player, p) < 0) ? 2 : 0.5;
		else if (name === 'wuxie') cost += 1;
		else if (player.getCardUsable?.('sha') > 0 && game.hasPlayer(p => p !== player && player.canUse(owned[0], p))) cost += 1;
	}
	return cost;
}

export function exchangePlan(player) {
	try {
		const hand = player.getCards('h');
		const cards = player.getCards('he');
		if (!cards.length || cards.length > 16 || !lib.filter?.cardDiscardable) return null;
		const entries = cards.map(card => ({ card, cost: costOf(player, card, hand),
			legal: lib.filter.cardDiscardable(card, player, 'rezhiheng') }));
		if (entries.some(e => e.cost === null)) return null;
		const legal = entries.filter(e => e.legal).sort((a, b) => a.cost - b.cost);
		const plans = [];
		function add(group, allHand) {
			if (!group.length) return;
			const ledger = localUtility([{ source: 'unknown-draw', value: DRAW * (group.length + (allHand ? 1 : 0)) },
				{ source: 'discard-value', value: -group.reduce((n, e) => n + e.cost, 0) },
				{ source: 'exhausted-reserve', value: -exhaustionCost(player, hand, group) }]);
			if (ledger) plans.push({ ...ledger, cards: group.map(e => e.card), target: null });
		}
		for (let i = 1; i <= Math.min(8, legal.length); i++) {
			const group = legal.slice(0, i);
			add(group, hand.length > 0 && hand.every(card => group.some(e => e.card === card)));
		}
		if (hand.length && hand.every(card => legal.some(e => e.card === card))) {
			const all = legal.filter(e => hand.includes(e.card));
			add(all, true);
			const extra = legal.filter(e => !hand.includes(e.card) && e.cost < DRAW).slice(0, 4);
			if (extra.length) add(all.concat(extra), true);
		}
		return bestLocalPlan(plans);
	} catch (_) { return null; }
}

/* 目标手牌只读取公开数量；不会对目标调用 get.value 或读取其牌面。 */
export function giftPlan(player, phase) {
	try {
		if (!phase || typeof player.getHistory !== 'function') return null;
		const hand = player.getCards('h');
		if (!hand.length || hand.length > 16 || hand.some(c => get.name(c, player) === 'du')) return null;
		let given = 0;
		player.getHistory('lose', evt => {
			if (evt.getParent(2)?.name === 'rerende' && evt.getParent('phaseUse') === phase) given += evt.cards.length;
		});
		const targets = (game.players || []).filter(t => t !== player && t.isIn?.() &&
			get.attitude(player, t) > 0 && !t.hasSkillTag?.('nogain') &&
			lib.skill.rerende.filterTarget(null, player, t));
		const basics = typeof get.inpileVCardList === 'function'
			? new Set(get.inpileVCardList(info => info[0] === 'basic').map(info => info[2])) : new Set();
		const entries = hand.map(card => ({ card, cost: costOf(player, card, hand) }));
		if (entries.some(e => e.cost === null)) return null;
		entries.sort((a, b) => a.cost - b.cost);
		/* 同时保留稀缺防御牌候选，避免仅按自身价值排序遗漏受赠收益。 */
		const pool = entries.slice(0, 6);
		for (const entry of entries) {
			const name = get.name(entry.card, player);
			if ((name === 'tao' || name === 'shan') && !pool.includes(entry) && pool.length < 8) pool.push(entry);
		}
		const plans = [];
		for (const target of targets.slice(0, 6)) {
			const groups = pool.map(e => [e]);
			for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) groups.push([pool[i], pool[j]]);
			for (const group of groups) {
				let gift = 0;
				for (const e of group) {
					const name = get.name(e.card, player);
					gift += name === 'tao' && target.hp < target.maxHp ? 5 :
						name === 'shan' && target.hp <= 2 ? 4.5 : 3.5;
				}
				/* 只对当前可合法使用的基本牌给温和启发式，不预测赠牌后新牌。 */
				let follow = 0;
				if (given < 2 && given + group.length >= 2) {
					if (basics.has('tao') && player.isDamaged?.() && player.canUse?.({ name: 'tao', isCard: true }, player)) follow = 2;
					else if (basics.has('sha') && player.getCardUsable?.('sha') > 0 &&
						game.hasPlayer(p => p !== player && player.canUse({ name: 'sha', isCard: true }, p))) follow = 1;
				}
				const ledger = localUtility([{ source: 'recipient-public-need', value: gift },
					{ source: 'gift-value', value: -group.reduce((n, e) => n + e.cost, 0) },
					{ source: 'exhausted-reserve', value: -exhaustionCost(player, hand, group) },
					{ source: 'legal-basic-opportunity', value: follow }]);
				if (ledger) plans.push({ ...ledger, cards: group.map(e => e.card), target });
			}
		}
		return bestLocalPlan(plans);
	} catch (_) { return null; }
}
