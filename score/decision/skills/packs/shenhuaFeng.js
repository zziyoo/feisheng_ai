import { lib, game, ui, get, _status } from '../policyCore.js?v=42a';
import {
	shouldBypassQimouCountBlock, qimouMinimalPayment, kuangguChoice, jushouShouldActivate,
	shensu1ShouldUse, shensu4ShouldUse, guhuoMaterialScore, retianxiangOptionIndex,
	huangtianTargetScore, buquDamageFactor,
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
		retianxiangJoint: 0, liegongDrawUnlock: 0, liegongExtra: 0, qimouMinPay: 0, buquProbModel: 0,
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
 * 本轮新增：content 支付最小化——能在更低档位形成有效打击时不多付体力。 */
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
	if (info && typeof info.content === 'function') {
		host.wrap(info, 'content', 'qimou:content', () => async function (event, trigger, player) {
			const shas = player.getCards('h', 'sha');
			const shaCard = shas[0] || { name: 'sha' };
			let num;
			if (player.hp >= 4 && shas.length >= 3) {
				num = 3;
			} else if (player.hp >= 3 && shas.length >= 2) {
				num = 2;
			} else {
				num = 1;
			}
			const targets = [];
			for (const current of host.aliveOthers(player)) {
				try {
					if (get.attitude(player, current) >= 0) continue;
					targets.push({
						currentlyInRange: !!player.canUse(shaCard, current),
						canUseIgnoringDistance: !!player.canUse(shaCard, current, false),
						effect: get.effect(current, shaCard, player, player),
						attackDistance: get.distance(player, current, 'attack'),
						hp: current.hp,
					});
				} catch (e) {}
			}
			const minTier = qimouMinimalPayment({
				tier: num,
				baseUsable: player.getCardUsable('sha'),
				shaCount: shas.length,
				hp: player.hp,
				targets,
			});
			if (minTier < num) {
				stats.qimouMinPay++;
				num = minTier;
			}
			const map = {};
			const list = [];
			for (let i2 = 1; i2 <= player.hp; i2++) {
				const cn = get.cnNumber(i2, true);
				map[cn] = i2;
				list.push(cn);
			}
			player.awakenSkill(event.name);
			player.storage.qimou = true;
			const control = await player.chooseControl(list, function () {
				return get.cnNumber(_status.event.goon, true);
			}).set('prompt', '失去任意点体力').set('goon', num).forResult();
			num = map[control.control] || 1;
			player.storage.qimou2 = num;
			player.addTempSkill('qimou2');
			await player.loseHp(num);
		});
	}
}

