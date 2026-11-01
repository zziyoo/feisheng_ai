import { lib, game, _status } from '../policyCore.js?v=41a';
import { resolveActiveSkillId } from '../../safety/aiOverride.js?v=41a';
import { fairButtonScore, shouldMaskHiddenButtonChoice } from '../rules/outOfScope.js?v=41a';

export const pack = {
	id: 'out_of_scope',
	name: '清单外角色（活动武将）',
	group: 'out_of_scope',
	skills: ['redimeng'],
	statsDefaults: { fairRedimeng: 0, redimengMaskFailed: 0, redimengTrace: [] },
	install,
};

/* 界鲁肃【缔盟】混合后的手牌对选择者应是暗牌。
 * 宿主原生 AI 用 get.value(button.link) 直接挑最高价值牌，等于看牌；
 * 这里只给 AI 一个与牌面无关、与按钮位置/玩家 id 有关的稳定分数。 */
function install(host, stats) {
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
