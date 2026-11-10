import { lib, game, get, _status } from '../policyCore.js?v=41a';
import { registerSkillVeto } from '../skillVetoRegistry.js?v=41a';
import {
	luanjiAllyLethal, luanjiNetTooLow, tianyiLowCompare, tianyiKnownWinTarget, tianyiKnownWinAvailable, jianchuWorthwhile, jianchuDiscardableEquips,
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
		tianyiKnownWinPass: 0,
		tianyiEngineVeto: 0,
		jianchuSkip: 0,
	},
	install,
};

function maxHandNumber(player) {
	let mx = 0;
	for (const card of player.getCards('h')) mx = Math.max(mx, get.number(card));
	return mx;
}

/* 天义已知必胜拼点候选：只使用公开可知信息（getKnownCards 覆盖全部手牌），
 * 不读取对手隐藏牌面。存在已知必胜拼点时，低点数阈值不适用。 */
function tianyiKnownWinCandidates(player) {
	const mx = maxHandNumber(player);
	const candidates = [];
	for (const target of game.filterPlayer()) {
		if (target === player) continue;
		if (!(get.attitude(player, target) < 0)) continue;
		const handCount = target.countCards('h');
		if (handCount <= 0) continue;
		let comparable = true;
		try { comparable = player.canCompare(target); } catch (e) { comparable = false; }
		if (!comparable) continue;
		const known = (target.getKnownCards ? target.getKnownCards(player) : []) || [];
		let knownMax = 0;
		for (const card of known) knownMax = Math.max(knownMax, get.number(card, target));
		candidates.push({ hostile: true, comparable: true, handCount, knownCount: known.length, knownMax });
	}
	return { maxNumber: mx, candidates };
}

/* 乱击：原生只把目标效果压成 sgn。两层校正（与原生补丁 0001 同源）：
 * 1) 队友1血、空手且无防具/护甲/自动闪响应能力时，万箭会直接把他送进濒死，
 *    收益再高也不发动（复用宿主真实减伤/响应判断，不凭空认定必然受伤）；
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
					armorName: (target.getEquip && target.getEquip(2) || {}).name || null,
					hujia: target.hujia || 0,
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
 * 天义3 再锁杀。修正：最大点数不足 10 且不存在已知必胜拼点时，player 侧与
 * target 侧同时归零——get.effect 的合成是 result1×att(self)+result2×att(target)，
 * 负否决会被 attitude 符号翻转（完整引擎缓存上下文中实测 attitude(self) 可为
 * 负，-0.9×(-9)=+8.1），双侧归零对符号免疫，chooseTarget 全负 → 取消+_aiexclude。
 * 点数充足或存在已知必胜拼点时保持原生。与原生补丁 0002 同源。 */
function tianyiGateActive(player, stats) {
	const probe = tianyiKnownWinCandidates(player);
	if (!tianyiLowCompare({ maxNumber: probe.maxNumber })) return false;
	if (tianyiKnownWinAvailable(probe)) {
		stats.tianyiKnownWinPass++;
		return false;
	}
	stats.tianyiDecline++;
	return true;
}