/* 界魏延【狂骨 xinkuanggu】：hp<=1 回复；杀充足回复（原生保留）；
 * 2血无桃储备回复；其余摸牌。与原生 cost 嵌套条件一致。 */
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
		const taoCount = player.countCards('hs', 'tao');
		const choice = kuangguChoice({
			hp: player.hp,
			isDamaged: player.isDamaged(),
			recoverEffect,
			shaReady,
			shaUsable,
			taoCount,
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

/* 曹仁【据守】：已翻面免费摸三张；未翻面时 1血且攻击范围内有持牌敌人则不发动。
 * 与原生 check 的完整逻辑一致。 */
function installJushou(host, stats) {
	const info = lib.skill && lib.skill.jushou;
	if (!info || typeof info.check !== 'function') return;
	host.wrap(info, 'check', 'jushou:check', original => function (event, player) {
		const native = original.apply(this, arguments);
		try {
			if (native) return native;
			const turned = player.isTurnedOver();
			const threat = player.hp <= 1 && game.hasPlayer(function (current) {
				return get.attitude(player, current) < 0 && current.countCards('hs') > 0 && current.inRange(player);
			});
			if (jushouShouldActivate({ hp: player.hp, hand: player.countCards('h'), turned, threat })) {
				if (turned) stats.jushouTurned++;
				return true;
			}
			if (!turned && threat && player.hp + player.countCards('h') < 4) {
				stats.jushouThreatHold++;
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

/* 夏侯渊【神速2/4】（本轮新增接管）：神速2 低体力不弃防具；
 * 神速4 弃牌分支只在低体力保命、被乐压制或可收割濒死敌人时放行。 */
function installShensu24(host, stats) {
	const shensu2 = lib.skill && lib.skill.shensu2;
	if (shensu2 && typeof shensu2.cost === 'function') {
		host.wrap(shensu2, 'cost', 'shensu2:cost', () => async function (event, trigger, player) {
			event.result = await player.chooseCardTarget({
				prompt: get.prompt(event.skill),
				prompt2: '弃置一张装备牌并跳过出牌阶段，视为对一名其他角色使用一张【杀】',
				filterCard(card, player2) {
					return get.type(card) == 'equip' && lib.filter.cardDiscardable(card, player2);
				},
				position: 'he',
				filterTarget(card, player2, target) {
					if (player2 == target) return false;
					return player2.canUse({ name: 'sha' }, target, false);
				},
				ai1(card) {
					if (_status.event.check) return 0;
					if (_status.event.player.hp <= 2 && get.subtype(card) == 'equip2') {
						stats.shensu2ArmorKeep++;
						return -3;
					}
					return 6 - get.value(card);
				},
				ai2(target) {
					if (_status.event.check) return 0;
					return get.effect(target, { name: 'sha' }, _status.event.player);
				},
				check: player.countCards('hs', i2 => player.hasValueTarget(i2, null, true)) > player.hp - 1,
			}).setHiddenSkill(event.skill).forResult();
		});
	}
	const xinshensu2 = lib.skill && lib.skill.xinshensu_2;
	if (xinshensu2 && typeof xinshensu2.cost === 'function' && xinshensu2.cost !== (shensu2 && shensu2.cost)) {
		host.wrap(xinshensu2, 'cost', 'shensu2:cost-xin', () => async function (event, trigger, player) {
			event.result = await player.chooseCardTarget({
				prompt: get.prompt(event.skill),
				prompt2: '弃置一张装备牌并跳过出牌阶段，视为对一名其他角色使用一张【杀】',
				filterCard(card, player2) {
					return get.type(card) == 'equip' && lib.filter.cardDiscardable(card, player2);
				},
				position: 'he',
				filterTarget(card, player2, target) {
					if (player2 == target) return false;
					return player2.canUse({ name: 'sha' }, target, false);
				},
				ai1(card) {
					if (_status.event.check) return 0;
					if (_status.event.player.hp <= 2 && get.subtype(card) == 'equip2') return -3;
					return 6 - get.value(card);
				},
				ai2(target) {
					if (_status.event.check) return 0;
					return get.effect(target, { name: 'sha' }, _status.event.player);
				},
				check: player.countCards('hs', i2 => player.hasValueTarget(i2, null, true)) > player.hp - 1,
			}).setHiddenSkill(event.skill).forResult();
		});
	}
	const shensu4 = lib.skill && lib.skill.shensu4;
	if (shensu4 && typeof shensu4.cost === 'function') {
		host.wrap(shensu4, 'cost', 'shensu4:cost', () => async function (event, trigger, player) {
			const killTarget = game.hasPlayer(function (current) {
				return current != player && get.attitude(player, current) < 0 && current.hp <= 1 && player.canUse({ name: 'sha' }, current, false) && get.effect(current, { name: 'sha' }, player, player) > 0;
			});
			const check = shensu4ShouldUse({
				turned: player.isTurnedOver(),
				shebianCanMove: player.hasSkill('shebian') && player.canMoveCard(true, true),
				needDiscard: player.needsToDiscard(),
				hp: player.hp,
				hasLebu: player.hasJudge('lebu'),
				killTarget,
			});
			event.result = await player.chooseTarget(get.prompt(event.skill), '跳过弃牌阶段并将武将牌翻面，视为对一名其他角色使用一张【杀】', function (card, player2, target) {
				if (player2 == target) return false;
				return player2.canUse({ name: 'sha' }, target, false);
			}).set('check', check).set('ai', function (target) {
				if (!_status.event.check) {
					if (player.needsToDiscard() > 0) stats.shensu4Restrict++;
					return 0;
				}
				return get.effect(target, { name: 'sha' }, _status.event.player, _status.event.player);
			}).setHiddenSkill(event.skill).forResult();
		});
	}
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

/* 张角【黄天】：1-2血交牌者选中最后一张闪时，仅主公濒死保留正分2，其余否决。
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
				targetHp: target && target.hp,
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
 * 1. 候选牌按判定者视角评估花色（红颜修正），避免对红颜角色误判黑桃牌；
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
			let cardForJudge = card;
			try {
				if (get.suit(card, trigger2.player) != card.suit) {
					cardForJudge = { suit: get.suit(card, trigger2.player), number: get.number(card), name: card.name };
					stats.guidaoHongyanFix++;
				}
			} catch (e) {}
			const result = trigger2.judge(cardForJudge) - trigger2.judge(judging);
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
			if (target.hasSkill('hongyan')) return 0;
			const player2 = _status.event.player;
			const eff = get.damageEffect(target, player2, player2, 'thunder');
			let recoverEff = 0;
			try {
				recoverEff = player2.isDamaged() ? get.recoverEffect(player2, player2, player2) : 0;
			} catch (e) {}
			stats.releijiWeighted++;
			return eff * 0.75 + recoverEff * 0.25;
		};
		event.result = await next.forResult();
	});
}

/* 小乔【天香 retianxiang】（本轮新增接管）：目标选择按两种后续处理方式
 * 联合评分（伤害+摸牌 / 失去体力+赠牌），取较优者；结算 AI 修复对卖血
 * 敌人喂伤害的反向缺陷。保留真实伤害与失去体力的规则区别。 */
function retianxiangOptions(target, source, card, player2) {
	const att = get.attitude(player2, target);
	const eff1 = get.damageEffect(target, source, player2)
		+ get.effect(target, { name: 'draw' }, player2, player2) * Math.min(5, target.getDamagedHp() + 1);
	const eff2 = get.effect(target, { name: 'losehp' }, target, player2)
		+ (card ? get.value(card, target) : 0) * att / 10;
	return [eff1, eff2];
}

function installRetianxiang(host, stats) {
	const info = lib.skill && lib.skill.retianxiang;
	if (!info) return;
	if (typeof info.cost === 'function') {
		host.wrap(info, 'cost', 'retianxiang:cost', () => async function (event, trigger, player) {
			event.result = await player.chooseCardTarget({
				filterCard(card, player2) {
					return get.suit(card) == 'heart' && lib.filter.cardDiscardable(card, player2);
				},
				filterTarget(card, player2, target) {
					return player2 != target;
				},
				ai1(card) {
					return 10 - get.value(card);
				},
				ai2(target) {
					const player2 = _status.event.player;
					const trigger2 = _status.event.getTrigger();
					const att = get.attitude(player2, target);
					const da = player2.hp == 1 ? 10 : 0;
					if (att == 0) return 0.1 + da;
					const source = (trigger2 && trigger2.source) || 'nosource';
					const card = (ui.selected.cards && ui.selected.cards[0]) || null;
					if (att > 0) {
						if (target.hp <= 1) {
							return card && card.name == 'tao' ? 2 + da : -att + da;
						}
						if (target.hasSkillTag('maihp')) return att + da;
					}
					const [eff1, eff2] = retianxiangOptions(target, source, card, player2);
					stats.retianxiangJoint++;
					if (att > 0) return Math.max(eff1, eff2) + da;
					return Math.max(eff1, eff2) - (target.hasSkillTag('maihp') ? 3 : 0) + da;
				},
				prompt: get.prompt(event.skill),
				prompt2: lib.translate[`${event.skill}_info`],
			}).setHiddenSkill(event.name.slice(0, -5)).forResult();
		});
	}
	if (typeof info.content === 'function') {
		host.wrap(info, 'content', 'retianxiang:content', () => async function (event, trigger, player) {
			const [target] = event.targets;
			const [card] = event.cards;
			trigger.cancel();
			await player.discard(event.cards);
			const result = await player.chooseControlList(
				true,
				function (event2, player2) {
					const target2 = _status.event.target;
					const att = get.attitude(player2, target2);
					if (att == 0) return 0;
					const tx = event2.getParent();
					const trigger2 = tx && tx.getTrigger ? tx.getTrigger() : null;
					const source = (trigger2 && trigger2.source) || 'nosource';
					const card2 = tx && tx.cards && tx.cards[0];
					if (att > 0) {
						if (target2.hasSkillTag('maihp')) return 0;
						if (target2.hp <= 1) return 1;
					} else if (target2.hasSkillTag('maihp')) {
						return 1;
					}
					const [eff1, eff2] = retianxiangOptions(target2, source, card2, player2);
					const index = retianxiangOptionIndex(eff1, eff2);
					return index < 0 ? 0 : index;
				},
				['令' + get.translation(target) + '受到伤害来源对其造成的1点伤害，然后摸X张牌（X为其已损失体力值且至多为5）', '令' + get.translation(target) + '失去1点体力，然后获得' + get.translation(event.cards)]
			).set('target', target).forResult();
			if (typeof result.index != 'number') return;
			if (result.index) {
				event.related = target.loseHp();
			} else {
				event.related = target.damage(trigger.source || 'nosource', 'nocard');
			}
			await event.related;
			if (result.index && card.isInPile()) {
				await target.gain(card, 'gain2');
			} else if (target.getDamagedHp()) {
				await target.draw(Math.min(5, target.getDamagedHp()));
			}
		});
	}
}

/* 黄忠【烈弓 xinliegong】（本轮新增接管）：aiOrder 的摸牌加速只在“摸牌能
 * 解锁烈弓不可响应条件”时生效；新增 effect.player 钩子把加伤收益
 * 计入对体力不低于黄忠的敌人的杀评分。 */
function installLiegong(host, stats) {
	const info = lib.skill && lib.skill.xinliegong;
	if (!info) return;
	if (info.mod && typeof info.mod.aiOrder === 'function') {
		host.wrap(info.mod, 'aiOrder', 'liegong:aiOrder', original => function (player, card, num) {
			try {
				if (num > 0 && card && card.name === 'sha') return num + 6;
				if (num > 0 && card && get.tag(card, 'draw') && player.countCards('h', 'sha') > 0 && game.hasPlayer(function (current) {
					return get.attitude(player, current) < 0 && current.countCards('h') > player.countCards('h') && current.countCards('h') <= player.countCards('h') + 2 && player.inRange(current);
				})) {
					stats.liegongDrawUnlock++;
					return num + 7;
				}
			} catch (e) {}
			return original.apply(this, arguments);
		});
	}
	if (info.ai) {
		let addedEffect = false;
		let addedPlayer = false;
		if (!info.ai.effect) {
			info.ai.effect = {};
			addedEffect = true;
		}
		if (!info.ai.effect.player) {
			info.ai.effect.player = function (card, player, target) {
				try {
					if (card && card.name == 'sha' && target && get.attitude(player, target) < 0 && target.hp >= player.hp && target.hp > 1) {
						stats.liegongExtra++;
						return [1, 0, 1.5, 0];
					}
				} catch (e) {}
			};
			addedPlayer = true;
			host.addCleanup(() => {
				try {
					if (info.ai.effect) {
						delete info.ai.effect.player;
						if (addedEffect && !Object.keys(info.ai.effect).length) delete info.ai.effect;
					}
				} catch (e) {}
			});
		}
	}
}

/* 周泰【不屈 gzbuqu】（本轮新增接管）：伤害价值＝下一张“创”与现存点数
 * 重复的公开信息概率＋压制价值。只统计公开区（弃牌堆、装备/判定区、创自身），
 * 不读取手牌与牌堆内部。恢复选牌本身选项等价，不伪造差异。 */
function installBuqu(host, stats) {
	const info = lib.skill && lib.skill.gzbuqu;
	const effect = info && info.ai && info.ai.effect;
	if (!effect || typeof effect.target !== 'function') return;
	host.wrap(effect, 'target', 'buqu:effectTarget', original => function (card, player, target) {
		try {
			if (card && target && (get.tag(card, 'damage') || get.tag(card, 'loseHp'))) {
				const creations = target.getExpansions('gzbuqu');
				const outCount = {};
				const countOut = function (cards) {
					for (const card2 of cards) {
						const num = get.number(card2);
						if (typeof num == 'number') outCount[num] = (outCount[num] || 0) + 1;
					}
				};
				countOut(Array.from(ui.discardPile.childNodes));
				game.players.concat(game.dead).forEach(function (current) {
					countOut(current.getCards('ej'));
				});
				countOut(creations);
				stats.buquProbModel++;
				return buquDamageFactor({
					creations: creations.map(function (card2) { return get.number(card2); }),
					outCount,
					hp: target.hp,
				});
			}
		} catch (e) {}
		return original.apply(this, arguments);
	});
}

function install(host, stats) {
	installQimou(host, stats);
	installKuanggu(host, stats);
	installJushou(host, stats);
	installShensu(host, stats);
	installShensu24(host, stats);
	installGuhuo(host, stats);
	installHuangtian(host, stats);
	installGuidao(host, stats);
	installReleiji(host, stats);
	installRetianxiang(host, stats);
	installLiegong(host, stats);
	installBuqu(host, stats);
}
