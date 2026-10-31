import { lib, game, get, _status } from '../../foundation/adapt/host.js?v=41a';
import { resolveActiveSkillId } from '../safety/aiOverride.js?v=41a';
import { DEFENSE_RULES, retentionAdjustment, shouldSkipExchange, fairButtonScore, olkongshengCostNeedsFix, olkongshengExpansionView, shouldMaskHiddenButtonChoice, retuxiHandBonus, qimouTargetX, shouldBypassQimouCountBlock, reqimouNeedsPayment, reqimouOptimalX } from './skillAIPolicyRules.js?v=41a';

/*
 * 技能AI薄策略层：只修正宿主技能自带的 check(card) 与发动评分，
 * 不改技能规则、不改 filterCard/filterTarget、不读取隐藏手牌。
 *
 * 当前策略：
 * - 界制衡：低体力时保留【桃】【闪】；若手里只剩这些防御牌，
 *   直接放弃本次换牌，避免“丢唯一防御换一张未知牌”。
 *   标准制衡经完整 phaseUse 复核未复现缺陷，不注册。
 * - 界制衡在 4 血及以上仍保留原生“全手换牌”路线。
 * - 界鲁肃缔盟：混合后的暗牌只按位置/玩家 id 做稳定公平选择，不读牌面价值。
 * - 界张辽突袭：按公开手牌数比较目标收益（只对敌人）。
 * - 界魏延奇谋：杀次数未用完但目标在射程外时，若支付能兑换成击杀则放宽原生阻塞。
 * - OL界魏延奇谋：目标贴脸且一发杀可收割时不支付；支付档位收紧为
 *   max(1, 达距所需, 击杀所需)，上限 hp-1。
 * - 其他技能不注册，完全走宿主原生 AI。
 */

const CHECK_POLICIES = DEFENSE_RULES;

let _installed = false;
const _backups = [];
let _chooseButtonBackup = null;
let _chooseTargetBackup = null;
let _olkongshengBackup = null;
let _qimouBackup = null;
let _reqimouGateBackup = null;
let _reqimouContentBackup = null;
const TARGET_POLICIES = new Set(['new_retuxi']);
function _freshStats() {
	return {
		keptTao: 0, keptShan: 0, skippedExchange: 0, skippedOrder: 0,
		fairRedimeng: 0, redimengMaskFailed: 0, redimengTrace: [],
		retuxiTargetBonus: 0,
		olkongshengCostCalls: 0, olkongshengCompatible: null,
		qimouBypass: 0, reqimouGateSkip: 0, reqimouClamp: 0, reqimouClampCalls: 0,
		calls: 0, last: [],
	};
}
let _stats = _freshStats();

/* 周妃【箜声·旧版 olkongsheng】成本 AI 的宿主笔误：
 * getExpansions("olkongsheng") 返回数组，直接 + 数字会变成字符串，
 * 导致“是否已到良姻回复阈值”的数量比较失真。
 * 只在这一次 cost 调用期间给返回数组加 valueOf/toString=长度，
 * 不复制宿主技能函数，也不改变数组本身的迭代/取值行为。 */
function _hookOlkongshengCost() {
	try {
		const info = lib.skill && lib.skill.olkongsheng;
		if (!info || typeof info.cost !== 'function') return;
		const original = info.cost;
		_stats.olkongshengCompatible = olkongshengCostNeedsFix(String(original));
		if (!_stats.olkongshengCompatible) {
			try { console.warn('[无名AI·技能策略] olkongsheng.cost 形态已变化，跳过箜声数量修正'); } catch (e) {}
			return;
		}
		const wrapped = async function (event, trigger, player) {
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
				_stats.olkongshengCostCalls++;
				return await original.apply(this, arguments);
			} finally {
				if (originalGet) player.getExpansions = originalGet;
			}
		};
		try { wrapped.__djscSkillPolicy = 'olkongsheng:cost'; } catch (e) {}
		info.cost = wrapped;
		_olkongshengBackup = { info, original, wrapped };
	} catch (e) {}
}

/* ===== 第二批：生命支付与爆发时机 ===== */

