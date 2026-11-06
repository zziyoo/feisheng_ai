import { lib, game } from '../policyCore.js?v=41a';
import { olkongshengCostNeedsFix, olkongshengExpansionView } from '../rules/shenhuaLei.js?v=41a';

export const pack = {
	id: 'shenhua_lei',
	name: '神话再临·雷',
	group: 'shenhua',
	skills: ['olkongsheng', 'xinfu_fuyin', 'drlt_qianjie'],
	statsDefaults: { olkongshengCostCalls: 0, olkongshengCompatible: null },
	install,
};

/* 周妃【箜声·旧版 olkongsheng】成本 AI 的宿主笔误：
 * getExpansions("olkongsheng") 返回数组，直接 + 数字会变成字符串，
 * 导致“是否已到良姻回复阈值”的数量比较失真。
 * 只在这一次 cost 调用期间给返回数组加 valueOf/toString=长度，
 * 不复制宿主技能函数，也不改变数组本身的迭代/取值行为。 */
function install(host, stats) {
	installFuyin(host);
	installQianjie(host);
	const info = lib.skill && lib.skill.olkongsheng;
	if (!info || typeof info.cost !== 'function') return;
	const original = info.cost;
	stats.olkongshengCompatible = olkongshengCostNeedsFix(String(original));
	if (!stats.olkongshengCompatible) {
		try { console.warn('[无名AI·技能策略] olkongsheng.cost 形态已变化，跳过箜声数量修正'); } catch (e) {}
		return;
	}
	host.wrap(info, 'cost', 'olkongsheng:cost', originalCost => async function (event, trigger, player) {
		const originalGet = player.getExpansions;
		if (typeof originalGet === 'function') {
			const scopedGet = function (name) {
				const result = originalGet.apply(this, arguments);
				if (name === 'olkongsheng' && Array.isArray(result)) return olkongshengExpansionView(result);
				return result;
			};
			try { Object.defineProperty(scopedGet, '__djscOlkongshengScope', { value: true, configurable: true }); } catch (e) {}
			player.getExpansions = scopedGet;
		}
		try {
			stats.olkongshengCostCalls++;
			return await originalCost.apply(this, arguments);
		} finally {
			if (originalGet) player.getExpansions = originalGet;
		}
	});
}

/* 父荫以被指定者为准检查本回合历史；仅替换宿主同形态评分。 */
function installFuyin(host) {
	const effect = lib.skill?.xinfu_fuyin?.ai?.effect;
	if (!effect || typeof effect.target !== 'function' || !String(effect.target).includes('evt.targets.includes(player)')) return;
	host.wrap(effect, 'target', 'xinfu_fuyin:effect', original => function (card, player, target) {
		try {
			let hs = player.getCards('h', c => c !== card && (!card.cards || !card.cards.includes(c)));
			let num = player.getCardUsable('sha');
			if ((card.name !== 'sha' && card.name !== 'juedou') || hs.length < target.countCards('h')) return 1;
			if (game.hasPlayer2(current => current.getHistory('useCard', evt => evt.card && ['sha', 'juedou'].includes(evt.card.name) && evt.targets.includes(target)).length > 0)) return 1;
			if (card.name === 'sha') num--;
			hs = hs.filter(c => {
				if (!player.canUse(c, target)) return false;
				if (c.name === 'juedou') return true;
				if (num && c.name === 'sha') { num--; return true; }
				return false;
			});
			if (!hs.length) return 'zeroplayertarget';
			num = 1 - 2 / 3 / hs.length;
			return [num, 0, num, 0];
		} catch (_) { return original.apply(this, arguments); }
	});
}

/* 谦节只阻止横置，已横置角色仍可被铁索解除。 */
function installQianjie(host) {
	const effect = lib.skill?.drlt_qianjie?.ai?.effect;
	if (!effect || typeof effect.target !== 'function') return;
	host.wrap(effect, 'target', 'drlt_qianjie:effect', original => function (card, player, target) {
		try { if (card?.name === 'tiesuo' && target?.isLinked()) return; } catch (_) {}
		return original.apply(this, arguments);
	});
}