function installTianyi(host, stats) {
	const info = lib.skill && lib.skill.tianyi;
	const result = info && info.ai && info.ai.result;
	/* ai.order 门：宿主 AI 点击技能只看 get.order（ai1=get.cacheOrder），
	 * 引擎候选管线之外的全部提交都由此拦截；order≤0 时技能不进入 AI 出牌序列。
	 * 与原生补丁 0002 同源；不影响人类玩家（ai.order 仅 AI 消费）。 */
	const ai = info && info.ai;
	if (ai && typeof ai.order === 'function') {
		host.wrap(ai, 'order', 'tianyi:ai:order', original => function (name, player) {
			try {
				if (tianyiGateActive(player, stats)) return 0;
			} catch (e) {}
			return original.apply(this, arguments);
		});
	}
	if (!result || typeof result.player !== 'function' || typeof result.target !== 'function') return;
	host.wrap(result, 'player', 'tianyi:result:player', original => function (player) {
		const native = original.apply(this, arguments);
		try {
			if (!(Number(native) > 0)) return native;
			if (tianyiLowCompare({ maxNumber: maxHandNumber(player) })) return 0;
		} catch (e) {}
		return native;
	});
	/* 逐目标绑定：mx<10 时只有"手牌完全已知且已知最大点数更低"的敌人保留
	 * 选择收益（对敌人视角 -1 → effect=+1 胜出）；未知胜率目标归零，
	 * 不能借用其他目标的必胜资格；多敌人时只有必胜对象会被选中。 */
	host.wrap(result, 'target', 'tianyi:result:target', original => function (player, target) {
		const native = original.apply(this, arguments);
		try {
			if (tianyiLowCompare({ maxNumber: maxHandNumber(player) })) {
				const hostile = get.attitude(player, target) < 0;
				const handCount = target.countCards('h');
				let comparable = false;
				try { comparable = player.canCompare(target); } catch (e) { comparable = false; }
				const known = (target.getKnownCards ? target.getKnownCards(player) : []) || [];
				let knownMax = 0;
				for (const card of known) knownMax = Math.max(knownMax, get.number(card, target));
				if (hostile && comparable && tianyiKnownWinTarget({
					maxNumber: maxHandNumber(player), handCount, knownCount: known.length, knownMax,
				})) {
					stats.tianyiKnownWinPass++;
					return -1;
				}
				stats.tianyiDecline++;
				return 0;
			}
		} catch (e) {}
		return native;
	});
	/* 完整引擎接线：引擎主动技能发起走 skillPlayBrain 静态 profile，不读
	 * ai.result.* 的运行时 wrap。把同一天义风险判断注册进共享否决表，
	 * vetoSkill 在静态规则之后查询，保证原生补丁/策略层/完整引擎三层一致。 */
	const unregister = registerSkillVeto('tianyi', function (profile, ctx) {
		try {
			const me = ctx && ctx.me && ctx.me.ref;
			if (!me || typeof me.getCards !== 'function') return null;
			if (!(me.countCards('h', 'sha') > 0)) return null;
			const probe = tianyiKnownWinCandidates(me);
			if (!tianyiLowCompare({ maxNumber: probe.maxNumber })) return null;
			if (tianyiKnownWinAvailable(probe)) return null;
			stats.tianyiEngineVeto++;
			return { veto: true, reason: '天义：手里最大点数' + probe.maxNumber + '，无已知必胜拼点，拼点牌弃置且输后锁杀' };
		} catch (e) { return null; }
	}, 'shenhua_huo');
	if (typeof unregister === 'function') host.addCleanup(unregister);
}

/* 节命：真实宿主固定局面（quality-huo-jieming-self）证实原生已会把补牌目标
 * 评为荀彧自己，空手自补、nogain 降权、敌方负分均已正确，不接管。
 * 驱虎：原生 result.target 的第三方扫描是击杀扫描的超集，任何可借刀击杀的
 * 局面原生本就会发动（quality-huo-quhu-kill 原生真实发动并造成伤害），
 * 不存在可证明的发动缺口，不接管。 */

/* 鞬出：原生对任何敌人都触发。目标没有装备、血量健康且手牌充足时，
 * 弃一张手牌会把这张杀送给目标，接近白给；有装备可拆（附带杀不可响应）、
 * 残血可补刀（无护甲时）或目标仅剩最后一张手牌时才值得发动。
 * 与原生补丁 0003 同源。 */
function installJianchu(host, stats) {
	const info = lib.skill && lib.skill.jianchu;
	if (!info || typeof info.check !== 'function') return;
	host.wrap(info, 'check', 'jianchu:check', original => function (event, player) {
		try {
			const target = event.target;
			const worthwhile = jianchuWorthwhile({
				hostile: get.attitude(player, target) <= 0,
				equips: jianchuDiscardableEquips(target, player),
				hp: target.hp,
				hand: target.countCards('h'),
				hujia: target.hujia || 0,
			});
			if (!worthwhile) {
				stats.jianchuSkip++;
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