function _aliveEnemiesAndOthers(player) {
	const list = [];
	try {
		for (const current of game.players) {
			if (!current || current === player || typeof current.isIn !== 'function' || !current.isIn()) continue;
			list.push(current);
		}
	} catch (e) {}
	return list;
}

function _qimouTargets(player, shaCard) {
	return _aliveEnemiesAndOthers(player).map(target => {
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

function _reqimouTargets(player) {
	const baseUses = (typeof player.getCardUsable === 'function' && (() => { try { return player.getCardUsable('sha'); } catch (e) { return 1; } })()) || 1;
	return _aliveEnemiesAndOthers(player).map(target => {
		let record = null;
		try {
			record = {
				currentlyInRange: !!player.canUse('sha', target),
				canUseIgnoringDistance: !!player.canUse('sha', target, false),
				effect: get.effect(target, { name: 'sha' }, player, player),
				distance: get.distance(player, target),
				attackRange: typeof player.attackRange === 'number' ? player.attackRange : 1,
				hp: target.hp,
				baseUses,
			};
		} catch (e) { record = null; }
		return record;
	}).filter(Boolean);
}

/* 界魏延【奇谋 qimou】：杀次数未用完时原生直接否决，即使目标在射程外。
 * 只放宽这一条阻塞：其余原生条件与“支付兑换成击杀”必须成立。 */
function _hookQimouActivation() {
	try {
		const info = lib.skill && lib.skill.qimou;
		const result = info && info.ai && info.ai.result;
		if (!result || typeof result.player !== 'function') return;
		const original = result.player;
		const wrapped = function (player) {
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
					targets: _qimouTargets(player, shaCard),
				});
				if (bypass) {
					_stats.qimouBypass++;
					return 1;
				}
			} catch (e) {}
			return native;
		};
		try { wrapped.__djscSkillPolicy = 'qimou:result'; } catch (e) {}
		result.player = wrapped;
		_qimouBackup = { owner: result, key: 'player', original, wrapped };
	} catch (e) {}
}

/* OL界魏延【奇谋 reqimou】gate：目标贴脸且一发杀可收割时不支付。 */
function _hookReqimouGate() {
	try {
		const info = lib.skill && lib.skill.reqimou;
		const result = info && info.ai && info.ai.result;
		if (!result || typeof result.player !== 'function') return;
		const original = result.player;
		const wrapped = function (player) {
			const native = original.apply(this, arguments);
			try {
				if (Number(native) > 0 && !reqimouNeedsPayment(_reqimouTargets(player))) {
					_stats.reqimouGateSkip++;
					return 0;
				}
			} catch (e) {}
			return native;
		};
		try { wrapped.__djscSkillPolicy = 'reqimou:gate'; } catch (e) {}
		result.player = wrapped;
		_reqimouGateBackup = { owner: result, key: 'player', original, wrapped };
	} catch (e) {}
}

/* OL界魏延【奇谋 reqimou】支付档位：把 processAI 的 hp-1 收紧为
 * max(1, 达距所需, 击杀所需)，上限 hp-1；找不到可击杀目标时保留原生档位。 */
function _hookReqimouNumbers() {
	try {
		const info = lib.skill && lib.skill.reqimou;
		if (!info || typeof info.content !== 'function') return;
		const originalContent = info.content;
		const wrapped = async function (event, trigger, player) {
			const originalChooseNumbers = typeof player.chooseNumbers === 'function' ? player.chooseNumbers : null;
			if (originalChooseNumbers) {
				player.chooseNumbers = function (...args) {
					const next = originalChooseNumbers.apply(this, args);
					const originalForResult = typeof next.forResult === 'function' ? next.forResult : null;
					if (originalForResult) {
						next.forResult = async function (...forArgs) {
							const result = await originalForResult.apply(this, forArgs);
							try {
								_stats.reqimouClampCalls++;
								const shaCount = player.countCards('hs', card => _cardName(card, player) === 'sha');
								const optimal = reqimouOptimalX({
									hp: player.hp, shaCount,
									baseUses: (typeof player.getCardUsable === 'function' && (() => { try { return player.getCardUsable('sha'); } catch (e) { return 1; } })()) || 1,
									targets: _reqimouTargets(player),
								});
								if (optimal != null && result && Array.isArray(result.numbers) && result.numbers.length) {
									const paid = Number(result.numbers[0]);
									if (Number.isFinite(paid) && paid > optimal) {
										result.numbers[0] = optimal;
										_stats.reqimouClamp++;
									}
								}
							} catch (e) {}
							return result;
						};
					}
					return next;
				};
			}
			try {
				return await originalContent.apply(this, arguments);
			} finally {
				if (originalChooseNumbers) player.chooseNumbers = originalChooseNumbers;
			}
		};
		try { wrapped.__djscSkillPolicy = 'reqimou:content'; } catch (e) {}
		info.content = wrapped;
		_reqimouContentBackup = { owner: info, key: 'content', original: originalContent, wrapped };
	} catch (e) {}
}

