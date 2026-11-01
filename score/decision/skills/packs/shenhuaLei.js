import { lib } from '../policyCore.js?v=41a';
import { olkongshengCostNeedsFix, olkongshengExpansionView } from '../rules/shenhuaLei.js?v=41a';

export const pack = {
	id: 'shenhua_lei',
	name: '神话再临·雷',
	group: 'shenhua',
	skills: ['olkongsheng'],
	statsDefaults: { olkongshengCostCalls: 0, olkongshengCompatible: null },
	install,
};

/* 周妃【箜声·旧版 olkongsheng】成本 AI 的宿主笔误：
 * getExpansions("olkongsheng") 返回数组，直接 + 数字会变成字符串，
 * 导致“是否已到良姻回复阈值”的数量比较失真。
 * 只在这一次 cost 调用期间给返回数组加 valueOf/toString=长度，
 * 不复制宿主技能函数，也不改变数组本身的迭代/取值行为。 */
function install(host, stats) {
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
