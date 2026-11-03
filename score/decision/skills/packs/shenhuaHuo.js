import { lib, game, get, _status } from '../policyCore.js?v=41a';
import {
	luanjiAllyLethal, luanjiNetTooLow, tianyiLowCompare, jianchuWorthwhile,
} from '../rules/shenhuaHuo.js?v=41a';

export const pack = {
	id: 'shenhua_huo',
	name: '神话再临·火',
	group: 'shenhua',
	skills: ['luanji', 'tianyi', 'jianchu'],
	statsDefaults: {
		luanjiAllyVeto: 0,
		luanjiNetVeto: 0,
		tianyiDecline: 0,
		jianchuSkip: 0,
	},
	install,
};

/* 乱击：原生只把目标效果压成 sgn。两层校正（与原生补丁 0001 同源）：
 * 1) 队友1血、空手且无防具时，万箭会直接把他送进濒死，收益再高也不发动；
 * 2) 目标面不足5人时原生没有任何净收益门槛，净收益为0甚至为负也会烧两张牌。 */
function installLuanji(host, stats) {
	const info = lib.skill && lib.skill.luanji;
	if (!info || typeof info.check !== 'function') return;
	host.wrap(info, 'check', 'luanji:check', original => function (card) {
		const native = original.apply(this, arguments);
		try {
			if (!(Number(native) > 0)) return native;
			const player = _status && _status.event && _status.event.player;
			if (!player || typeof player.canUse !== 'function') return native;
			const targets = game.filterPlayer(current => player.canUse('wanjian', current));
			for (const target of targets) {
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
			let net = 0;
			for (const target of targets) {
				let eff = get.sgn(get.effect(target, { name: 'wanjian' }, player, player));
				if (target.hp == 1) eff *= 1.5;
				net += eff;
			}
			if (luanjiNetTooLow({ count: targets.length, net, overLimit: !!player.needsToDiscard(-1) })) {
				stats.luanjiNetVeto++;
				return 0;
			}
		} catch (e) {}
		return native;
	});
}

/* 天义：原生只要手里有杀就给 player 侧 0.6，attitude(self)=10 将其放大为
 * 使用决策的主导项，从不评估拼点胜率。拼点双方都倾向出最大点数、拼点牌
 * 置入弃牌堆：手里最大点数不足 10 时大概率拼输，还要白弃一张拼点牌，输掉后
 * 天义3 再锁杀。修正：最大点数不足 10 时 player 侧返回 -0.9（×10 足以压过
 * target 侧），点数充足时保持原生。真实宿主证实仅改 target 侧无法否决发动。
 * 与原生补丁 0002 同源。 */
function installTianyi(host, stats) {
	const info = lib.skill && lib.skill.tianyi;
	const result = info && info.ai && info.ai.result;
	if (!result || typeof result.player !== 'function') return;
	host.wrap(result, 'player', 'tianyi:result:player', original => function (player) {
		const native = original.apply(this, arguments);
		try {
			if (!(Number(native) > 0)) return native;
			let mx = 0;
			for (const card of player.getCards('h')) {
				mx = Math.max(mx, get.number(card));
			}
			if (tianyiLowCompare({ maxNumber: mx })) {
				stats.tianyiDecline++;
				return -0.9;
			}
		} catch (e) {}
		return native;
	});
}

/* 节命：真实宿主固定局面（quality-huo-jieming-self）证实原生已会把补牌目标
 * 评为荀彧自己，空手自补、nogain 降权、敌方负分均已正确，不接管。
 * 驱虎：原生 result.target 的第三方扫描是击杀扫描的超集，任何可借刀击杀的
 * 局面原生本就会发动（quality-huo-quhu-kill 原生真实发动并造成伤害），
 * 不存在可证明的发动缺口，不接管。 */

/* 鞬出：原生对任何敌人都触发。目标没有装备、血量健康且手牌充足时，
 * 弃一张手牌会把这张杀送给目标，接近白给；有装备可拆（附带杀不可响应）、
 * 残血可补刀或目标仅剩最后一张手牌时才值得发动。与原生补丁 0003 同源。 */
function installJianchu(host, stats) {
	const info = lib.skill && lib.skill.jianchu;
	if (!info || typeof info.check !== 'function') return;
	host.wrap(info, 'check', 'jianchu:check', original => function (event, player) {
		try {
			const target = event.target;
			const hostile = get.attitude(player, target) <= 0;
			const worthwhile = jianchuWorthwhile({
				hostile,
				equips: target.countCards('e'),
				hp: target.hp,
				hand: target.countCards('h'),
			});
			if (!worthwhile) {
				if (hostile) stats.jianchuSkip++;
				return false;
			}
		} catch (e) {}
		return original.apply(this, arguments);
	});
}

/* 强袭：原生AI会在体力>2且有杀时优先弃武器；真实宿主复现连弩被弃、
 * 之后只能用一张杀。但宿主没有稳定的“选哪张武器”AI入口：给 check 或 ai1
 * 加评分会连丈八也改为保留，属于过度优化，因此本分包不接管，保留原生。 */

/* 双雄：3张手牌时改判定可多一次决斗，但宿主固定局面里决斗可被响应，
 * 并非严格优于摸两张牌；保留原生“手牌>体力或>3”阈值，不接管。 */

/* 连环/涅槃/火计/看破/八阵/马术/血裔：复核未发现需要接管的明确缺陷，保留原生。 */

function install(host, stats) {
	installLuanji(host, stats);
	installTianyi(host, stats);
	installJianchu(host, stats);
}