/* 界鲁肃【缔盟】混合后的手牌对选择者应是暗牌。
 * 宿主原生 AI 用 get.value(button.link) 直接挑最高价值牌，等于看牌；
 * 这里只给 AI 一个与牌面无关、与按钮位置/玩家 id 有关的稳定分数。 */
function _buttonIndex(buttons, button) {
	const list = Array.isArray(buttons) ? buttons : [];
	let index = list.indexOf(button);
	if (index < 0 && button) {
		const link = button.link || button;
		index = list.findIndex(item => item === link || (item && item.link === link));
	}
	return Math.max(0, index);
}

function _activeSkillIds(player, startEvent) {
	const ids = [];
	try {
		let ev = startEvent || (_status && _status.event) || null;
		for (let depth = 0; ev && depth < 8; depth++) {
			for (const cand of [ev.skill, ev.sourceSkill, ev.skillName, ev.name]) {
				if (typeof cand === 'string' && cand && lib.skill && lib.skill[cand] && typeof lib.skill[cand] === 'object' && !ids.includes(cand)) ids.push(cand);
			}
			ev = typeof ev.getParent === 'function' ? ev.getParent() : (ev.parent || null);
		}
	} catch (e) {}
	return ids;
}

function _hookFairRedimengChoice() {
	try {
		const proto = lib.element && lib.element.Player && lib.element.Player.prototype;
		if (!proto || typeof proto.chooseButton !== 'function') return;
		const original = proto.chooseButton;
		const wrapped = function (...args) {
			const next = original.apply(this, args);
			try {
				if (!next || next.__djscFairRedimeng) return next;
				if (this === game.me && !_status.auto) return next;
				const ids = _activeSkillIds(this, _status.event);
				try {
					const sid = resolveActiveSkillId(this, _status.event);
					if (sid && !ids.includes(sid)) ids.push(sid);
				} catch (e) {}
				if (!shouldMaskHiddenButtonChoice(this === game.me, !!_status.auto, ids)) return next;
				const player = this;
				const getButtons = function () {
					try {
						const buttons = next.dialog && next.dialog.buttons;
						if (buttons && typeof buttons.length === 'number') return Array.prototype.slice.call(buttons);
					} catch (e) {}
					return next.buttons || [];
				};
				const score = function (button) {
					let index = 0, value = 0.5;
					const buttons = getButtons();
					try { index = _buttonIndex(buttons, button); } catch (e) {}
					try { value = fairButtonScore((player && player.playerid) || '', index); } catch (e) { value = 0.5; }
					try {
						if (_stats.redimengTrace.length < 24) _stats.redimengTrace.push({ playerid: (player && player.playerid) || '', index, score: value, buttons: buttons.length });
					} catch (e) {}
					return value;
				};
				let attached = false;
				try { next.ai = score; attached = next.ai === score; } catch (e) {}
				if (typeof next.set === 'function' && !next.__djscFairRedimengSet) {
					const originalSet = next.set;
					try {
						next.set = function (key, value) {
							if (key === 'ai') value = score;
							try { return originalSet.call(this, key, value); } catch (e) { _stats.redimengMaskFailed++; return this; }
						};
						next.__djscFairRedimengSet = true;
					} catch (e) {}
				}
				if (!attached && typeof next.set === 'function') {
					try { next.set('ai', score); attached = next.ai === score; } catch (e) {}
				}
				if (!attached) { _stats.redimengMaskFailed++; return next; }
				next.__djscFairRedimeng = true;
				_stats.fairRedimeng++;
			} catch (e) {}
			return next;
		};
		try { wrapped.__djscSkillPolicy = 'redimeng:button'; } catch (e) {}
		proto.chooseButton = wrapped;
		_chooseButtonBackup = { proto, original, wrapped };
		if (!proto.__djscFairRedimengHook) proto.__djscFairRedimengHook = true;
	} catch (e) {}
}

