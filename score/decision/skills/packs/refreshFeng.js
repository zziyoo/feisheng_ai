import { lib, game, get, _status } from '../policyCore.js?v=41a';
import { reqimouNeedsPayment, reqimouOptimalX, reqimouKillableByHand } from '../rules/refreshFeng.js?v=41a';

export const pack = {
	id: 'refresh_feng',
	name: '界限突破·风',
	group: 'refresh',
	skills: ['reqimou', 'fenji'],
	statsDefaults: {
		reqimouGateSkip: 0, reqimouInfeasible: 0, reqimouClamp: 0, reqimouClampCalls: 0,
		reqimouSelfRescue: 0, reqimouInfiniteUses: 0,
	},
	install,
};

function reqimouBaseUses(host, stats, player) {
	try {
		if (typeof player.getCardUsable === 'function') {
			const num = Number(player.getCardUsable('sha'));
			/* 1.11.7 getCardUsable = 修正后 usable − 本回合已用：
			 * 连弩/无限杀技能返回 Infinity，用完后返回 0 或负数。
			 * Infinity 是真实形态，绝不能回退成 1，否则次数已无限的 AI
			 * 会误判“还需支付换次数”而无意义支付体力。 */
			if (num === Infinity) {
				stats.reqimouInfiniteUses++;
				return Infinity;
			}
			if (Number.isFinite(num)) return Math.max(0, Math.floor(num));
		}
	} catch (e) {}
	return 1;
}

/* 自己手牌中的可自救牌数（桃/酒等 canSaveCard 为真的牌）。
 * 只读自己的手牌，不读其他玩家隐藏手牌；读取失败一律按 0（无自救）保守处理。 */
function reqimouSaveCount(player) {
	try {
		if (typeof player.countCards === 'function' && typeof player.canSaveCard === 'function') {
			const count = Number(player.countCards('hs', card => {
				try { return !!player.canSaveCard(card, player); } catch (e) { return false; }
			}));
			if (Number.isFinite(count) && count > 0) return Math.floor(count);
		}
	} catch (e) {}
	return 0;
}

function reqimouAttackRange(player) {
	try {
		/* 宿主真实 API：含武器与 attackRange/attackRangeFinal 修正；
		 * 1.11.7 没有名为 attackRange 的数值属性，不能回退读取它。 */
		if (typeof player.getAttackRange === 'function') {
			const num = Number(player.getAttackRange());
			if (Number.isFinite(num)) return num;
		}
	} catch (e) {}
	return 1;
}

function reqimouTargets(host, stats, player) {
	const baseUses = reqimouBaseUses(host, stats, player);
	const saveCount = reqimouSaveCount(player);
	return host.aliveOthers(player).map(target => {
		let record = null;
		try {
			record = {
				currentlyInRange: !!player.canUse('sha', target),
				canUseIgnoringDistance: !!player.canUse('sha', target, false),
				effect: get.effect(target, { name: 'sha' }, player, player),
				distance: get.distance(player, target),
				attackRange: reqimouAttackRange(player),
				hp: target.hp,
				baseUses,
				saveCount,
			};
		} catch (e) { record = null; }
		return record;
	}).filter(Boolean);
}

function install(host, stats) {
	const fenji = lib.skill && lib.skill.fenji;
	if (fenji && typeof fenji.check === 'function') {
		host.wrap(fenji, 'check', 'fenji:check', original => function (event, player, triggername, target) {
			try {
				if (get.attitude(player, target) <= 0) return false;
				return 2 * get.effect(target, { name: 'draw' }, target, player) + get.effect(player, { name: 'losehp' }, player, player) > 0;
			} catch (e) { return original.apply(this, arguments); }
		});
	}
	const info = lib.skill && lib.skill.reqimou;
	const result = info && info.ai && info.ai.result;
	if (result && typeof result.player === 'function') {
		host.wrap(result, 'player', 'reqimou:gate', original => function (player) {
			const native = original.apply(this, arguments);
			try {
				const targets = reqimouTargets(host, stats, player);
				/* 目标枚举为空说明读局失败，保留原生 gate，不误拦。 */
				if (Number(native) > 0 && targets.length) {
					if (!reqimouNeedsPayment(targets)) {
						stats.reqimouGateSkip++;
						return 0;
					}
					const shaCount = player.countCards('hs', card => host.cardName(card, player) === 'sha');
					const saveCount = reqimouSaveCount(player);
					if (saveCount > 0) stats.reqimouSelfRescue++;
					if (reqimouKillableByHand(shaCount, targets)
						&& reqimouOptimalX({ hp: player.hp, shaCount, baseUses: reqimouBaseUses(host, stats, player), saveCount, targets }) == null) {
						stats.reqimouInfeasible++;
						return 0;
					}
				}
			} catch (e) {}
			return native;
		});
	}
	if (!info || typeof info.content !== 'function') return;
	host.wrap(info, 'content', 'reqimou:content', originalContent => async function (event, trigger, player) {
		const originalChooseNumbers = typeof player.chooseNumbers === 'function' ? player.chooseNumbers : null;
		if (originalChooseNumbers) {
			player.chooseNumbers = function (...args) {
				/* 一次性作用域：进入即还原，reqimou 结算窗口内其他事件的
				 * chooseNumbers（如触发技询问）不会被本策略改写。 */
				player.chooseNumbers = originalChooseNumbers;
				const next = originalChooseNumbers.apply(this, args);
				const originalForResult = typeof next.forResult === 'function' ? next.forResult : null;
				/* 宿主优先交给本地或联机真人处理；无法判定时不改选择结果。 */
				let isAI = false;
				try { isAI = typeof next.isMine === 'function' && typeof next.isOnline === 'function' && !next.isMine() && !next.isOnline(); } catch (e) {}
				if (originalForResult && isAI) {
					next.forResult = async function (...forArgs) {
						const result = await originalForResult.apply(this, forArgs);
						try {
							stats.reqimouClampCalls++;
							const shaCount = player.countCards('hs', card => host.cardName(card, player) === 'sha');
							const optimal = reqimouOptimalX({
								hp: player.hp, shaCount,
								baseUses: reqimouBaseUses(host, stats, player),
								saveCount: reqimouSaveCount(player),
								targets: reqimouTargets(host, stats, player),
							});
							if (optimal != null && result && Array.isArray(result.numbers) && result.numbers.length) {
								const paid = Number(result.numbers[0]);
								if (Number.isFinite(paid) && paid > optimal) {
									result.numbers[0] = optimal;
									stats.reqimouClamp++;
								}
							}
						} catch (e) {}
						return result;
					};
				}
				return next;
			};
		}
		try {
			return await originalContent.apply(this, arguments);
		} finally {
			if (originalChooseNumbers) player.chooseNumbers = originalChooseNumbers;
		}
	});
}
