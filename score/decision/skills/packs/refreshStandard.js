import { lib, game, get, ui, _status } from '../policyCore.js?v=41a';
import { exchangePlan, giftPlan } from '../rules/refreshStandardPlans.js?v=41a';
import { registerSkillPlanHint } from '../skillPlanHints.js?v=41a';
import { resolveActiveSkillId } from '../../safety/aiOverride.js?v=41a';
import { DEFENSE_RULES, retentionAdjustment, shouldSkipExchange, retuxiHandBonus } from '../rules/refreshStandard.js?v=41a';

export const pack = {
	id: 'refresh_standard',
	name: '界限突破·标准',
	group: 'refresh',
	skills: ['rezhiheng', 'rerende', 'new_retuxi', 'new_yijue', 'refanjian', 'new_reqingnang', 'rejieyin'],
	statsDefaults: {
		keptTao: 0, keptShan: 0, skippedExchange: 0, skippedOrder: 0,
		retuxiTargetBonus: 0, calls: 0, last: [],
	},
	install,
};

const TARGET_POLICIES = new Set(['new_retuxi']);

function install(host, stats) {
	installRezhiheng(host, stats);
	installRerende(host);
	installRetuxi(host, stats);
	installYijue(host);
	installFanjian(host);
	installQingnang(host);
	installJieyin(host);
	for (const [id, evaluate] of [['rezhiheng', exchangePlan], ['rerende', currentGiftPlan]]) {
		host.addCleanup(registerSkillPlanHint(id, player => {
			const plan = evaluate(player);
			if (!plan) return null;
			const value = name => plan.contributions?.find(c => c.source === name)?.value || 0;
			return { status: plan.cards.length ? 'positive' : 'no-positive-bounded-plan', total: plan.total,
				cost: value(id === 'rerende' ? 'gift-value' : 'discard-value'), reserve: value('exhausted-reserve'),
				delta: plan.cards.length ? Math.min(0.75, 0.2 + plan.total / 20) : -0.25 };
		}));
	}
}

function installJieyin(host) {
	const info = lib.skill?.rejieyin;
	if (typeof info?.check !== 'function') return;
	host.wrap(info, 'check', 'rejieyin:check', original => function (card) {
		try {
			const player = _status.event?.player;
			if (!player) return original.apply(this, arguments);
			const eligible = equip => game.hasPlayer(current => current !== player && current.hasSex('male') && get.attitude(player, current) > 0 && !current.countCards('e', { subtype: get.subtype(equip) }) && current.canEquip(equip));
			if (get.position(card) === 'e') {
				if (!eligible(card)) return 0;
				return (player.countCards('h', { subtype: get.subtype(card) }) ? 20 : 10) - get.value(card);
			}
			return player.getCards('e').some(eligible) ? 0 : 8 - get.value(card);
		} catch (_) { return original.apply(this, arguments); }
	});
}

function installQingnang(host) {
	const info = lib.skill?.new_reqingnang;
	if (typeof info?.check !== 'function') return;
	host.wrap(info, 'check', 'new_reqingnang:check', original => function (card) {
		const base = original.apply(this, arguments);
		try {
			const player = _status.event?.player;
			if (!player || get.color(card) !== 'black' || base !== 3 - get.value(card)) return base;
			const targets = game.countPlayer(current => current.hp < current.maxHp && !current.hasSkill('new_reqingnang_off') && get.recoverEffect(current, player, player) > 0 && get.attitude(player, current) > 2);
			const red = player.getCards('h').some(other => other !== card && get.color(other, player) === 'red' && lib.filter.cardDiscardable(other, player, 'new_reqingnang'));
			return targets > 1 && red ? base : 9 - get.value(card);
		} catch (_) { return base; }
	});
}

function installFanjian(host) {
	const result = lib.skill?.refanjian?.ai?.result;
	if (typeof result?.target !== 'function') return;
	host.wrap(result, 'target', 'refanjian:target', original => function (player, target) {
		const card = ui.selected?.cards?.[0];
		if (!card) return original.apply(this, arguments);
		try {
			const suit = get.suit(card);
			const exposed = target.getCards('e').filter(item => get.suit(item) === suit && lib.filter.cardDiscardable(item, target, 'refanjian')).length;
			const pressure = Math.min(1, exposed * 0.5 + target.countCards('h') * 0.25);
			return -pressure - (get.name(card, player) === 'du' ? 1 : 0);
		} catch (_) { return original.apply(this, arguments); }
	});
}

