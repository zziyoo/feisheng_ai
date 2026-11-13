import { lib, game, get } from '../policyCore.js?v=41a';
import { olkongshengCostNeedsFix, olkongshengExpansionView, xiongluanTargetNeedsFix, zhenguCostNeedsFix, zhenguImmediateDelta } from '../rules/shenhuaLei.js?v=41a';

export const pack = {
	id: 'shenhua_lei',
	name: '神话再临·雷',
	group: 'shenhua',
	skills: ['olkongsheng', 'xinfu_fuyin', 'drlt_qianjie', 'drlt_zhengu', 'drlt_xiongluan', 'xinfu_zuilun', 'twjuxiang'],
	statsDefaults: { olkongshengCostCalls: 0, olkongshengCompatible: null, zhenguCompatible: null, zhenguEngineHook: null, zhenguScoreCalls: 0, zhenguFallbacks: 0, zhenguHookConflict: 0 },
	install,
};

/* 周妃【箜声·旧版 olkongsheng】成本 AI 的宿主笔误：
 * getExpansions("olkongsheng") 返回数组，直接 + 数字会变成字符串，
 * 导致“是否已到良姻回复阈值”的数量比较失真。
 * 只在这一次 cost 调用期间给返回数组加 valueOf/toString=长度，
 * 不复制宿主技能函数，也不改变数组本身的迭代/取值行为。 */
const olkongshengScopes = new WeakMap();

function install(host, stats) {
	installFuyin(host);
	installQianjie(host);
	installZhengu(host, stats);
	installXiongluan(host);
	installZuilun(host);
	installJuxiang(host);
	const info = lib.skill && lib.skill.olkongsheng;
	if (!info || typeof info.cost !== 'function') return;
	const original = info.cost;
	stats.olkongshengCompatible = olkongshengCostNeedsFix(String(original));
	if (!stats.olkongshengCompatible) {
		try { console.warn('[无名AI·技能策略] olkongsheng.cost 形态已变化，跳过箜声数量修正'); } catch (e) {}
		return;
	}
	host.wrap(info, 'cost', 'olkongsheng:cost', originalCost => async function (event, trigger, player) {
		let scope = olkongshengScopes.get(player);
		if (scope && player.getExpansions === scope.wrapped) {
			scope.active++;
		} else {
			const original = player.getExpansions;
			scope = null;
			if (typeof original === 'function' && !olkongshengScopes.has(player)) {
				const wrapped = function (name) {
					const result = original.apply(this, arguments);
					return name === 'olkongsheng' && Array.isArray(result) ? olkongshengExpansionView(result) : result;
				};
				scope = { original, wrapped, active: 1 };
				player.getExpansions = wrapped;
				olkongshengScopes.set(player, scope);
			}
		}
		try {
			stats.olkongshengCostCalls++;
			return await originalCost.apply(this, arguments);
		} finally {
			if (scope && --scope.active === 0) {
				if (player.getExpansions === scope.wrapped) player.getExpansions = scope.original;
				if (olkongshengScopes.get(player) === scope) olkongshengScopes.delete(player);
			}
		}
	});
}

/* 一血空手者失去最后一件防具会暴露于敌方攻击。保留常规送装和复栏决策。 */
function installJuxiang(host) {
	const skill = lib.skill?.twjuxiang_global;
	if (typeof skill?.check !== 'function' || Function.prototype.toString.call(skill.check).replace(/\s+/g, '') !== 'check(card){returnget.value(card);}') return;
	host.wrap(skill, 'check', 'twjuxiang:check', original => function (card) {
		try {
			const event = get.event();
			const player = event?.player;
			if (event?.name === 'chooseToUse' && event.type === 'phase' && event.skill === 'twjuxiang_global'
				&& player?.group === 'qun' && player.hp === 1 && player.hujia === 0 && player.countCards('h') === 0
				&& !player.hasSkillTag('noe') && !player.hasSkillTag('nolose') && shouldKeepJuxiangArmor(player, card)) return 0;
		} catch (_) {}
		return original.apply(this, arguments);
	});
}

