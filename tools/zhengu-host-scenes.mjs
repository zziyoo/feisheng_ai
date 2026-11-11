/*
 * 镇骨专项真实宿主场景：固定公开手牌，观察 chooseTarget 的有效评分、是否发动、
 * 首次/第二次同步的实际手牌变化，以及安装/卸载/共存行为。
 * 只做测试观察；不使用生产代码里没有的钩子。
 */
export async function runZhenguScenes(page, options = {}) {
	return page.evaluate(async opts => {
		const policyInstalled = !!opts.installPolicy;
		let policy = null;
		if (policyInstalled) {
			policy = await import('/extension/无名AI/score/decision/skills/skillAIPolicies.js?v=41a');
			policy.installSkillAIPolicies();
		}
		const { game, lib, get, _status } = realHost;
		const roster = game.players.slice();
		if (roster.length < 4) throw new Error('镇骨场景需要至少4名角色，当前 ' + roster.length);
		const [actor, ally, enemy1, enemy2] = roster;
		const rosterGroups = roster.map(p => p.group);
		const nameOf = p => p && (p.playerid + ':' + (p.name1 || p.name || '?'));
		const card = (name, suit = 'spade', number = 1) => game.createCard(name, suit, number);
		const hand = p => p.getCards('h').map(c => c.name);
		const reset = async () => {
			try {
				if (game.players.length !== roster.length || roster.some(p => !game.players.includes(p))) {
					game.players.splice(0, game.players.length, ...roster);
				}
			} catch (e) {}
			for (const p of roster) {
				try {
					const expansions = p.getCards('x');
					if (expansions.length) await p.loseToDiscardpile(expansions);
				} catch (e) {}
				try {
					for (const skill of Object.keys(p.tempSkills || {})) {
						try { p.removeSkill(skill); } catch (e) {}
					}
				} catch (e) {}
				p.clearSkills(true);
				try {
					const remaining = p.getSkills(null, false, false).filter(skill => lib.skill[skill] && lib.skill[skill].superCharlotte);
					if (remaining.length) p.removeSkill(remaining);
				} catch (e) {}
				try {
					p.dead = false;
					p.removed = false;
					p.classList.remove('dead');
					p.classList.remove('out');
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
				try { if (p.isLinked && p.isLinked()) await p.link(false); } catch (e) {}
				for (const key of Object.keys(p.storage || {})) delete p.storage[key];
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
		const giveCount = async (player, count) => {
			const suits = ['spade', 'heart', 'club', 'diamond'];
			await give(player, Array.from({ length: count }, (_, i) => [i % 3 === 0 ? 'shan' : 'sha', suits[i % 4], (i % 13) + 1]));
		};
		const clearHands = async () => {
			for (const p of roster) {
				const cards = p.getCards('h');
				if (cards.length) await p.discard(cards);
			}
		};
		const handCounts = () => Object.fromEntries(roster.map(p => [p.playerid, p.countCards('h')]));
		const run = async (name, player, content, skill) => {
			const event = game.createEvent(name, false);
			if (player) event.player = player;
			if (skill) event.skill = skill;
			event.setContent(content);
			await game.loop(event);
			return event;
		};
		const firePhaseEnd = async player => {
			await run('phase', player, async event => {
				await event.trigger('phaseEnd');
			});
		};
		const captureChoices = (player, predicate) => {
			const records = [];
			const original = player.chooseTarget;
			player.chooseTarget = function (...args) {
				const evt = original.apply(this, args);
				let parent = null;
				try { parent = evt.getParent?.(); } catch (e) {}
				const rec = { event: evt, parentSkill: parent?.skill || null, scores: [], result: null, snapshot: {}, aiThrew: null };
				if (!predicate || predicate(rec, parent)) {
					let currentAI = evt.ai;
					try {
						Object.defineProperty(evt, 'ai', {
							configurable: true,
							get() { return currentAI; },
							set(fn) {
								if (typeof fn === 'function') {
									currentAI = function (target) {
										let score;
										try {
											score = fn.apply(this, arguments);
										} catch (e) {
											rec.aiThrew = String((e && e.message) || e);
											throw e;
										}
										if (rec.scores.length < 240) rec.scores.push({ target: nameOf(target), score });
										return score;
									};
								} else {
									currentAI = fn;
								}
							},
						});
					} catch (e) {
						rec.defineError = String((e && e.message) || e);
					}
					try {
						const originalForResult = evt.forResult;
						evt.forResult = async function (...inner) {
							const result = await originalForResult.apply(this, inner);
							rec.result = {
								bool: !!result?.bool,
								targets: (result?.targets || []).map(nameOf),
								cancel: result?.bool === false,
							};
							rec.snapshot = {
								prompt: typeof evt.prompt === 'string' ? evt.prompt : null,
								prompt2: typeof evt.prompt2 === 'string' ? evt.prompt2 : null,
								selectTarget: evt.selectTarget,
								forced: !!evt.forced,
								filterTargetType: typeof evt.filterTarget,
							};
							return result;
						};
					} catch (e) {}
					records.push(rec);
				}
				return evt;
			};
			return {
				records,
				restore() { player.chooseTarget = original; },
			};
		};
		const effectiveScores = rec => {
			const map = new Map();
			for (const item of rec?.scores || []) {
				if (!item || item.target == null) continue;
				map.set(item.target, item.score);
			}
			return [...map.entries()].map(([target, score]) => ({ target, score }));
		};
		const scenes = [];
		const zhenguInfo = lib.skill && lib.skill.drlt_zhengu;
		const installState = {
			policyInstalled,
			hostVersion: lib.version,
			mode: get.mode(),
			players: game.players.length,
			hasSkill: !!zhenguInfo,
			costHasOldFormula: !!zhenguInfo && /Math\.min\(\s*5\s*,\s*player2\.countCards\(["']h["']\)\s*\)\s*-\s*target\.countCards\(["']h["']\)/.test(String(zhenguInfo.cost)),
			costHasNativeFormula: !!zhenguInfo && /ownHand\s*<\s*targetHand/.test(String(zhenguInfo.cost)),
			onChooseTarget: !!(zhenguInfo && zhenguInfo.onChooseTarget),
			stats: policy ? policy.skillAIPolicyStats() : null,
		};

		const matrix = async (label, own, targetCount, relation) => {
			await reset();
			await clearHands();
			await giveCount(actor, own);
			const targetPlayer = relation === 'ally' ? ally : enemy1;
			await giveCount(targetPlayer, targetCount);
			if (relation === 'enemy') {
				await giveCount(ally, 10);
				await giveCount(enemy2, 1);
			} else {
				await giveCount(enemy1, 1);
				await giveCount(enemy2, 1);
			}
			actor.addSkill('drlt_zhengu');
			actor.update();
			const attitude = get.attitude(actor, targetPlayer);
			const cap = captureChoices(actor, rec => rec.parentSkill === 'drlt_zhengu');
			const before = handCounts();
			const rec = { name: label, relation, own, target: targetCount, targetPlayer: nameOf(targetPlayer), attitude };
			try {
				await actor.phaseJieshu();
				const costRecord = cap.records[0] || null;
				rec.costEvents = cap.records.length;
				rec.scores = effectiveScores(costRecord);
				rec.targetScore = rec.scores.find(item => item.target === rec.targetPlayer)?.score ?? null;
				rec.choice = costRecord?.result || null;
				rec.costSnapshot = costRecord?.snapshot || null;
				rec.aiThrew = costRecord?.aiThrew || null;
				rec.afterCost = handCounts();
				const storage = actor.getStorage('drlt_zhengu_mark') || [];
				rec.markAfterCost = storage.includes(targetPlayer);
				rec.markSkillAfterCost = actor.hasSkill('drlt_zhengu_mark');
				await firePhaseEnd(actor);
				rec.afterFirstSync = handCounts();
				rec.firstDelta = rec.afterFirstSync[targetPlayer.playerid] - before[targetPlayer.playerid];
			} finally {
				cap.restore();
			}
			scenes.push(rec);
		};

		for (const [label, own, targetCount] of [['710e', 7, 6], ['608e', 6, 8], ['301e', 3, 1], ['305e', 3, 5]]) {
			await matrix(label, own, targetCount, 'enemy');
		}
		for (const [label, own, targetCount] of [['710a', 7, 6], ['608a', 6, 8], ['301a', 3, 1], ['305a', 3, 5]]) {
			await matrix(label, own, targetCount, 'ally');
		}

		/* 同手牌数的友/敌同时存在：旧式评分偏向敌方，修正后两方都是 0 预期。 */
		await (async () => {
			await reset();
			await clearHands();
			await giveCount(actor, 7);
			await giveCount(ally, 6);
			await giveCount(enemy1, 6);
			await giveCount(enemy2, 1);
			actor.addSkill('drlt_zhengu');
			actor.update();
			const cap = captureChoices(actor, rec => rec.parentSkill === 'drlt_zhengu');
			const rec = { name: '710-mixed', attitudeAlly: get.attitude(actor, ally), attitudeEnemy: get.attitude(actor, enemy1) };
			try {
				await actor.phaseJieshu();
				const costRecord = cap.records[0] || null;
				rec.scores = effectiveScores(costRecord);
				rec.choice = costRecord?.result || null;
				rec.markAfterCost = (actor.getStorage('drlt_zhengu_mark') || []).includes(enemy1);
				await firePhaseEnd(actor);
				rec.afterFirstSync = handCounts();
			} finally {
				cap.restore();
			}
			scenes.push(rec);
		})();

		/* 第二次同步：首次同步后改变手牌，再触发标记目标自己的回合结束。 */
		await (async () => {
			await reset();
			await clearHands();
			await giveCount(actor, 3);
			await giveCount(ally, 1);
			await giveCount(enemy1, 1);
			await giveCount(enemy2, 1);
			actor.addSkill('drlt_zhengu');
			actor.update();
			const rec = { name: 'second-sync', actorId: actor.playerid, targetId: ally.playerid };
			const cap = captureChoices(actor, r => r.parentSkill === 'drlt_zhengu');
			try {
				await actor.phaseJieshu();
				rec.choice = cap.records[0]?.result || null;
				rec.markBeforeFirst = (actor.getStorage('drlt_zhengu_mark') || []).includes(ally);
				await firePhaseEnd(actor);
				rec.handsAfterFirst = handCounts();
				await giveCount(actor, 2);
				rec.handsBeforeSecond = handCounts();
				await firePhaseEnd(ally);
				rec.handsAfterSecond = handCounts();
				rec.markAfterSecond = (actor.getStorage('drlt_zhengu_mark') || []).includes(ally);
				rec.markSkillAfterSecond = actor.hasSkill('drlt_zhengu_mark');
				await firePhaseEnd(ally);
				rec.handsAfterThird = handCounts();
			} finally {
				cap.restore();
			}
			scenes.push(rec);
		})();

		/* 先取消一次（7/6 友方，所有配置都不值得发动），再重新触发并正常结算。 */
		await (async () => {
			await reset();
			await clearHands();
			await giveCount(actor, 7);
			await giveCount(ally, 6);
			await giveCount(enemy1, 1);
			await giveCount(enemy2, 1);
			actor.addSkill('drlt_zhengu');
			actor.update();
			const rec = { name: 'cancel-retry' };
			const cap1 = captureChoices(actor, r => r.parentSkill === 'drlt_zhengu');
			try {
				await actor.phaseJieshu();
				rec.firstChoice = cap1.records[0]?.result || null;
				rec.firstMark = (actor.getStorage('drlt_zhengu_mark') || []).includes(ally);
				rec.firstHands = handCounts();
				await firePhaseEnd(actor);
				rec.firstHandsAfterEnd = handCounts();
			} finally {
				cap1.restore();
			}
			await reset();
			await clearHands();
			await giveCount(actor, 3);
			await giveCount(ally, 1);
			await giveCount(enemy1, 1);
			await giveCount(enemy2, 1);
			actor.addSkill('drlt_zhengu');
			actor.update();
			const cap2 = captureChoices(actor, r => r.parentSkill === 'drlt_zhengu');
			try {
				await actor.phaseJieshu();
				rec.secondChoice = cap2.records[0]?.result || null;
				const before = ally.countCards('h');
				await firePhaseEnd(actor);
				rec.secondDelta = ally.countCards('h') - before;
				rec.secondMark = (actor.getStorage('drlt_zhengu_mark') || []).includes(ally);
			} finally {
				cap2.restore();
			}
			scenes.push(rec);
		})();

		/* 两个玩家都有镇骨：同一份 onChooseTarget 必须按各自事件生效，互不串场。 */
		await (async () => {
			await reset();
			await clearHands();
			await giveCount(actor, 7);
			await giveCount(ally, 7);
			await giveCount(enemy1, 6);
			await giveCount(enemy2, 1);
			actor.addSkill('drlt_zhengu');
			ally.addSkill('drlt_zhengu');
			actor.update();
			ally.update();
			const rec = { name: 'two-users' };
			const capActor = captureChoices(actor, r => r.parentSkill === 'drlt_zhengu');
			const capAlly = captureChoices(ally, r => r.parentSkill === 'drlt_zhengu');
			try {
				await actor.phaseJieshu();
				rec.actorChoice = capActor.records[0]?.result || null;
				rec.actorScores = effectiveScores(capActor.records[0]);
				rec.actorMark = (actor.getStorage('drlt_zhengu_mark') || []).map(nameOf);
				await ally.phaseJieshu();
				rec.allyChoice = capAlly.records[0]?.result || null;
				rec.allyScores = effectiveScores(capAlly.records[0]);
				rec.allyMark = (ally.getStorage('drlt_zhengu_mark') || []).map(nameOf);
				await firePhaseEnd(actor);
				await firePhaseEnd(ally);
				rec.handsAfterSync = handCounts();
			} finally {
				capActor.restore();
				capAlly.restore();
			}
			scenes.push(rec);
		})();

		/* 其他技能/裸事件里的 chooseTarget：父事件 skill 不是镇骨，评分必须原样保留。 */
		await (async () => {
			await reset();
			await clearHands();
			await giveCount(actor, 7);
			await giveCount(enemy1, 6);
			actor.addSkill('drlt_zhengu');
			actor.update();
			const rec = { name: 'foreign-choice-target' };
			const cap = captureChoices(actor, r => r.parentSkill === 'probeSkill');
			try {
				await run('probeSkill', actor, async () => {
					await actor.chooseTarget('probe', [0, 1]).set('ai', () => 0.125).forResult();
				}, 'probeSkill');
				rec.events = cap.records.length;
				rec.scores = effectiveScores(cap.records[0]);
				rec.choice = cap.records[0]?.result || null;
			} finally {
				cap.restore();
			}
			scenes.push(rec);
		})();

		/* 同名的技能事件里多次 chooseTarget：每次事件独立替换，不应残留或只生效一次。 */
		await (async () => {
			await reset();
			await clearHands();
			await giveCount(actor, 7);
			await giveCount(enemy1, 6);
			actor.addSkill('drlt_zhengu');
			actor.update();
			const rec = { name: 'same-event-multi-choice' };
			const cap = captureChoices(actor, r => r.parentSkill === 'drlt_zhengu');
			try {
				await run('drlt_zhengu_probe', actor, async () => {
					await actor.chooseTarget('probeA', lib.filter.notMe).set('selectTarget', [1, 1]).set('ai', () => 0.25).forResult();
					await actor.chooseTarget('probeB', lib.filter.notMe).set('selectTarget', [1, 1]).set('ai', () => 0.5).forResult();
				}, 'drlt_zhengu');
				rec.events = cap.records.length;
				rec.scores = cap.records.map((item, index) => ({ index, scores: effectiveScores(item), choice: item.result }));
			} finally {
				cap.restore();
			}
			scenes.push(rec);
		})();

		/* 外部扩展包装 player.chooseTarget：镇骨接线仍应生效，且外部包装不被移除。 */
		await (async () => {
			await reset();
			await clearHands();
			await giveCount(actor, 7);
			await giveCount(enemy1, 6);
			await giveCount(ally, 10);
			await giveCount(enemy2, 1);
			actor.addSkill('drlt_zhengu');
			actor.update();
			const original = actor.chooseTarget;
			let externalHits = 0;
			actor.chooseTarget = function (...inner) {
				const evt = original.apply(this, inner);
				externalHits++;
				try { evt.__externalProbe = true; } catch (e) {}
				return evt;
			};
			const cap = captureChoices(actor, r => r.parentSkill === 'drlt_zhengu');
			const rec = { name: 'external-chooseTarget-wrapper' };
			try {
				await actor.phaseJieshu();
				rec.externalHits = externalHits;
				rec.externalMarker = !!cap.records[0]?.event?.__externalProbe;
				rec.choice = cap.records[0]?.result || null;
				rec.scores = effectiveScores(cap.records[0]);
			} finally {
				cap.restore();
				actor.chooseTarget = original;
			}
			scenes.push(rec);
		})();

		/* AI 回调异常：只验证本扩展在自身计算抛错时回退到宿主回调，不吞掉宿主的异常。 */
		if (policyInstalled) {
			await reset();
			await clearHands();
			await giveCount(actor, 7);
			const rec = { name: 'ai-callback-exception' };
			try {
				await run('probe', actor, async () => {
					const hook = lib.skill.drlt_zhengu.onChooseTarget;
					rec.hookType = typeof hook;
					if (typeof hook !== 'function') {
						rec.skipped = 'no-hook';
						return;
					}
					let originalCalls = 0;
					const fakeEvent = {
						getParent: () => ({ skill: 'drlt_zhengu' }),
						ai: () => { originalCalls++; return 7; },
					};
					hook(fakeEvent, actor);
					rec.aiReplaced = fakeEvent.ai !== undefined && fakeEvent.ai !== null;
					const badTarget = { countCards() { throw new Error('boom'); } };
					let thrown = null;
					let value = null;
					try { value = fakeEvent.ai(badTarget); } catch (e) { thrown = String((e && e.message) || e); }
					rec.originalCalls = originalCalls;
					rec.value = value;
					rec.thrown = thrown;
				});
			} catch (e) {
				rec.sceneError = String((e && e.message) || e);
			}
			scenes.push(rec);
		}

		/* 第三方钩子冲突：安装前被占用 / 安装后被替换。
		 * 验收重点是不破坏其他扩展、不误删他人钩子、不卡死；修复是否仍然生效属于已知 P2 降级。 */
		if (policyInstalled) {
			const conflictRunChoice = async () => {
				await reset();
				await clearHands();
				await giveCount(actor, 7);
				await giveCount(enemy1, 6);
				await giveCount(ally, 10);
				await giveCount(enemy2, 1);
				actor.addSkill('drlt_zhengu');
				actor.update();
				const cap = captureChoices(actor, r => r.parentSkill === 'drlt_zhengu');
				try {
					await actor.phaseJieshu();
					return { choice: cap.records[0]?.result || null, scores: effectiveScores(cap.records[0]) };
				} finally { cap.restore(); }
			};
			const conflictPack = await import('/extension/无名AI/score/decision/skills/packs/shenhuaLei.js?v=41a');
			const externalHook = function () { return 'external-hook'; };

			/* 安装前被其他扩展占用 */
			const preRec = { name: 'hook-conflict-preinstall' };
			try {
				policy.uninstallSkillAIPolicyPack('shenhua_lei');
				lib.skill.drlt_zhengu.onChooseTarget = externalHook;
				policy.installSkillAIPolicyPack(conflictPack.pack);
				preRec.hookIsExternal = lib.skill.drlt_zhengu.onChooseTarget === externalHook;
				const stats = policy.skillAIPolicyStats()?.packs?.shenhua_lei || {};
				preRec.conflictCounter = stats.zhenguHookConflict ?? null;
				preRec.zhenguCompatible = stats.zhenguCompatible ?? null;
				preRec.run = await conflictRunChoice();
				policy.uninstallSkillAIPolicyPack('shenhua_lei');
				preRec.externalKeptOnUninstall = lib.skill.drlt_zhengu.onChooseTarget === externalHook;
				try { delete lib.skill.drlt_zhengu.onChooseTarget; } catch (e) {}
				policy.installSkillAIPolicyPack(conflictPack.pack);
				preRec.hookStillExternal = lib.skill.drlt_zhengu.onChooseTarget === externalHook;
				preRec.restored = typeof lib.skill.drlt_zhengu.onChooseTarget;
			} catch (e) { preRec.error = String((e && e.stack) || e); }
			scenes.push(preRec);

			/* 安装后被其他扩展替换 */
			const postRec = { name: 'hook-conflict-postinstall' };
			try {
				lib.skill.drlt_zhengu.onChooseTarget = externalHook;
				postRec.hookIsExternal = lib.skill.drlt_zhengu.onChooseTarget === externalHook;
				postRec.run = await conflictRunChoice();
				policy.uninstallSkillAIPolicyPack('shenhua_lei');
				postRec.externalKeptOnUninstall = lib.skill.drlt_zhengu.onChooseTarget === externalHook;
				try { delete lib.skill.drlt_zhengu.onChooseTarget; } catch (e) {}
				policy.installSkillAIPolicyPack(conflictPack.pack);
				postRec.hookIsExtension = lib.skill.drlt_zhengu.onChooseTarget !== externalHook;
				postRec.restored = typeof lib.skill.drlt_zhengu.onChooseTarget;
			} catch (e) { postRec.error = String((e && e.stack) || e); }
			scenes.push(postRec);
		}

		/* 安装/卸载/重装/外部占用恢复：只覆盖运行时钩子，不依赖重启。 */
		if (policyInstalled) {
			const rec = { name: 'lifecycle' };
			const runChoice = async () => {
				await reset();
				await clearHands();
				await giveCount(actor, 7);
				await giveCount(enemy1, 6);
				await giveCount(ally, 10);
				await giveCount(enemy2, 1);
				actor.addSkill('drlt_zhengu');
				actor.update();
				const cap = captureChoices(actor, r => r.parentSkill === 'drlt_zhengu');
				try {
					await actor.phaseJieshu();
					return {
						choice: cap.records[0]?.result || null,
						scores: effectiveScores(cap.records[0]),
					};
				} finally {
					cap.restore();
				}
			};
			try {
				const packModule = await import('/extension/无名AI/score/decision/skills/packs/shenhuaLei.js?v=41a');
				rec.hookAfterInstall = typeof lib.skill.drlt_zhengu.onChooseTarget;
				rec.installedRun = await runChoice();
				policy.uninstallSkillAIPolicyPack('shenhua_lei');
				rec.hookAfterPackUninstall = typeof lib.skill.drlt_zhengu.onChooseTarget;
				rec.uninstalledRun = await runChoice();
				policy.installSkillAIPolicyPack(packModule.pack);
				rec.hookAfterPackReinstall = typeof lib.skill.drlt_zhengu.onChooseTarget;
				rec.reinstalledRun = await runChoice();
				const external = function () {};
				lib.skill.drlt_zhengu.onChooseTarget = external;
				policy.uninstallSkillAIPolicyPack('shenhua_lei');
				rec.externalKeptOnUninstall = lib.skill.drlt_zhengu.onChooseTarget === external;
				delete lib.skill.drlt_zhengu.onChooseTarget;
				policy.installSkillAIPolicyPack(packModule.pack);
				rec.hookAfterSecondReinstall = typeof lib.skill.drlt_zhengu.onChooseTarget;
				policy.uninstallSkillAIPolicies();
				rec.hookAfterFullUninstall = typeof lib.skill.drlt_zhengu.onChooseTarget;
				rec.olkongshengAfterFullUninstall = !!(lib.skill.olkongsheng?.cost?.__djscSkillPolicy);
				policy.installSkillAIPolicies();
				rec.hookAfterFullReinstall = typeof lib.skill.drlt_zhengu.onChooseTarget;
				rec.olkongshengAfterFullReinstall = lib.skill.olkongsheng?.cost?.__djscSkillPolicy || null;
				rec.fuyinAfterFullReinstall = lib.skill.xinfu_fuyin?.ai?.effect?.target?.__djscSkillPolicy || null;
				rec.qianjieAfterFullReinstall = lib.skill.drlt_qianjie?.ai?.effect?.target?.__djscSkillPolicy || null;
				rec.fullReinstalledRun = await runChoice();
				rec.statsAfterFullReinstall = policy.skillAIPolicyStats();
			} catch (e) {
				rec.error = String((e && e.stack) || e);
			}
			scenes.push(rec);
		}

		return { installState, scenes, hostVersion: lib.version, mode: get.mode(), players: game.players.length };
	}, options);
}
