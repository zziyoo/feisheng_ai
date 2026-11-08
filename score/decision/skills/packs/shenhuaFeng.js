import { lib, game, ui, get, _status } from '../policyCore.js?v=42a';
import {
	shouldBypassQimouCountBlock, kuangguChoice, jushouShouldActivate,
	shensu1ShouldUse, guhuoMaterialScore,
	huangtianTargetScore,
} from '../rules/shenhuaFeng.js?v=42a';

export const pack = {
	id: 'shenhua_feng',
	name: '神话再临·风',
	group: 'shenhua',
	skills: ['qimou', 'xinkuanggu', 'jushou', 'xinshensu', 'xinfu_guhuo', 'huangtian', 'guidao', 'releiji', 'retianxiang', 'xinliegong', 'gzbuqu'],
	statsDefaults: {
		qimouBypass: 0, kuangguRecover: 0, kuangguHp2: 0, jushouTurned: 0, jushouThreatHold: 0,
		shensuSkipJudge: 0, shensuCostBlock: 0, shensu4Restrict: 0, shensu2ArmorKeep: 0, guhuoLowHpGuard: 0, guhuoMaterialGate: 0,
		huangtianLastShan: 0, guhuoCalls: 0, guidaoHongyanFix: 0, releijiWeighted: 0,
		retianxiangJoint: 0, liegongDrawUnlock: 0, liegongExtra: 0, qimouMinPay: 0, buquHeuristic: 0,
	},
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
 * 只放宽这一条阻塞：其余原生条件与“支付兑换成击杀”必须成立。
 * 支付档位沿用宿主，避免忽略多目标连续攻击。 */
function installQimou(host, stats) {
	const info = lib.skill && lib.skill.qimou;
	const result = info && info.ai && info.ai.result;
	if (result && typeof result.player === 'function') {
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
}

/* 界魏延【狂骨 xinkuanggu】：hp<=1 回复；杀充足回复（原生保留）；
 * 其余摸牌。与原生 cost 嵌套条件一致。 */
function installKuanggu(host, stats) {
	const info = lib.skill && lib.skill.xinkuanggu;
	if (!info || typeof info.cost !== 'function') return;
	host.wrap(info, 'cost', 'xinkuanggu:cost', () => async function (event, trigger, player) {
		let recoverEffect = 0;
		try {
			recoverEffect = get.recoverEffect(player);
		} catch (e) {}
		const shaReady = player.countCards('hs', card => card.name === 'sha' && player.hasValueTarget(card));
		const shaUsable = player.getCardUsable('sha');
		const choice = kuangguChoice({
			hp: player.hp,
			isDamaged: player.isDamaged(),
			recoverEffect,
			shaReady,
			shaUsable,
		});
		if (choice === 'recover_hp' && player.hp > 1 && !(shaUsable > 0 && shaReady >= shaUsable)) {
			stats.kuangguHp2++;
		}
		if (choice === 'recover_hp' && player.hp <= 1 && !(shaUsable > 0 && shaReady >= shaUsable)) {
			stats.kuangguRecover++;
		}
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

/* 曹仁【据守】：翻回正面；其他情况保留原生阈值。 */
function installJushou(host, stats) {
	const info = lib.skill && lib.skill.jushou;
	if (!info || typeof info.check !== 'function') return;
	host.wrap(info, 'check', 'jushou:check', original => function (event, player) {
		const native = original.apply(this, arguments);
		try {
			const turned = player.isTurnedOver();
			if (jushouShouldActivate({ hp: player.hp, hand: player.countCards('h'), turned })) {
				if (turned) stats.jushouTurned++;
				return true;
			}
		} catch (e) {}
		return native;
	});
}

/* 夏侯渊【神速1】：原生在手牌<=2时直接放弃，即使判定区的乐/兵粮/闪电
 * 会被跳过。保持其它分支不变，只在“低手牌 + 不良判定 + 正收益目标”时放行。 */
function installShensu(host, stats) {
	const infos = [lib.skill && lib.skill.shensu1, lib.skill && lib.skill.xinshensu_1].filter(info2 => info2 && typeof info2.cost === 'function');
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

/* 于吉【蛊惑】：宿主 1.11.7 的假牌被质疑时“此牌作废”，不直接失去体力；
 * 1血无真牌仍诈称的风险是损失扣置的防御牌。声明评分守卫保持前轮结论；
 * 本轮新增：扣置材料从 50% 随机改为确定性价值门槛（真牌恒优先）。 */
function installGuhuo(host, stats) {
	const info = lib.skill && lib.skill.xinfu_guhuo;
	const check = info && info.chooseButton && info.chooseButton.check;
	if (typeof check === 'function') {
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
	const backup = info && info.chooseButton && info.chooseButton.backup;
	if (typeof backup === 'function') {
		host.wrap(info.chooseButton, 'backup', 'guhuo:backup', original => function (links, player) {
			const backupInfo = original.call(this, links, player);
			try {
				if (backupInfo && typeof backupInfo.ai1 === 'function') {
					const originalAi1 = backupInfo.ai1;
					backupInfo.ai1 = function (card) {
						try {
							const player2 = _status.event.player;
							const enemyNum = game.countPlayer(function (current) {
								return current != player2 && !current.hasSkill('chanyuan') && (get.realAttitude || get.attitude)(current, player2) < 0;
							});
							if (enemyNum) {
								const cardx = lib.skill.xinfu_guhuo_backup.viewAs;
								const isTrueCard = card.name == cardx.name && (card.name != 'sha' || get.is.sameNature(card, cardx));
								const score = guhuoMaterialScore({
									isTrueCard,
									materialValue: get.value(card, player2),
									isDying: player2.isDying(),
									hp: player2.hp,
									cardName: card.name,
								});
								if (!isTrueCard && score === 0) stats.guhuoMaterialGate++;
								return score;
							}
						} catch (e) {}
						return originalAi1.apply(this, arguments);
					};
				}
			} catch (e) {}
			return backupInfo;
		});
	}
}

/* 蛊惑声明守卫（前轮结论保留）：1血无真牌且没有可弃低价值牌时不诈称。 */
function guhuoShouldBluff(input) {
	const { enemyNum, hasTrue, hp, dying, expendable } = input || {};
	if (!(Number(enemyNum) > 0)) return true;
	if (hasTrue) return true;
	if (!(Number(hp) <= 1) || dying) return true;
	return !!expendable;
}

/* 张角【黄天】：1-2血交牌者选中最后一张闪时保守保留。
 * 与原生 result.target 的完整逻辑一致。 */
function installHuangtian(host, stats) {
	const info = lib.skill && lib.skill.huangtian2;
	const result = info && info.ai && info.ai.result;
	if (!result || result.target == null) return;
	host.wrap(result, 'target', 'huangtian:target', original => function (player, target, card) {
		const native = typeof original === 'function' ? original.apply(this, arguments) : original;
		try {
			if (!(Number(native) > 0)) return native;
			const selected = (ui.selected && ui.selected.cards) || [];
			const score = huangtianTargetScore({
				hp: player.hp,
				handShan: player.countCards('h', 'shan'),
				selectedShan: selected.some(item => item && item.name == 'shan'),
				selectedShandian: selected.some(item => item && item.name == 'shandian'),
				hasSelection: selected.length > 0,
			});
			if (score !== null) {
				if (score === 0) stats.huangtianLastShan++;
				return score;
			}
		} catch (e) {}
		return native;
	});
}

/* 张角【鬼道 guidao】（本轮新增接管）：评分三项修正——
 * 1. 候选牌两种视角花色不同时保守放弃，避免残缺伪牌或花色误判；
 * 2. 改判后原判定牌进入手牌，按同样折算计入收益；
 * 3. 低体力的最后一张闪防御价值加倍。 */
function installGuidao(host, stats) {
	const info = lib.skill && lib.skill.guidao;
	if (!info || typeof info.cost !== 'function') return;
	host.wrap(info, 'cost', 'guidao:cost', () => async function (event, trigger, player) {
		event.result = await player.chooseCard(`${get.translation(trigger.player)}的${trigger.judgestr || ''}判定为${get.translation(trigger.player.judging[0])}，${get.prompt(event.skill)}`, 'hes', (card) => {
			const player2 = get.player();
			if (get.color(card) !== 'black') return false;
			const mod2 = game.checkMod(card, player2, 'unchanged', 'cardEnabled2', player2);
			if (mod2 != 'unchanged') return mod2;
			const mod = game.checkMod(card, player2, 'unchanged', 'cardRespondable', player2);
			if (mod != 'unchanged') return mod;
			return true;
		}).set('ai', (card) => {
			const trigger2 = get.event().getTrigger();
			const { player: player2, judging } = get.event();
			try {
				if (get.suit(card, trigger2.player) != get.suit(card)) {
					stats.guidaoHongyanFix++;
					return 0;
				}
			} catch (e) {}
			const result = trigger2.judge(card) - trigger2.judge(judging);
			const attitude = get.attitude(player2, trigger2.player);
			let val = get.value(card, player2);
			if (card.name == 'shan' && player2.hp <= 2 && player2.countCards('h', 'shan') <= 1) {
				val *= 2;
			}
			if (get.subtype(card) == 'equip2') {
				val /= 2;
			} else {
				val /= 6;
			}
			if (attitude == 0 || result == 0) return 0;
			const gained = get.value(judging, player2) / 6;
			if (attitude > 0) return result - val + gained;
			return -result - val + gained;
		}).set('judging', trigger.player.judging[0]).forResult();
	});
}

/* 张角【雷击 releiji】（本轮新增接管）：判定花色按牌堆自然分布加权——
 * 黑桃约1/4造成2点、梅花约1/4造成1点并回复；其余花色无效果。
 * 张角受伤时回复价值进入目标选择。 */
function installReleiji(host, stats) {
	const info = lib.skill && lib.skill.releiji;
	if (!info || typeof info.cost !== 'function') return;
	host.wrap(info, 'cost', 'releiji:cost', () => async function (event, trigger, player) {
		const next = player.chooseTarget(get.prompt2(event.skill), function (card, player2, target) {
			return target != player2;
		});
		next.ai = function (target) {
			const player2 = _status.event.player;
			const eff = get.damageEffect(target, player2, player2, 'thunder');
			let recoverEff = 0;
			try {
				recoverEff = player2.isDamaged() ? get.recoverEffect(player2, player2, player2) : 0;
			} catch (e) {}
			stats.releijiWeighted++;
			return eff * (target.hasSkill('hongyan') ? 0.25 : 0.75) + recoverEff * 0.25;
		};
		event.result = await next.forResult();
	});
}

/* 仅在实体无中生有净增手牌能够翻转实体杀的不可响应条件时提前。 */
function installLiegong(host, stats) {
	const mod = lib.skill && lib.skill.xinliegong && lib.skill.xinliegong.mod;
	if (!mod || typeof mod.aiOrder !== 'function') return;
	host.wrap(mod, 'aiOrder', 'liegong:aiOrder', original => function (player, card, num) {
		try {
			if (num > 0 && card && card.name === 'wuzhong' && get.tag(card, 'draw') === 2 && player.getCardUsable('sha') > 0 && player.getCards('h').includes(card)) {
				const hand = player.countCards('h');
				if (player.getCards('h', 'sha').some(sha => game.hasPlayer(target =>
					target != player && get.attitude(player, target) < 0 && target.countCards('h') === hand && player.canUse(sha, target) && get.effect(target, sha, player, player) > 0
				))) {
					stats.liegongDrawUnlock++;
					return num + 7;
				}
			}
		} catch (e) {}
		return original.apply(this, arguments);
	});
}

/* 基于公开创点数的拥挤度启发式，不推断牌堆组成或顺序。 */
function installBuqu(host, stats) {
	const effect = lib.skill && lib.skill.gzbuqu && lib.skill.gzbuqu.ai && lib.skill.gzbuqu.ai.effect;
	if (!effect || typeof effect.target !== 'function') return;
	host.wrap(effect, 'target', 'buqu:effectTarget', original => function (card, player, target) {
		try {
			const damage = get.tag(card, 'damage');
			const loss = get.tag(card, 'loseHp');
			if (!(damage || loss)) return original.apply(this, arguments);
			const amount = Math.max(Number(damage) || 0, Number(loss) || 0);
			const hp = Number(target.hp);
			if (!Number.isInteger(amount) || amount <= 0 || !Number.isInteger(hp) || target.hujia > 0) return original.apply(this, arguments);
			const ranks = target.getExpansions('gzbuqu').map(card2 => get.number(card2));
			if (ranks.some(n => !Number.isInteger(n) || n < 1 || n > 13)) return original.apply(this, arguments);
			const unique = new Set(ranks).size;
			if (unique !== ranks.length) return 1;
			const added = Math.min(amount, Math.max(0, amount - Math.max(0, hp - 1)));
			if (!added) return 1;
			const risk = Math.min(0.9, 0.2 + (unique + added - 1) / 13);
			stats.buquHeuristic++;
			return (amount - added + added * risk) / amount;
		} catch (e) { return original.apply(this, arguments); }
	});
}

function install(host, stats) {
	installQimou(host, stats);
	installKuanggu(host, stats);
	installJushou(host, stats);
	installShensu(host, stats);
	installGuhuo(host, stats);
	installHuangtian(host, stats);
	installGuidao(host, stats);
	installReleiji(host, stats);
	installLiegong(host, stats);
	installBuqu(host, stats);
}
