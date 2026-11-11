/*
 * 神话雷历史技能专项场景（真实无名杀 1.11.7 宿主）。
 *
 * 覆盖：
 *   箜声 olkongsheng —— 扩展牌数量判断、已选择牌数量、良姻触发阈值、临时视图恢复、异常退出。
 *   谦节 drlt_qianjie —— 未横置/已横置的铁索目标判定、noLink 标签、卸载还原。
 *   父荫 xinfu_fuyin —— 本回合首次/再次成为目标、历史读取对象、当前事件是否计入历史。
 *   技能台账冒烟 —— 16 项已审查技能的注册完整性与安装/卸载还原。
 *
 * 所有观测都来自宿主真实函数与真实结算；仅 UI 已选牌数组作为受控夹具。
 */
export async function runLeiHistoryScenes(page, options = {}) {
	return page.evaluate(async opts => {
		const policyInstalled = !!opts.installPolicy;
		let policy = null;
		if (policyInstalled) {
			policy = await import('/extension/无名AI/score/decision/skills/skillAIPolicies.js?v=41a');
			policy.installSkillAIPolicies();
		}
		const { game, lib, get, _status } = realHost;
		const roster = game.players.slice();
		const [actor, ally, enemy1, enemy2] = roster;
		const rosterGroups = roster.map(p => p.group);
		const nameOf = p => (p ? p.playerid + ':' + (p.name1 || p.name || '?') : null);
		const card = (name, suit = 'spade', number = 1) => game.createCard(name, suit, number);
		const run = async (name, player, content) => {
			const event = game.createEvent(name, false);
			if (player) event.player = player;
			event.setContent(content);
			await game.loop(event);
			return event;
		};
		const reset = async () => {
			try {
				if (game.players.length !== roster.length || roster.some(p => !game.players.includes(p))) {
					game.players.splice(0, game.players.length, ...roster);
				}
			} catch (e) {}
			for (const p of roster) {
				try { const expansions = p.getCards('x'); if (expansions.length) await p.loseToDiscardpile(expansions); } catch (e) {}
				try { for (const skill of Object.keys(p.tempSkills || {})) { try { p.removeSkill(skill); } catch (e) {} } } catch (e) {}
				p.clearSkills(true);
				try {
					const remaining = p.getSkills(null, false, false).filter(skill => lib.skill[skill] && lib.skill[skill].superCharlotte);
					if (remaining.length) p.removeSkill(remaining);
				} catch (e) {}
				try {
					p.dead = false; p.removed = false;
					p.classList.remove('dead'); p.classList.remove('out');
					if (Array.isArray(game.dead)) {
						const index = game.dead.indexOf(p);
						if (index >= 0) game.dead.splice(index, 1);
						for (let i = game.dead.length - 1; i >= 0; i--) {
							if (game.dead[i] === p || game.dead[i] === p.playerid) game.dead.splice(i, 1);
						}
					}
				} catch (e) {}
				const cards = p.getCards('hej');
				if (cards.length) await p.discard(cards);
				p.hp = p.maxHp = 4;
				try { p.group = rosterGroups[roster.indexOf(p)] || p.group; } catch (e) {}
				try { p.classList.remove('turnedover'); } catch (e) {}
				try { p.classList.remove('linked'); p.classList.remove('linked2'); } catch (e) {}
				try { if (p.isLinked && p.isLinked()) await p.link(false); } catch (e) {}
				for (const key of Object.keys(p.storage || {})) delete p.storage[key];
				/* 清空本回合历史，避免上一场景注入的历史污染下一场景的父荫判定 */
				try {
					if (Array.isArray(p.actionHistory) && p.actionHistory.length) {
						const last = p.actionHistory[p.actionHistory.length - 1];
						for (const key of ['useCard', 'respond', 'skipped', 'lose', 'gain', 'sourceDamage', 'damage', 'custom', 'useSkill']) {
							if (Array.isArray(last[key])) last[key].length = 0;
						}
					}
				} catch (e) {}
				try { p.stat = [{ card: {}, skill: {}, triggerSkill: {} }]; } catch (e) {}
				try { p.awakenedSkills = []; } catch (e) {}
				p.identity = p === actor ? 'zhu' : (p === ally ? 'zhong' : 'fan');
				p.identityShown = true;
				try { p.setIdentity(p.identity); } catch (e) {}
				p.update();
			}
			game.zhu = actor;
			actor.update();
			_status.currentPhase = actor;
			try {
				for (const key of ['cards', 'targets', 'buttons']) {
					const list = realHost.ui.selected[key];
					if (Array.isArray(list)) list.length = 0;
				}
			} catch (e) {}
		};
		const give = async (player, list) => {
			const cards = list.map(([name, suit, number]) => card(name, suit, number));
			if (cards.length) await player.gain(cards, 'gain2');
		};
		/* 运行时挑一张真实装备牌：宿主装备分支返回 5 - get.value(card)，
		 * 与良姻阈值分支返回的 0 必然不同，阈值差异才可观测。 */
		const findEquipCard = () => {
			const candidates = ['wugu', 'crossbow', 'blade', 'axe', 'spear', 'shield', 'vine', 'ice_attack', 'silver_lion', 'wooden_ox', 'wooden_horse', 'zixing', 'dayuan', 'hualiu', 'chitu', 'heps', 'bingli', 'qilin', 'jueying'];
			for (const name of candidates) {
				if (!lib.card[name]) continue;
				const c = card(name, 'spade', 5);
				let type = null;
				try { type = get.type(c, null, false); } catch (e) {}
				if (type !== 'equip') continue;
				let value = null;
				try { value = get.value(c); } catch (e) {}
				if (typeof value !== 'number' || value >= 5 || value < 0) continue;
				return c;
			}
			return null;
		};

		const scenes = [];
		const wanted = Array.isArray(opts.scenes) && opts.scenes.length ? new Set(opts.scenes) : null;
		const scene = async (name, setup, action) => {
			if (wanted && !wanted.has(name)) return;
			const rec = { name };
			try {
				await run('leiHistoryScene', actor, async () => {
					await reset();
					await setup(rec);
					await action(rec);
				});
			} catch (e) {
				rec.error = String((e && e.stack) || e);
			}
			scenes.push(rec);
		};

		const installState = {
			policyInstalled,
			hostVersion: lib.version,
			mode: get.mode(),
			players: game.players.length,
			hasSkill: !!lib.skill.drlt_zhengu,
			/* 安装后立即采样：区分“未接线”与“接线后被宿主改写” */
			qianjieWrapMarker: lib.skill?.drlt_qianjie?.ai?.effect?.target?.__djscSkillPolicy || null,
			qianjieSource: String(lib.skill?.drlt_qianjie?.ai?.effect?.target || '').slice(0, 220),
			fuyinWrapMarker: lib.skill?.xinfu_fuyin?.ai?.effect?.target?.__djscSkillPolicy || null,
			fuyinSource: String(lib.skill?.xinfu_fuyin?.ai?.effect?.target || '').slice(0, 220),
			kongshengWrapMarker: lib.skill?.olkongsheng?.cost?.__djscSkillPolicy || null,
			zhenguHook: typeof lib.skill?.drlt_zhengu?.onChooseTarget,
			stats: policy ? policy.skillAIPolicyStats() : null,
		};

		/* ============ 箜声 ============ */
		await scene('kongsheng-count-threshold', async rec => {
			rec.equipCardName = null;
			const equip = findEquipCard();
			if (!equip) { rec.setupError = '未找到可用装备牌'; return; }
			rec.equipCardName = equip.name;
			actor.addSkill('olkongsheng');
			const expansionEvent = actor.addToExpansion([card('sha', 'spade', 30)], actor, 'give');
			expansionEvent.gaintag.add('olkongsheng');
			await expansionEvent;
			await give(actor, [['wuxie', 'heart', 32], ['wuxie', 'club', 33]]);
			await actor.gain([equip], 'gain2');
			ally.hp = 3; ally.maxHp = 4;
			await give(ally, [['sha', 'diamond', 34]]);
			ally.update();
		}, async rec => {
			const originalGetExpansions = actor.getExpansions;
			const probeCard = actor.getCards('h').find(c => c.name === rec.equipCardName);
			const nonEquip = actor.getCards('h').find(c => c.name === 'wuxie');
			rec.probeFound = !!probeCard;
			if (!probeCard) return;
			rec.probeValue = get.value(probeCard);
			rec.probeType = get.type(probeCard, null, false);
			rec.expansionsBefore = actor.getExpansions('olkongsheng').length;
			const originalChooseCard = actor.chooseCard;
			actor.chooseCard = function () {
				const stub = {
					_ai: null,
					set(key, value) { if (key === 'ai') this._ai = value; return this; },
					async forResult() {
						/* 仍在 cost 调用期内：扩展的临时视图此刻生效 */
						rec.viewInstalled = actor.getExpansions !== originalGetExpansions;
						try {
							const raw = originalGetExpansions.call(actor, 'olkongsheng');
							rec.expansionsIsArray = Array.isArray(raw);
							rec.expansionsLength = Array.isArray(raw) ? raw.length : null;
						} catch (e) { rec.expansionsReadError = String(e && e.message); }
						const uiCards = realHost.ui.selected.cards;
						try {
							realHost.ui.selected.cards = [nonEquip];
							rec.scoreSelectedOne = stub._ai(probeCard, actor);
							rec.selectedOneLen = realHost.ui.selected.cards.length;
							realHost.ui.selected.cards = [];
							rec.scoreSelectedZero = stub._ai(probeCard, actor);
						} catch (e) {
							rec.aiError = String((e && e.stack) || e);
						} finally {
							realHost.ui.selected.cards = uiCards;
						}
						return { bool: false };
					},
				};
				return stub;
			};
			try {
				const costEvent = { skill: 'olkongsheng' };
				await lib.skill.olkongsheng.cost(costEvent, {}, actor);
				rec.costResolved = true;
			} catch (e) {
				rec.costError = String((e && e.stack) || e);
			} finally {
				actor.chooseCard = originalChooseCard;
			}
			rec.viewRestored = actor.getExpansions === originalGetExpansions;
			rec.expansionsAfter = actor.getExpansions('olkongsheng').length;
		});

		await scene('kongsheng-cost-error', async () => {
			actor.addSkill('olkongsheng');
			const expansionEvent = actor.addToExpansion([card('sha', 'spade', 40)], actor, 'give');
			expansionEvent.gaintag.add('olkongsheng');
			await expansionEvent;
			await give(actor, [['wuxie', 'spade', 41]]);
		}, async rec => {
			const originalGetExpansions = actor.getExpansions;
			const originalChooseCard = actor.chooseCard;
			actor.chooseCard = function () { throw new Error('fixture-choose-card'); };
			try {
				await lib.skill.olkongsheng.cost({ skill: 'olkongsheng' }, {}, actor);
				rec.threw = false;
			} catch (e) {
				rec.threw = true;
				rec.error = String(e && e.message);
			} finally {
				actor.chooseCard = originalChooseCard;
			}
			rec.viewRestored = actor.getExpansions === originalGetExpansions;
		});

		/* ============ 谦节 ============ */
		await scene('qianjie-tiesuo', async () => {
			ally.addSkill('drlt_qianjie');
			await give(enemy1, [['tiesuo', 'spade', 1], ['sha', 'club', 2]]);
		}, async rec => {
			const tiesuo = card('tiesuo', 'spade', 1);
			const effectOf = lib.skill.drlt_qianjie?.ai?.effect?.target;
			rec.hasEffectTarget = typeof effectOf === 'function';
			rec.skillExists = !!lib.skill.drlt_qianjie;
			rec.effectExists = !!lib.skill.drlt_qianjie?.ai?.effect;
			rec.wrapMarker = effectOf?.__djscSkillPolicy || null;
			rec.effectSourceHead = typeof effectOf === 'function' ? String(effectOf).slice(0, 200) : null;
			try {
				rec.effectNotLinked = effectOf.call(lib.skill.drlt_qianjie.ai.effect, tiesuo, enemy1, ally);
			} catch (e) { rec.effectNotLinkedError = String(e && e.message); }
			try {
				rec.getEffectNotLinked = get.effect(ally, tiesuo, enemy1, enemy1, false);
			} catch (e) { rec.getEffectNotLinkedError = String((e && e.message) || e); }
			rec.noLinkTag = lib.skill.drlt_qianjie?.subSkill?.[1]?.ai?.noLink;
			/* 横置状态由宿主以 DOM class 表达；link() 是异步事件且会被谦节的 linkBegin 取消，
			 * 这里直接置位 class 以构造“已被横置、等待铁索解除”的局面。 */
			try { await ally.link(true); } catch (e) { rec.linkError = String(e && e.message); }
			if (!ally.isLinked()) {
				/* 宿主 isLinked() 按 get.is.linked2 选择 'linked2' 或 'linked' class，两者都置位以覆盖两种横置样式 */
				try { ally.classList.add('linked'); ally.classList.add('linked2'); } catch (e) { rec.classError = String(e && e.message); }
			}
			rec.isLinked = !!ally.isLinked();
			try {
				rec.effectLinked = effectOf.call(lib.skill.drlt_qianjie.ai.effect, tiesuo, enemy1, ally);
			} catch (e) { rec.effectLinkedError = String(e && e.message); }
			try {
				rec.getEffectLinked = get.effect(ally, tiesuo, enemy1, enemy1, false);
			} catch (e) { rec.getEffectLinkedError = String((e && e.message) || e); }
			rec.noLinkTagAfter = lib.skill.drlt_qianjie?.subSkill?.[1]?.ai?.noLink;
		});

		/* ============ 父荫 ============ */
		await scene('fuyin-history', async rec => {
			ally.addSkill('xinfu_fuyin');
			await give(enemy1, [['sha', 'spade', 1], ['juedou', 'club', 2]]);
			await give(ally, [['shan', 'heart', 3]]);
		}, async rec => {
			const sha = enemy1.getCards('h').find(c => c.name === 'sha');
			const juedou = enemy1.getCards('h').find(c => c.name === 'juedou');
			const effectOf = lib.skill.xinfu_fuyin?.ai?.effect?.target;
			rec.hasEffectTarget = typeof effectOf === 'function';
			if (!effectOf || !sha || !juedou) { rec.setupError = '缺少杀/决斗或效果入口'; return; }
			const call = card => {
				try { return { value: effectOf.call(lib.skill.xinfu_fuyin.ai.effect, card, enemy1, ally) }; }
				catch (e) { return { error: String((e && e.message) || e) }; }
			};
			rec.diagnostics = {
				attackerHand: enemy1.getCards('h').map(c => c.name),
				targetHand: ally.getCards('h').map(c => c.name),
				canUseSha: (() => { try { return !!enemy1.canUse(sha, ally); } catch (e) { return String(e && e.message); } })(),
				canUseJuedou: (() => { try { return !!enemy1.canUse(juedou, ally); } catch (e) { return String(e && e.message); } })(),
				distance: (() => { try { return get.distance(enemy1, ally); } catch (e) { return String(e && e.message); } })(),
			};
			rec.firstSha = call(sha);
			rec.firstJuedou = call(juedou);
			rec.historyBefore = enemy1.getHistory('useCard').length;
			/* 注入一次“本回合已被杀/决斗指定”的历史：验证读取对象是被指定者而非出牌者 */
			const historyList = enemy1.actionHistory[enemy1.actionHistory.length - 1].useCard;
			historyList.push({ card: sha, targets: [ally], name: 'sha', skill: 'useCard' });
			rec.historyAfter = enemy1.getHistory('useCard').length;
			rec.historyTargets = enemy1.getHistory('useCard').map(evt => (evt.targets || []).map(nameOf));
			rec.secondSha = call(sha);
			rec.secondJuedou = call(juedou);
			/* 对照：被指定者自身的历史（出牌者历史不含自己） */
			rec.allyHistory = ally.getHistory('useCard').length;
		});

		await scene('fuyin-current-event', async () => {
			ally.addSkill('xinfu_fuyin');
			await give(enemy1, [['sha', 'spade', 1], ['sha', 'club', 2]]);
			await give(ally, [['shan', 'heart', 3]]);
		}, async rec => {
			const effect = lib.skill.xinfu_fuyin.ai.effect;
			const original = effect.target;
			effect.target = function (card, player, target) {
				rec.consulted = true;
				try {
					const history = player.getHistory('useCard');
					rec.consultCardName = card && card.name ? card.name : null;
					rec.consultPlayer = nameOf(player);
					rec.consultTarget = nameOf(target);
					rec.historyLength = history.length;
					rec.currentEventName = _status.event?.name || null;
					rec.currentEventSkill = _status.event?.skill || null;
					rec.currentEventInHistory = history.some(evt => evt === _status.event);
					rec.historyTargets = history.map(evt => (evt.targets || []).map(nameOf));
					rec.historyEntries = history.map(evt => ({ name: evt.name || null, skill: evt.skill || null, card: evt.card ? evt.card.name : null, targets: (evt.targets || []).map(nameOf) }));
					/* 修正版判据（被指定者是否已被本回合的杀/决斗指定）在此刻的取值 */
					rec.fixedCheckWouldMatch = history.some(evt => evt.card && ['sha', 'juedou'].includes(evt.card.name) && (evt.targets || []).includes(target));
					/* 旧版判据（出牌者是否已被指定）在此刻的取值 */
					rec.legacyCheckWouldMatch = history.some(evt => evt.card && ['sha', 'juedou'].includes(evt.card.name) && (evt.targets || []).includes(player));
				} catch (e) { rec.consultError = String((e && e.message) || e); }
				const value = original.apply(this, arguments);
				rec.result = value;
				return value;
			};
			try {
				const sha = enemy1.getCards('h').find(c => c.name === 'sha');
				if (!sha) { rec.setupError = '出牌者没有杀'; }
				else await enemy1.useCard(sha, [ally], true);
				rec.useCardDone = true;
			} catch (e) {
				rec.useError = String((e && e.message) || e);
			} finally {
				effect.target = original;
			}
			rec.allyHpAfter = ally.hp;
			rec.allyHasFuyin = !!ally.hasSkill('xinfu_fuyin');
		});

		/* ============ 技能台账与安装/卸载还原冒烟 ============ */
		const AUDITED = ['zhengrong', 'hongju', 'dcwanglie', 'drlt_qianjie', 'drlt_jueyan', 'drlt_poshi', 'olliangyin', 'olkongsheng', 'drlt_xiongluan', 'drlt_congjian', 'twjuxiang', 'drlt_yongsi', 'drlt_weidi', 'drlt_zhengu', 'xinfu_zuilun', 'xinfu_fuyin'];
		await scene('skill-ledger-smoke', async rec => {
			/* 记录安装态快照 */
			rec.snapshotBefore = {};
			for (const id of AUDITED) {
				const info = lib.skill[id];
				rec.snapshotBefore[id] = {
					exists: !!info,
					cost: info ? String(info.cost || '').length : 0,
					hasAi: !!(info && info.ai),
					effectTarget: !!(info && info.ai && info.ai.effect && typeof info.ai.effect.target === 'function'),
					resultTarget: !!(info && info.ai && info.ai.result && typeof info.ai.result.target === 'function'),
					check: !!(info && typeof info.check === 'function'),
					sync: !!(info && typeof info.sync === 'function'),
				};
			}
		}, async rec => {
			rec.snapshotAfter = {};
			for (const id of AUDITED) {
				const info = lib.skill[id];
				rec.snapshotAfter[id] = {
					exists: !!info,
					cost: info ? String(info.cost || '').length : 0,
					hasAi: !!(info && info.ai),
					effectTarget: !!(info && info.ai && info.ai.effect && typeof info.ai.effect.target === 'function'),
					resultTarget: !!(info && info.ai && info.ai.result && typeof info.ai.result.target === 'function'),
					check: !!(info && typeof info.check === 'function'),
					sync: !!(info && typeof info.sync === 'function'),
				};
			}
			rec.registryPacks = policy ? Object.keys(policy.skillAIPolicyStats()?.packs || {}) : [];
			rec.duplicates = [];
			const seen = new Map();
			for (const id of AUDITED) {
				const owners = rec.registryPacks.filter(pack => {
					const skills = (policy.skillAIPolicyStats()?.packs?.[pack]?.skills) || [];
					return skills.includes(id);
				});
				if (owners.length > 1) rec.duplicates.push({ skill: id, packs: owners });
			}
		});

		/* ============ 多分包共存与生命周期（仅扩展配置） ============ */
		if (policyInstalled) {
			await scene('multi-pack-lifecycle', async rec => {
				rec.packsBefore = Object.keys(policy.skillAIPolicyStats()?.packs || {});
			}, async rec => {
				const packModule = await import('/extension/无名AI/score/decision/skills/packs/shenhuaLei.js?v=41a');
				rec.hookBefore = typeof lib.skill.drlt_zhengu.onChooseTarget;
				rec.fuyinBefore = lib.skill.xinfu_fuyin?.ai?.effect?.target?.__djscSkillPolicy || null;
				rec.qianjieBefore = lib.skill.drlt_qianjie?.ai?.effect?.target?.__djscSkillPolicy || null;
				rec.kongshengBefore = lib.skill.olkongsheng?.cost?.__djscSkillPolicy || null;

				policy.uninstallSkillAIPolicyPack('shenhua_lei');
				rec.hookAfterUninstall = typeof lib.skill.drlt_zhengu.onChooseTarget;
				rec.fuyinAfterUninstall = lib.skill.xinfu_fuyin?.ai?.effect?.target?.__djscSkillPolicy || null;
				rec.qianjieAfterUninstall = lib.skill.drlt_qianjie?.ai?.effect?.target?.__djscSkillPolicy || null;
				rec.kongshengAfterUninstall = lib.skill.olkongsheng?.cost?.__djscSkillPolicy || null;
				rec.otherPacksAfterUninstall = Object.keys(policy.skillAIPolicyStats()?.packs || {});

				policy.installSkillAIPolicyPack(packModule.pack);
				rec.hookAfterReinstall = typeof lib.skill.drlt_zhengu.onChooseTarget;
				rec.fuyinAfterReinstall = lib.skill.xinfu_fuyin?.ai?.effect?.target?.__djscSkillPolicy || null;
				rec.qianjieAfterReinstall = lib.skill.drlt_qianjie?.ai?.effect?.target?.__djscSkillPolicy || null;
				rec.kongshengAfterReinstall = lib.skill.olkongsheng?.cost?.__djscSkillPolicy || null;

				policy.uninstallSkillAIPolicies();
				rec.hookAfterFullUninstall = typeof lib.skill.drlt_zhengu.onChooseTarget;
				rec.fuyinAfterFullUninstall = lib.skill.xinfu_fuyin?.ai?.effect?.target?.__djscSkillPolicy || null;
				rec.kongshengAfterFullUninstall = lib.skill.olkongsheng?.cost?.__djscSkillPolicy || null;
				rec.stateAfterFullUninstall = policy.skillAIPolicyStats()?.installation?.state;

				policy.installSkillAIPolicies();
				rec.hookAfterFullReinstall = typeof lib.skill.drlt_zhengu.onChooseTarget;
				rec.fuyinAfterFullReinstall = lib.skill.xinfu_fuyin?.ai?.effect?.target?.__djscSkillPolicy || null;
				rec.qianjieAfterFullReinstall = lib.skill.drlt_qianjie?.ai?.effect?.target?.__djscSkillPolicy || null;
				rec.kongshengAfterFullReinstall = lib.skill.olkongsheng?.cost?.__djscSkillPolicy || null;
				rec.stateAfterFullReinstall = policy.skillAIPolicyStats()?.installation?.state;
				rec.packsAfter = Object.keys(policy.skillAIPolicyStats()?.packs || {});
			});
		}

		return { installState, scenes, hostVersion: lib.version, mode: get.mode(), players: game.players.length };
	}, options);
}