function installYijue(host) {
	const result = lib.skill?.new_yijue?.ai?.result;
	if (typeof result?.target !== 'function') return;
	host.wrap(result, 'target', 'new_yijue:target', original => function (player, target) {
		const base = original.apply(this, arguments);
		if (base !== -2) return base;
		try {
			const paid = ui.selected?.cards || [];
			const cards = player.getCards('he').filter(card => !paid.includes(card));
			const sha = cards.some(card => get.name(card, player) === 'sha');
			const wusheng = player.hasSkill('new_rewusheng') && cards.some(card => get.color(card, player) === 'red' || get.zhu(player, 'shouyue'));
			return player.getCardUsable('sha') > 0 && player.canUse('sha', target) && (sha || wusheng) ? base : -0.5;
		} catch (_) { return base; }
	});
}

function currentGiftPlan(player) {
	try {
		const phase = _status.event?.getParent?.('phaseUse');
		return phase?.name === 'phaseUse' ? giftPlan(player, phase) : null;
	} catch (_) { return null; }
}

/* 只在宿主当前选择事件内缓存；玩家状态变化时放弃方案并交回原生。 */
const choicePlans = new WeakMap();
function observeChoicePlan(event, skill, plan, reason) {
	try {
		if (typeof window === 'undefined' || window.__DJSC_DECISION_TRACE !== true) return;
		event.__djscRefreshPlanAudit = () => {
			const selected = event.result?.cards || [];
			const targets = event.result?.targets || [];
			const cardsMatch = !!plan && selected.length === plan.cards.length && selected.every(c => plan.cards.includes(c));
			const targetMatch = skill !== 'rerende' || !!plan?.target && targets.includes(plan.target);
			const part = name => plan?.contributions?.find(c => c.source === name)?.value ?? null;
			return { source: 'refresh-standard-plan', skill, offered: !!plan,
				adopted: cardsMatch && targetMatch,
				reason: !plan ? reason : !cardsMatch ? 'materials-unconfirmed-or-different' : !targetMatch ? 'target-unconfirmed-or-different' : null,
				cost: part(skill === 'rerende' ? 'gift-value' : 'discard-value'), reserve: part('exhausted-reserve') };
		};
	} catch (_) { /* 诊断不得改变选择 */ }
}
function choicePlan(skill, player) {
	try {
		const event = _status.event;
		if (!event || event.player !== player || event.skill !== skill) return null;
		const cards = player.getCards('he');
		const state = [player.hp, player.maxHp, player.getCardUsable?.('sha'), event.getParent?.('phaseUse'), player.getHistory?.('lose')?.length, player.countMark?.('rerende'),
			...(game.players || []).map(p => [p, p.hp, p.maxHp, p.countCards('h'), p.isIn?.(), get.attitude(player, p)]).flat()];
		let cached = choicePlans.get(event);
		if (cached && (cached.skill !== skill || cached.cards.length !== cards.length ||
			cached.cards.some((c, i) => c !== cards[i]) || cached.state.length !== state.length ||
			cached.state.some((v, i) => v !== state[i]))) {
			choicePlans.delete(event);
			observeChoicePlan(event, skill, null, 'state-changed');
			return null;
		}
		if (!cached) {
			const plan = skill === 'rerende' ? currentGiftPlan(player) : exchangePlan(player);
			if (!plan?.cards?.length) {
				observeChoicePlan(event, skill, null, plan ? 'no-positive-bounded-plan' : 'context-unavailable');
				return null;
			}
			cached = { skill, cards, state, plan };
			choicePlans.set(event, cached);
			observeChoicePlan(event, skill, plan, null);
		}
		if (skill === 'rerende' && (!cached.plan.target?.isIn?.() ||
			!lib.skill.rerende.filterTarget(null, player, cached.plan.target))) return null;
		if (skill === 'rezhiheng' && cached.plan.cards.some(c => !lib.filter.cardDiscardable(c, player, skill))) return null;
		return cached.plan;
	} catch (_) { return null; }
}

function installRerende(host) {
	const info = lib.skill?.rerende;
	if (!info) return;
	if (typeof info.ai?.order === 'function') host.wrap(info.ai, 'order', 'rerende:order', original => function (item, player) {
		const base = original.apply(this, arguments);
		const plan = player && currentGiftPlan(player);
		return plan?.cards.length && Number.isFinite(Number(base)) ? Number(base) + 0.5 : base;
	});
	if (typeof info.check === 'function') host.wrap(info, 'check', 'rerende:check', original => function (card) {
		const player = host.playerOf(card);
		const plan = player && choicePlan('rerende', player);
		const selected = ui.selected?.cards || [];
		if (plan && selected.every(c => plan.cards.includes(c))) return plan.cards.includes(card) ? 1 : -1;
		return original.apply(this, arguments);
	});
	const result = info.ai?.result;
	if (result && typeof result.target === 'function') host.wrap(result, 'target', 'rerende:target', original => function (player, target) {
		const plan = choicePlan('rerende', player);
		const selected = ui.selected?.cards || [];
		if (plan && selected.length === plan.cards.length && selected.every(c => plan.cards.includes(c))) {
			return target === plan.target ? 1 : 0;
		}
		return original.apply(this, arguments);
	});
}

