import { lib, game, get, _status } from '../policyCore.js?v=41a';
import { resolveActiveSkillId } from '../../safety/aiOverride.js?v=41a';
import { DEFENSE_RULES, retentionAdjustment, shouldSkipExchange, retuxiHandBonus } from '../rules/refreshStandard.js?v=41a';

export const pack = {
	id: 'refresh_standard',
	name: '界限突破·标准',
	group: 'refresh',
	skills: ['rezhiheng', 'new_retuxi'],
	statsDefaults: {
		keptTao: 0, keptShan: 0, skippedExchange: 0, skippedOrder: 0,
		retuxiTargetBonus: 0, calls: 0, last: [],
	},
	install,
};

const TARGET_POLICIES = new Set(['new_retuxi']);

function install(host, stats) {
	installRezhiheng(host, stats);
	installRetuxi(host, stats);
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
						if (shouldSkipDefenseOnlyExchange(host, player || host.playerOf(), rule)) {
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
						if (shouldSkipDefenseOnlyExchange(host, player || host.playerOf(), rule)) {
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
