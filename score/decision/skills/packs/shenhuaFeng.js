import { lib, get } from '../policyCore.js?v=41a';
import { shouldBypassQimouCountBlock } from '../rules/shenhuaFeng.js?v=41a';

export const pack = {
	id: 'shenhua_feng',
	name: '神话再临·风',
	group: 'shenhua',
	skills: ['qimou'],
	statsDefaults: { qimouBypass: 0 },
	install,
};

function qimouTargets(host, player, shaCard) {
	return host.aliveOthers(player).map(target => {
		let record = null;
		try {
			record = {
				currentlyInRange: !!player.canUse(shaCard, target),
				canUseIgnoringDistance: !!player.canUse(shaCard, target, false),
				effect: get.effect(target, shaCard, player, player),
				attackDistance: get.distance(player, target, 'attack'),
				hp: target.hp,
			};
		} catch (e) { record = null; }
		return record;
	}).filter(Boolean);
}

/* 界魏延【奇谋 qimou】：杀次数未用完时原生直接否决，即使目标在射程外。
 * 只放宽这一条阻塞：其余原生条件与“支付兑换成击杀”必须成立。 */
function install(host, stats) {
	const info = lib.skill && lib.skill.qimou;
	const result = info && info.ai && info.ai.result;
	if (!result || typeof result.player !== 'function') return;
	host.wrap(result, 'player', 'qimou:result', original => function (player) {
		const native = original.apply(this, arguments);
		try {
			if (Number(native) > 0) return native;
			const shas = player.getCards('h', 'sha');
			const shaCount = shas.length;
			if (!shaCount) return native;
			const shaCard = shas[0];
			const cardEnabled = lib.filter.cardEnabled(shaCard, player);
			const cardUsable = lib.filter.cardUsable(shaCard, player);
			if (!cardEnabled || !cardUsable) return native;
			const bypass = shouldBypassQimouCountBlock({
				nativeResult: native, hp: player.hp, shaCount, cardEnabled, cardUsable,
				targets: qimouTargets(host, player, shaCard),
			});
			if (bypass) {
				stats.qimouBypass++;
				return 1;
			}
		} catch (e) {}
		return native;
	});
}