function shouldKeepJuxiangArmor(player, card) {
	if (card?.isViewAsCard || card?.destroyed || !['bagua', 'renwang'].includes(get.name(card, false))) return false;
	const info = get.info(card, false);
	if (info?.onLose || info?.onEquip || get.equipValueNumber(card) <= 0) return false;
	const slots = get.subtypes(card, false);
	if (slots.length !== 1 || slots[0] !== 'equip2') return false;
	const equips = player.getVEquips('equip2');
	const [armor] = equips;
	if (equips.length !== 1 || armor.name !== card.name || armor.cards?.length !== 1 || armor.cards[0] !== card) return false;

	const targets = game.filterPlayer(target => target !== player && target.hasZhuSkill('twjuxiang', player)
		&& (target.hasEmptySlot('equip2') || target.hasDisabledSlot('equip2')));
	if (targets.length !== 1) return false;
	const [lord] = targets;
	return lord.hp >= 3 && get.attitude(player, lord) > 0 && lord.hasEmptySlot('equip2')
		&& !lord.isMin() && lord.canEquip(card)
		&& game.hasPlayer(enemy => enemy !== player && get.attitude(player, enemy) < 0 && enemy.inRange(player));
}

/* 雄乱的 countCards 谓词只判断真假，直接累加原评分才能保留八卦权重。 */
function installXiongluan(host) {
	const ai = lib.skill?.drlt_xiongluan?.ai;
	const result = ai?.result;
	if (!xiongluanTargetNeedsFix(result?.target)) return;
	const wrapped = host.wrap(result, 'target', 'drlt_xiongluan:target', original => function (player, target) {
		try {
			const damage = player.getCards('h').reduce((score, card) => {
				if (!get.tag(card, 'damage') || get.effect(target, card, player, player) <= 0) return score;
				if (get.name(card, player) === 'sha') {
					if (target.getEquip('bagua')) return score + 0.5;
					if (target.getEquip('rewrite_bagua')) return score + 0.25;
				}
				return score + 1;
			}, 0);
			const threshold = target.hp + target.hujia + game.countPlayer(current => {
				if (get.attitude(current, target) > 0) return current.countCards('hs') / 8;
				return 0;
			});
			if (Number.isFinite(threshold)) return damage >= threshold ? -damage : 0;
		} catch (_) {}
		return original.apply(this, arguments);
	});
	// Stock 雄乱 scores only the recipient. The generic engine can mistake its
	// temporary ban for support and inject an unrelated actor-side bonus.
	if (!wrapped || 'effect' in ai || 'player' in result || 'player_use' in result || 'target_use' in result) return;
	const effect = {
		player(subject) {
			if (subject === 'drlt_xiongluan' && result.target === wrapped.wrapped) return 'zeroplayer';
		},
	};
	try { ai.effect = effect; } catch (_) { return; }
	host.addCleanup(() => {
		if (ai.effect === effect) delete ai.effect;
	});
}

/* 罪论事件的 onNextChooseToMove 由 1.11.7 宿主在创建子事件时传递。 */
function installZuilun(host) {
	const handlers = game.globalEventHandlers;
	if (!lib.skill?.xinfu_zuilun || typeof handlers?.pushHandler !== 'function' || typeof handlers.removeHandler !== 'function') return;
	const skill = 'xinfu_zuilun';
	const type = 'onNextChooseToMove';
	const scoped = new WeakSet();
	let active = true;
	const handle = (event, option) => {
		if (!active || option?.state !== 'begin' || event.name !== 'chooseToMove' || event.forced !== true || scoped.has(event)) return;
		const parent = event.getParent?.();
		if (parent?.name !== skill || parent.player !== event.player || parent.triggername !== 'phaseJieshuBegin') return;
		const original = event.processAI;
		if (typeof original !== 'function') return;
		const source = Function.prototype.toString.call(original).replace(/\s+/g, '');
		if (!source.includes('constcards3=list[0][1].slice(0),tops=[];') ||
			!source.includes('list.sort(function(a,b){returncheck(b)-check(a);});tops.push(cards3.shift());')) return;
		scoped.add(event);
		event.processAI = function (list) {
			if (active) {
				try {
					const num = event.num;
					const cards = list?.[0]?.[1];
					if (Number.isInteger(num) && num >= 1 && num <= 3 && cards?.length === 3 &&
						Array.isArray(cards) && list.length === (num < 3 ? 2 : 1)) {
						const next = event.player.next;
						const observed = next ? get.attitude(event.player, next) : 0;
						const attitude = Number.isFinite(observed) ? observed : 0;
						const judges = attitude ? next.getCards('j').filter(card => !lib.card[card.name]?.noEffect) : [];
						const staticValue = card => {
							const ai = lib.card[card.name]?.ai;
							const value = ai?.value ?? ai?.basic?.value;
							const base = Array.isArray(value) ? value[0] : value;
							return Number.isFinite(base) ? base : 0;
						};
						const remaining = cards.slice();
						const tops = [];
						for (let i = 0; i < num; i++) {
							const name = judges[i]?.viewAs || judges[i]?.name;
							remaining.sort((a, b) => (zuilunJudgment(name, b) - zuilunJudgment(name, a)) * attitude || staticValue(a) - staticValue(b));
							tops.push(remaining.shift());
						}
						return [tops, cards.filter(card => !tops.includes(card))];
					}
				} catch (_) {}
			}
			return original.apply(this, arguments);
		};
	};
	handlers.pushHandler(skill, type, handle);
	host.addCleanup(() => {
		active = false;
		handlers.removeHandler(skill, type, handle);
	});
}