/* 【突袭】目标选择：原生 AI 只看态度，同等敌意下不比较公开手牌数。
 * 只对敌人按手牌数加一个 0~2 的有界小分，不改变合法目标集合。 */
function _hookRetuxiTargetChoice() {
	try {
		const proto = lib.element && lib.element.Player && lib.element.Player.prototype;
		if (!proto || typeof proto.chooseTarget !== 'function') return;
		const original = proto.chooseTarget;
		const wrapped = function (...args) {
			const next = original.apply(this, args);
			try {
				if (!next || next.__djscRetuxiTarget) return next;
				const player = this;
				if (player === game.me && !_status.auto) return next;
				const sid = resolveActiveSkillId(player, _status.event);
				if (!TARGET_POLICIES.has(sid)) return next;
				const apply = function (baseAI) {
					return function (target) {
						let score = 0;
						try { if (typeof baseAI === 'function') score = Number(baseAI.apply(this, arguments)) || 0; } catch (e) {}
						try {
							const hasLossBenefit = !!(target && ((typeof target.hasSkill === 'function' && target.hasSkill('tuntian')) || (typeof target.hasSkillTag === 'function' && target.hasSkillTag('nocard'))));
							const bonus = retuxiHandBonus(target ? target.countCards('h') : 0, !!target && get.attitude(player, target) < 0, hasLossBenefit);
							if (bonus) { score += bonus; _stats.retuxiTargetBonus++; }
						} catch (e) {}
						return score;
					};
				};
				if (typeof next.ai === 'function') next.ai = apply(next.ai);
				if (typeof next.set === 'function' && !next.__djscRetuxiTargetSet) {
					const originalSet = next.set;
					next.set = function (key, value) {
						if (key === 'ai') value = apply(value);
						return originalSet.call(this, key, value);
					};
					next.__djscRetuxiTargetSet = true;
				}
				next.__djscRetuxiTarget = true;
			} catch (e) {}
			return next;
		};
		try { wrapped.__djscSkillPolicy = 'retuxi:target'; } catch (e) {}
		proto.chooseTarget = wrapped;
		_chooseTargetBackup = { proto, original, wrapped };
	} catch (e) {}
}


function _playerOf(card) {
	try {
		if (card && typeof get.owner === 'function') {
			const owner = get.owner(card);
			if (owner) return owner;
		}
	} catch (e) {}
	try {
		if (typeof get.player === 'function') {
			const p = get.player();
			if (p) return p;
		}
	} catch (e) {}
	try { return (_status && _status.event && _status.event.player) || null; } catch (e) { return null; }
}

function _cardName(card, player) {
	try {
		if (typeof get.name === 'function') {
			const n = get.name(card, player);
			if (n) return n;
		}
	} catch (e) {}
	return card && card.name ? card.name : '';
}

export function skillDefenseRetentionAdjustment(card, player, base, rule) {
	try {
		if (!player || !card || !rule) return base;
		const position = typeof get.position === 'function' ? get.position(card) : null;
		return retentionAdjustment(_cardName(card, player), player.hp, position, base, rule);
	} catch (e) { return base; }
}

export function shouldSkipDefenseOnlyExchange(player, rule) {
	try {
		if (!player || !rule) return false;
		const handNames = player.getCards('h').map(card => _cardName(card, player));
		return shouldSkipExchange(player.hp, handNames, rule);
	} catch (e) { return false; }
}

