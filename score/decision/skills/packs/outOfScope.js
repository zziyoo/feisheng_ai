import { lib, game, get, _status } from '../policyCore.js?v=41a';
import { resolveActiveSkillId } from '../../safety/aiOverride.js?v=41a';
import { fairButtonScore, redimengFindNeedsFix, shouldMaskHiddenButtonChoice } from '../rules/outOfScope.js?v=41a';

export const pack = {
	id: 'out_of_scope',
	name: '清单外角色（活动武将）',
	group: 'out_of_scope',
	skills: ['redimeng'],
	statsDefaults: { fairRedimeng: 0, redimengMaskFailed: 0, redimengFindCalls: 0, redimengFindFixed: 0, redimengFindFallbacks: 0, redimengTrace: [] },
	install,
};

/* 界鲁肃【缔盟】混合后的手牌对选择者应是暗牌。
 * 宿主原生 AI 用 get.value(button.link) 直接挑最高价值牌，等于看牌；
 * 这里只给 AI 一个与牌面无关、与按钮位置/玩家 id 有关的稳定分数。 */
function install(host, stats) {
	installFairButton(host, stats);
	installFindFix(host, stats);
}

function installFairButton(host, stats) {
	const ctor = lib.element && lib.element.Player;
	const proto = ctor && ctor.prototype;
	if (!proto || typeof proto.chooseButton !== 'function') return;
	host.wrap(proto, 'chooseButton', 'redimeng:button', original => function (...args) {
		const next = original.apply(this, args);
		try {
			if (!next || next.__djscFairRedimeng) return next;
			if (this === game.me && !_status.auto) return next;
			const ids = host.activeSkillIds(this, _status.event);
			try {
				const sid = resolveActiveSkillId(this, _status.event);
				if (sid && !ids.includes(sid)) ids.push(sid);
			} catch (e) {}
			if (!shouldMaskHiddenButtonChoice(this === game.me, !!_status.auto, ids)) return next;
			const player = this;
			const getButtons = function () {
				try {
					const buttons = next.dialog && next.dialog.buttons;
					if (buttons && typeof buttons.length === 'number') return Array.prototype.slice.call(buttons);
				} catch (e) {}
				return next.buttons || [];
			};
			const score = function (button) {
				let index = 0, value = 0.5;
				const buttons = getButtons();
				try { index = host.buttonIndex(buttons, button); } catch (e) {}
				try { value = fairButtonScore((player && player.playerid) || '', index); } catch (e) { value = 0.5; }
				try {
					if (stats.redimengTrace.length < 24) stats.redimengTrace.push({ playerid: (player && player.playerid) || '', index, score: value, buttons: buttons.length });
				} catch (e) {}
				return value;
			};
			let attached = false;
			try { next.ai = score; attached = next.ai === score; } catch (e) {}
			if (typeof next.set === 'function' && !next.__djscFairRedimengSet) {
				const originalSet = next.set;
				try {
					next.set = function (key, value) {
						if (key === 'ai') value = score;
						try { return originalSet.call(this, key, value); } catch (e) { stats.redimengMaskFailed++; return this; }
					};
					next.__djscFairRedimengSet = true;
				} catch (e) {}
			}
			if (!attached && typeof next.set === 'function') {
				try { next.set('ai', score); attached = next.ai === score; } catch (e) {}
			}
			if (!attached) { stats.redimengMaskFailed++; return next; }
			next.__djscFairRedimeng = true;
			stats.fairRedimeng++;
		} catch (e) {}
		return next;
	});
	if (!proto.__djscFairRedimengHook) proto.__djscFairRedimengHook = true;
	host.addCleanup(() => {
		try { delete proto.__djscFairRedimengHook; } catch (e) {}
	});
}

/* 只修 AI 的第二目标评估；find(1)/find(3)/技能结算保持宿主原实现。 */
function installFindFix(host, stats) {
	const info = lib.skill && lib.skill.redimeng;
	if (!info || typeof info.find !== 'function') return;
	if (!redimengFindNeedsFix(String(info.find))) return;
	host.wrap(info, 'find', 'redimeng:find', original => function (type) {
		if (type !== 2) return original.apply(this, arguments);
		try {
			stats.redimengFindCalls++;
			const player = _status.event && _status.event.player;
			if (!player) return null;
			const allies = game.filterPlayer(current => current != player && get.attitude(player, current) > 3);
			if (!allies.length) return null;
			allies.sort((a, b) => a.countCards('h') - b.countCards('h'));
			const nh = allies[0].countCards('h');
			const num = player.countCards('he', card => get.value(card) < 7);
			const enemies = game.filterPlayer(current => current != player && get.attitude(player, current) < 1);
			if (!enemies.length) return null;
			enemies.sort((a, b) => b.countCards('h') - a.countCards('h'));
			for (const target of enemies) {
				const diff = target.countCards('h') - nh;
				if (diff <= num) {
					if (diff < 0) return null;
					stats.redimengFindFixed++;
					return target;
				}
			}
			return null;
		} catch (e) {
			stats.redimengFindFallbacks++;
			return null;
		}
	});
}