// Only fixed stock delayed-trick outcomes. Dynamic evaluation can inspect the next player's hand.
function zuilunJudgment(name, card) {
	if (name !== 'lebu' && name !== 'bingliang' && name !== 'shandian') return 0;
	const suit = get.suit(card, false);
	if (name === 'lebu') return suit === 'heart' ? 1 : -2;
	if (name === 'bingliang') return suit === 'club' ? 1 : -2;
	const number = get.number(card, false);
	return suit === 'spade' && number >= 2 && number <= 9 ? -5 : 1;
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

/* 镇骨的评分回调嵌在异步 cost 的 chooseTarget.set("ai") 里，公共包装无法直接替换。
 * 宿主 chooseTarget 内容开始时会调用技能自身的 onChooseTarget(event, player)；
 * 这里只在父事件 skill 为 drlt_zhengu 时替换本次选择事件的评分，不包装公共 chooseTarget，
 * 也不改动 cost、content 与 sync。(event, player) 的 player 参数仅用于宿主调用约定。 */
function installZhengu(host, stats) {
	const info = lib.skill?.drlt_zhengu;
	if (!info || typeof info.cost !== 'function') {
		stats.zhenguCompatible = false;
		return;
	}
	stats.zhenguCompatible = zhenguCostNeedsFix(String(info.cost));
	if (!stats.zhenguCompatible) {
		try { console.warn('[无名AI·技能策略] drlt_zhengu.cost 已不是旧式评分（可能已打原生补丁），跳过镇骨即时差额修正'); } catch (e) {}
		return;
	}
	const chooseTargetContent = lib.element?.content?.chooseTarget;
	stats.zhenguEngineHook = Array.isArray(chooseTargetContent) && chooseTargetContent.some(fn => String(fn).includes('onChooseTarget'));
	if (!stats.zhenguEngineHook) {
		stats.zhenguCompatible = false;
		try { console.warn('[无名AI·技能策略] 宿主 chooseTarget 内容不支持 onChooseTarget，跳过镇骨接线'); } catch (e) {}
		return;
	}
	if (info.onChooseTarget) {
		stats.zhenguHookConflict = 1;
		try { console.warn('[无名AI·技能策略] drlt_zhengu.onChooseTarget 已被占用，跳过镇骨接线'); } catch (e) {}
		return;
	}
	const hook = function (event) {
		try {
			const parent = event?.getParent?.();
			if (!parent || parent.skill !== 'drlt_zhengu') return;
			if (!Array.isArray(event.selectTarget) || event.selectTarget[0] !== 1 || event.selectTarget[1] !== 1) return;
			if (event.filterTarget !== lib.filter.notMe) return;
			if (event.__djscZhenguScored) return;
			const originalAI = event.ai;
			if (typeof originalAI !== 'function') return;
			event.__djscZhenguScored = true;
			event.ai = function (target) {
				try {
					stats.zhenguScoreCalls++;
					const player2 = get.player();
					if (!player2 || !target) return originalAI.apply(this, arguments);
					return zhenguImmediateDelta(player2.countCards('h'), target.countCards('h')) * get.attitude(player2, target);
				} catch (e) {
					stats.zhenguFallbacks = (stats.zhenguFallbacks || 0) + 1;
					return originalAI.apply(this, arguments);
				}
			};
		} catch (e) {}
	};
	try {
		info.onChooseTarget = hook;
	} catch (e) {
		stats.zhenguCompatible = false;
		return;
	}
	host.addCleanup(function () {
		if (info.onChooseTarget === hook) {
			try { delete info.onChooseTarget; } catch (e) { try { info.onChooseTarget = undefined; } catch (e2) {} }
		}
	});
}
