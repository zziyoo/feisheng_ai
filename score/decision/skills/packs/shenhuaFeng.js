import { lib, game, ui, get, _status } from '../policyCore.js?v=41a';
import { shouldBypassQimouCountBlock, kuangguChoice, jushouShouldActivate, shensu1ShouldUse, guhuoShouldBluff, huangtianShouldGive } from '../rules/shenhuaFeng.js?v=41a';

export const pack = {
	id: 'shenhua_feng',
	name: '神话再临·风',
	group: 'shenhua',
	skills: ['qimou', 'xinkuanggu', 'jushou', 'xinshensu', 'xinfu_guhuo', 'huangtian'],
	statsDefaults: { qimouBypass: 0, kuangguRecover: 0, jushouTurned: 0, shensuSkipJudge: 0, shensuCostBlock: 0, guhuoLowHpGuard: 0, huangtianLastShan: 0, guhuoCalls: 0 },
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

/* 曹仁【据守】：已翻面时再次发作会翻回正面，摸三张没有额外回合成本。
 * 原生 check 只比较体力+手牌，遗漏了这一免费情形。 */
function installJushou(host, stats) {
	const info = lib.skill && lib.skill.jushou;
	if (!info || typeof info.check !== 'function') return;
	host.wrap(info, 'check', 'jushou:check', original => function (event, player) {
		const native = original.apply(this, arguments);
		try {
			if (native) return native;
			if (jushouShouldActivate({ hp: player.hp, hand: player.countCards('h'), turned: player.isTurnedOver() })) {
				stats.jushouTurned++;
				return true;
			}
		} catch (e) {}
		return native;
	});
}

/* 夏侯渊【神速1】：原生在手牌<=2时直接放弃，即使判定区的乐/兵粮/闪电
 * 会被跳过。保持其它分支不变，只在“低手牌 + 不良判定 + 正收益目标”时放行。 */
function installShensu(host, stats) {
	const infos = [lib.skill && lib.skill.shensu1, lib.skill && lib.skill.xinshensu_1].filter(info => info && typeof info.cost === 'function');
	for (const info of infos) host.wrap(info, 'cost', 'shensu1:cost', () => async function (event, trigger, player) {
		const check = player.countCards('h') > 2;
		const harmfulJudge = player.hasJudge('lebu') || player.hasJudge('bingliang') || player.hasJudge('shandian');
		event.result = await player.chooseTarget(get.prompt(event.skill), '跳过判定阶段和摸牌阶段，视为对一名其他角色使用一张【杀】', function (card, player2, target) {
			if (player2 == target) return false;
			return player2.canUse({ name: 'sha' }, target, false);
		}).set('check', check).set('ai', function (target) {
			const effect = get.effect(target, { name: 'sha', isCard: true }, player);
			const drawEffect = get.effect(player, { name: 'draw', isCard: true }, player, player);
			const allowed = shensu1ShouldUse({ check, harmfulJudge, effect, drawEffect });
			if (!allowed) {
				if (!check && harmfulJudge && effect > 0) stats.shensuCostBlock++;
				return 0;
			}
			if (!check && harmfulJudge && effect > 0) stats.shensuSkipJudge++;
			return effect;
		}).setHiddenSkill(event.skill).forResult();
	});
}

/* 于吉【蛊惑】：1血时没有真牌仍诈称，被质疑失去1点体力会直接进入濒死。
 * 只在“无真牌 + 1血 + 非濒死”时降低声明分，其它真假/随机分支保持原生。 */
function installGuhuo(host, stats) {
	const info = lib.skill && lib.skill.xinfu_guhuo;
	const check = info && info.chooseButton && info.chooseButton.check;
	if (typeof check !== 'function') return;
	host.wrap(info.chooseButton, 'check', 'guhuo:check', original => function (button) {
		const native = original.apply(this, arguments);
		try {
			stats.guhuoCalls = (stats.guhuoCalls || 0) + 1;
			if (!(Number(native) > 0)) return native;
			const player = _status.event.player;
			const enemyNum = game.countPlayer(function (current) {
				return current != player && !current.hasSkill('chanyuan') && (get.realAttitude || get.attitude)(current, player) < 0;
			});
			const card = { name: button.link[2], nature: button.link[3] };
			const hasTrue = player.hasCard(function (cardx) {
				if (card.name == cardx.name) {
					if (card.name != 'sha') return true;
					return get.is.sameNature(card, cardx);
				}
				return false;
			}, 'hs');
			const expendable = player.countCards('hs', cardx =>
				cardx.name !== 'shan' && cardx.name !== 'tao' && get.value(cardx, player) < 6
			) > 0;
			if (!guhuoShouldBluff({ enemyNum, hasTrue, hp: player.hp, dying: player.isDying(), expendable })) {
				stats.guhuoLowHpGuard++;
				return 0;
			}
		} catch (e) {}
		return native;
	});
}

/* 张角【黄天】：1血只剩最后一张闪时转交，等于把唯一防御交给主公。
 * 按 ui.selected.cards 的实际选牌判断：交闪且无备用闪时否决；交闪电、保留唯一闪时放行。 */
function installHuangtian(host, stats) {
	const info = lib.skill && lib.skill.huangtian2;
	const result = info && info.ai && info.ai.result;
	if (!result || result.target == null) return;
	host.wrap(result, 'target', 'huangtian:target', original => function (player, target, card) {
		const native = typeof original === 'function' ? original.apply(this, arguments) : original;
		try {
			if (!(Number(native) > 0)) return native;
			const selected = (ui.selected && ui.selected.cards) || [];
			const selectedShan = selected.some(item => item && item.name == 'shan');
			const selectedShandian = selected.some(item => item && item.name == 'shandian');
			if (!huangtianShouldGive({
				hp: player.hp,
				handShan: player.countCards('h', 'shan'),
				selectedShan,
				selectedShandian,
				hasSelection: selected.length > 0,
			})) {
				stats.huangtianLastShan++;
				return 0;
			}
		} catch (e) {}
		return native;
	});
}

function install(host, stats) {
	installQimou(host, stats);
	installKuanggu(host, stats);
	installJushou(host, stats);
	installShensu(host, stats);
	installGuhuo(host, stats);
	installHuangtian(host, stats);
}
