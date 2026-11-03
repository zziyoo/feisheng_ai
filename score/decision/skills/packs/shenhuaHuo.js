import { lib, game, get, _status } from '../policyCore.js?v=41a';
import { luanjiAllyLethal } from '../rules/shenhuaHuo.js?v=41a';

export const pack = {
	id: 'shenhua_huo',
	name: '神话再临·火',
	group: 'shenhua',
	skills: ['luanji'],
	statsDefaults: { luanjiAllyVeto: 0 },
	install,
};

/* 乱击：原生只把目标效果压成 sgn。队友1血空手且无防具时，
 * 万箭会直接把他送进濒死，收益再高也不应发动。 */
function installLuanji(host, stats) {
	const info = lib.skill && lib.skill.luanji;
	if (!info || typeof info.check !== 'function') return;
	host.wrap(info, 'check', 'luanji:check', original => function (card) {
		const native = original.apply(this, arguments);
		try {
			if (!(Number(native) > 0)) return native;
			const player = _status && _status.event && _status.event.player;
			if (!player || typeof player.canUse !== 'function') return native;
			for (const target of game.players) {
				if (!target || target === player || typeof target.isIn !== 'function' || !target.isIn()) continue;
				if (!player.canUse('wanjian', target)) continue;
				if (luanjiAllyLethal({
					ally: get.attitude(player, target) > 0,
					hp: target.hp,
					hand: target.countCards('h'),
					armor: !!(target.getEquip && target.getEquip(2)),
				})) {
					stats.luanjiAllyVeto++;
					return 0;
				}
			}
		} catch (e) {}
		return native;
	});
}

/* 强袭：原生AI会在体力>2且有杀时优先弃武器；真实宿主复现连弩被弃、
 * 之后只能用一张杀。但宿主没有稳定的“选哪张武器”AI入口：给 check 或 ai1
 * 加评分会连丈八也改为保留，属于过度优化，因此本分包不接管，保留原生。 */

/* 双雄：3张手牌时改判定可多一次决斗，但宿主固定局面里决斗可被响应，
 * 并非严格优于摸两张牌；保留原生“手牌>体力或>3”阈值，不接管。 */

function install(host, stats) {
	installLuanji(host, stats);
}
