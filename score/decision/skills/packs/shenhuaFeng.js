import { lib, get, _status } from '../policyCore.js?v=41a';
import { shouldBypassQimouCountBlock, kuangguChoice } from '../rules/shenhuaFeng.js?v=41a';

export const pack = {
	id: 'shenhua_feng',
	name: '神话再临·风',
	group: 'shenhua',
	skills: ['qimou', 'xinkuanggu'],
	statsDefaults: { qimouBypass: 0, kuangguRecover: 0 },
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
function installQimou(host, stats) {
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

/* 界魏延【狂骨 xinkuanggu】：原生把“手里有足够杀”当成回复前提。
 * 1血且可回复时改为回复；其余分支仍按原生条件选择摸牌或回复。 */
function installKuanggu(host, stats) {
	const info = lib.skill && lib.skill.xinkuanggu;
	if (!info || typeof info.cost !== 'function') return;
	host.wrap(info, 'cost', 'xinkuanggu:cost', () => async function (event, trigger, player) {
		let nativeRecover = false;
		let recoverEffect = 0;
		try {
			recoverEffect = get.recoverEffect(player);
			nativeRecover = player.isDamaged() && recoverEffect > 0 && player.countCards('hs', card => card.name === 'sha' && player.hasValueTarget(card)) >= player.getCardUsable('sha');
		} catch (e) {}
		const choice = kuangguChoice({
			hp: player.hp,
			isDamaged: player.isDamaged(),
			recoverEffect,
			nativeRecover,
		});
		if (choice === 'recover_hp' && !nativeRecover) stats.kuangguRecover++;
		const next = player.chooseDrawRecover('###' + get.prompt(event.skill) + '###摸一张牌或回复1点体力');
		next.set('choice', choice);
		next.set('ai', function () {
			return _status.event.getParent().choice;
		});
		next.set('logSkill', event.skill);
		next.setHiddenSkill(event.skill);
		const { control } = await next.forResult();
		if (control === 'cancel2') return;
		event.result = { bool: true, skill_popup: false };
	});
}

function install(host, stats) {
	installQimou(host, stats);
	installKuanggu(host, stats);
}