export function installSkillAIPolicies() {
	if (_installed) return;
	_installed = true;
	_stats = _freshStats();
	try {
		_hookFairRedimengChoice();
		_hookRetuxiTargetChoice();
		_hookOlkongshengCost();
		_hookQimouActivation();
		_hookReqimouGate();
		_hookReqimouNumbers();
		for (const [sid, rule] of Object.entries(CHECK_POLICIES)) {
			const info = lib.skill && lib.skill[sid];
			if (!info) continue;
			if (typeof info.check === 'function') {
				const original = info.check;
				const wrapped = function (card) {
					let base;
					try { base = original.apply(this, arguments); } catch (e) { return original.apply(this, arguments); }
					try {
						_stats.calls++;
						const player = _playerOf(card);
						const adjusted = skillDefenseRetentionAdjustment(card, player, base, rule);
						if (adjusted !== base) {
							const name = _cardName(card, player);
							if (name === 'tao') _stats.keptTao++;
							else if (name === 'shan') _stats.keptShan++;
						}
						if (_stats.last.length < 20) _stats.last.push({ sid, card: _cardName(card, player), hp: player && player.hp, pos: typeof get.position === 'function' ? get.position(card) : null, base, adjusted });
						return adjusted;
					} catch (e) { return base; }
				};
				try { wrapped.__djscSkillPolicy = sid + ':check'; } catch (e) {}
				info.check = wrapped;
				_backups.push({ owner: info, key: 'check', original, wrapped });
			}
			const ai = info.ai;
			if (ai && ai.order != null) {
				const original = ai.order;
				const baseOf = typeof original === 'function' ? original : function () { return original; };
				const wrapped = function (item, player) {
					let base;
					try { base = baseOf.apply(this, arguments); } catch (e) { return typeof original === 'function' ? 0 : original; }
					try {
						if (shouldSkipDefenseOnlyExchange(player || _playerOf(), rule)) {
							_stats.skippedOrder++;
							return -1;
						}
					} catch (e) {}
					return base;
				};
				try { wrapped.__djscSkillPolicy = sid + ':order'; } catch (e) {}
				ai.order = wrapped;
				_backups.push({ owner: ai, key: 'order', original, wrapped });
			}
			const result = ai && ai.result;
			if (result && result.player != null) {
				const original = result.player;
				const baseOf = typeof original === 'function' ? original : function () { return original; };
				const wrapped = function (player) {
					let base;
					try { base = baseOf.apply(this, arguments); } catch (e) { return typeof original === 'function' ? 0 : original; }
					try {
						if (shouldSkipDefenseOnlyExchange(player || _playerOf(), rule)) {
							_stats.skippedExchange++;
							return Math.min(Number(base), -1);
						}
					} catch (e) {}
					return base;
				};
				try { wrapped.__djscSkillPolicy = sid + ':result'; } catch (e) {}
				result.player = wrapped;
				_backups.push({ owner: result, key: 'player', original, wrapped });
			}
		}
	} catch (e) {
		_installed = false;
	}
}

export function uninstallSkillAIPolicies() {
	for (const backup of _backups.splice(0)) {
		try {
			if (backup.owner && backup.owner[backup.key] === backup.wrapped) backup.owner[backup.key] = backup.original;
		} catch (e) {}
	}
	try {
		if (_chooseButtonBackup && _chooseButtonBackup.proto.chooseButton === _chooseButtonBackup.wrapped) {
			_chooseButtonBackup.proto.chooseButton = _chooseButtonBackup.original;
			try { delete _chooseButtonBackup.proto.__djscFairRedimengHook; } catch (e) {}
		}
	} catch (e) {}
	_chooseButtonBackup = null;
	try {
		if (_chooseTargetBackup && _chooseTargetBackup.proto.chooseTarget === _chooseTargetBackup.wrapped) {
			_chooseTargetBackup.proto.chooseTarget = _chooseTargetBackup.original;
		}
	} catch (e) {}
	_chooseTargetBackup = null;
	try {
		if (_olkongshengBackup && _olkongshengBackup.info.cost === _olkongshengBackup.wrapped) {
			_olkongshengBackup.info.cost = _olkongshengBackup.original;
		}
	} catch (e) {}
	_olkongshengBackup = null;
	for (const backup of [_qimouBackup, _reqimouGateBackup, _reqimouContentBackup]) {
		try {
			if (backup && backup.owner[backup.key] === backup.wrapped) backup.owner[backup.key] = backup.original;
		} catch (e) {}
	}
	_qimouBackup = null;
	_reqimouGateBackup = null;
	_reqimouContentBackup = null;
	_installed = false;
}

export function skillAIPolicyStats() {
	return Object.assign({ installed: _installed }, _stats);
}