function defenseAdjustment(host, card, player, base, rule) {
	try {
		if (!player || !card || !rule) return base;
		return retentionAdjustment(host.cardName(card, player), player.hp, host.position(card), base, rule);
	} catch (e) { return base; }
}

function shouldSkipDefenseOnlyExchange(host, player, rule) {
	try {
		if (!player || !rule) return false;
		const handNames = player.getCards('h').map(card => host.cardName(card, player));
		return shouldSkipExchange(player.hp, handNames, rule);
	} catch (e) { return false; }
}

function installRezhiheng(host, stats) {
	for (const [sid, rule] of Object.entries(DEFENSE_RULES)) {
		const info = lib.skill && lib.skill[sid];
		if (!info) continue;
		if (typeof info.check === 'function') {
			host.wrap(info, 'check', sid + ':check', original => function (card) {
				let base;
				try { base = original.apply(this, arguments); } catch (e) { return original.apply(this, arguments); }
				try {
					stats.calls++;
					const player = host.playerOf(card);
					const plan = choicePlan('rezhiheng', player);
					const selected = ui.selected?.cards || [];
					if (plan && selected.every(item => plan.cards.includes(item))) {
						return plan.cards.includes(card) ? 1 : -1;
					}
					const adjusted = defenseAdjustment(host, card, player, base, rule);
					if (adjusted !== base) {
						const name = host.cardName(card, player);
						if (name === 'tao') stats.keptTao++;
						else if (name === 'shan') stats.keptShan++;
					}
					if (stats.last.length < 20) stats.last.push({ sid, card: host.cardName(card, player), hp: player && player.hp, pos: host.position(card), base, adjusted });
					return adjusted;
				} catch (e) { return base; }
			});
		}
		const ai = info.ai;
		if (ai && ai.order != null) {
			host.wrap(ai, 'order', sid + ':order', original => {
				const baseOf = typeof original === 'function' ? original : function () { return original; };
				return function (item, player) {
					let base;
					try { base = baseOf.apply(this, arguments); } catch (e) { return typeof original === 'function' ? 0 : original; }
					try {
						const plan = exchangePlan(player || host.playerOf());
						if (plan?.cards.length && Number.isFinite(Number(base))) return Number(base) + 0.5;
						if (!plan && shouldSkipDefenseOnlyExchange(host, player || host.playerOf(), rule)) {
							stats.skippedOrder++;
							return -1;
						}
					} catch (e) {}
					return base;
				};
			});
		}
		const result = ai && ai.result;
		if (result && result.player != null) {
			host.wrap(result, 'player', sid + ':result', original => {
				const baseOf = typeof original === 'function' ? original : function () { return original; };
				return function (player) {
					let base;
					try { base = baseOf.apply(this, arguments); } catch (e) { return typeof original === 'function' ? 0 : original; }
					try {
						const plan = exchangePlan(player || host.playerOf());
						if (!plan && shouldSkipDefenseOnlyExchange(host, player || host.playerOf(), rule)) {
							stats.skippedExchange++;
							return Math.min(Number(base), -1);
						}
					} catch (e) {}
					return base;
				};
			});
		}
	}
}

function installRetuxi(host, stats) {
	host.wrapPrototype('Player', 'chooseTarget', 'retuxi:target', original => function (...args) {
		const next = original.apply(this, args);
		try {
			if (!next || next.__djscRetuxiTarget) return next;
			const player = this;
			if (player === game.me && !_status.auto) return next;
			const sid = resolveActiveSkillId(player, _status.event);
			if (!TARGET_POLICIES.has(sid)) return next;
			const apply = baseAI => function (target) {
				let score = 0;
				try { if (typeof baseAI === 'function') score = Number(baseAI.apply(this, arguments)) || 0; } catch (e) {}
				try {
					const hasLossBenefit = !!(target && ((typeof target.hasSkill === 'function' && target.hasSkill('tuntian')) || (typeof target.hasSkillTag === 'function' && target.hasSkillTag('nocard'))));
					const bonus = retuxiHandBonus(target ? target.countCards('h') : 0, !!target && get.attitude(player, target) < 0, hasLossBenefit);
					if (bonus) { score += bonus; stats.retuxiTargetBonus++; }
				} catch (e) {}
				return score;
			};
			if (typeof next.ai === 'function') next.ai = apply(next.ai);
			if (typeof next.set === 'function' && !next.__djscRetuxiTargetSet) {
				const originalSet = next.set;
				next.set = function (key, value) {
					if (key === 'ai') value = apply(value);
					return originalSet.call(this, key, value);
				};
				next.__djscRetuxiTargetSet = true;
			}
			next.__djscRetuxiTarget = true;
		} catch (e) {}
		return next;
	});
}
