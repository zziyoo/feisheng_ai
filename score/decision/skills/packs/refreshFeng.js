import { lib, game, get, _status } from '../policyCore.js?v=41a';
import { reqimouNeedsPayment, reqimouOptimalX } from '../rules/refreshFeng.js?v=41a';

export const pack = {
	id: 'refresh_feng',
	windProtocol: 'dual-feng-shared-entry-v1',
	name: '界限突破·风',
	group: 'refresh',
	skills: ['reqimou', 'fenji', 'reguhuo', 'oltianxiang', 'xinliegong'],
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

/* 只计算自己持有且当前可启用、至少有一个合法目标的实体杀。
 * 不检查当前次数：奇谋支付可增加次数。未知状态按不可用处理。 */
function reqimouUsableSha(host, player) {
	try {
		if (typeof lib.filter?.cardEnabled !== 'function') return 0;
		const targets = host.aliveOthers(player);
		return player.countCards('hs', card => {
			if (host.cardName(card, player) !== 'sha' || !lib.filter.cardEnabled(card, player)) return false;
			return targets.some(target => player.canUse(card, target, false));
		});
	} catch (e) { return 0; }
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
				hujia: target.hujia,
				baseUses,
				saveCount,
			};
		} catch (e) { record = null; }
		return record;
	}).filter(Boolean);
}

function install(host, stats) {
	/* 无中生有净增手牌恰可改变烈弓的不可响应条件时提高顺序。 */
	const liegong = lib.skill?.xinliegong?.mod;
	if (liegong && typeof liegong.aiOrder === 'function') {
		host.wrapShared(liegong, 'aiOrder', 'xinliegong.aiOrder.draw-unlock.v1', original => function (player, card, num) {
			try {
				if (num > 0 && card?.name === 'wuzhong' && get.tag(card, 'draw') === 2 && player.getCardUsable('sha') > 0 && player.getCards('h').includes(card)) {
					const hand = player.countCards('h');
					if (player.getCards('h', 'sha').some(sha => game.hasPlayer(target => target !== player && get.attitude(player, target) < 0 && target.countCards('h') === hand && player.canUse(sha, target) && get.effect(target, sha, player, player) > 0))) return num + 7;
				}
			} catch (e) {}
			return original.apply(this, arguments);
		});
	}
	/* 空手时装备公开，可检查实际可弃红桃；有暗牌时保留宿主估值。 */
	const tianxiangEffect = lib.skill?.oltianxiang?.ai?.effect;
	if (tianxiangEffect && typeof tianxiangEffect.target === 'function') {
		host.wrap(tianxiangEffect, 'target', 'oltianxiang:effect', original => function (card, player, target) {
			try {
				if (!get.tag(card, 'damage') || target.countCards('h') || player.hasSkillTag('jueqing', false, target)) return original.apply(this, arguments);
				return target.hasCard(material => get.suit(material, target) === 'heart' && lib.filter.cardDiscardable(material, target), 'e') ? 0.7 : undefined;
			} catch (e) { return original.apply(this, arguments); }
		});
	}
	const guhuo = lib.skill && lib.skill.reguhuo && lib.skill.reguhuo.chooseButton;
	if (guhuo && typeof guhuo.backup === 'function' && String(guhuo.backup).includes('getRand("reguhuo")')) {
		host.wrap(guhuo, 'backup', 'reguhuo:backup', original => function () {
			const backup = original.apply(this, arguments);
			if (!backup || typeof backup.ai1 !== 'function') return backup;
			const ai1 = backup.ai1;
			backup.ai1 = function (card) {
				const score = ai1.apply(this, arguments);
				if (score !== 10) return score;
				try {
					const event = _status.event, player = event.player, declared = backup.viewAs;
					if (!declared || card.name !== declared.name || (card.name === 'sha' && !get.is.sameNature(card, declared))) return score;
					const hasEnemy = game.hasPlayer(current => current !== player && !current.hasSkill('rechanyuan') && (get.realAttitude || get.attitude)(current, player) < 0);
					if (!hasEnemy || !(event.getRand('reguhuo') > 0.3)) return score;
					const value = Number(get.value(card, player));
					return Number.isFinite(value) ? 10 - Math.max(-9, Math.min(9, value)) / 10 : score;
				} catch (e) { return score; }
			};
			return backup;
		});
	}
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
					const shaCount = reqimouUsableSha(host, player);
					if (!shaCount) return 0;
					const saveCount = reqimouSaveCount(player);
					if (saveCount > 0) stats.reqimouSelfRescue++;
					if (reqimouOptimalX({ hp: player.hp, shaCount, baseUses: reqimouBaseUses(host, stats, player), saveCount, targets }) == null) {
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
		let scopedChooseNumbers = null;
		if (originalChooseNumbers) {
			scopedChooseNumbers = function (...args) {
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
							const shaCount = reqimouUsableSha(host, player);
							const optimal = reqimouOptimalX({
								hp: player.hp, shaCount,
								baseUses: reqimouBaseUses(host, stats, player),
								saveCount: reqimouSaveCount(player),
								targets: reqimouTargets(host, stats, player),
							});
							if (optimal != null && result && result.bool !== false && Array.isArray(result.numbers) && result.numbers.length) {
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
			player.chooseNumbers = scopedChooseNumbers;
		}
		try {
			return await originalContent.apply(this, arguments);
		} finally {
			if (scopedChooseNumbers && player.chooseNumbers === scopedChooseNumbers) player.chooseNumbers = originalChooseNumbers;
		}
	});
}
