import assert from 'node:assert/strict';

// 真实宿主技能AI场景：只固定公开局面，不替换 Player/GameEvent/技能实现。
// 每个场景在同一个根事件内完成“清场→布置→宿主AI选择→宿主结算”，避免跨事件串场。
export async function runSkillAiScenes(page, options = {}) {
	const report = await page.evaluate(async opts => {
		const installExtension = !!opts.installExtension;
		let policyModule = null;
		if (opts.policyOnly) {
			policyModule = await import('/extension/无名AI/score/decision/skills/skillAIPolicies.js?v=41a');
			policyModule.installSkillAIPolicies();
		}
		if (installExtension) {
			const score = await import('/extension/无名AI/score/index.js?v=41a');
			score.installScoreEngine();
			policyModule = await import('/extension/无名AI/score/decision/skills/skillAIPolicies.js?v=41a');
			await new Promise(resolve => setTimeout(resolve, 500));
		}
		try { window.__skillAiPolicies = policyModule; } catch (e) {}
		const { game, lib, get, _status } = realHost;
		const [actor, ally, enemy1, enemy2] = game.players;
		const roster = game.players.slice();
		const rosterGroups = roster.map(p => p.group);
		const run = async (name, player, content) => {
			const event = game.createEvent(name, false);
			event.player = player;
			event.setContent(content);
			await game.loop(event);
		};
		const card = (name, suit = 'spade', number = 1) => game.createCard(name, suit, number);
		const hand = player => player.getCards('h').map(c => c.name);
		const counts = () => Object.fromEntries(game.players.map(p => [p.playerid, p.countCards('h')]));
		const links = () => Object.fromEntries(game.players.map(p => [p.playerid, p.isLinked()]));
		const describePlayer = p => ({
			id: p.playerid,
			name: p.name1 || p.name || '?',
			identity: p.identity,
			hp: p.hp,
			hand: p.countCards('h'),
			linked: p.isLinked(),
			attitude: get.attitude(actor, p),
		});
		const captureTiesuoTargets = player => {
			const targets = [];
			const originalUseCard = player.useCard;
			player.useCard = function (cardInfo, cards, cardTargets, skill) {
				try {
					if (cardInfo && cardInfo.name === 'tiesuo') targets.push((cardTargets || []).slice());
				} catch (e) {}
				return originalUseCard.apply(this, arguments);
			};
			return {
				targets,
				restore() { player.useCard = originalUseCard; },
			};
		};
		const linkPlayers = async list => {
			for (const player of list) {
				if (!player.isLinked()) await player.link(true);
				player.update();
			}
		};
		const nameOf = p => p.playerid + ':' + (p.name1 || p.name || '?');
		const reset = async () => {
			try {
				if (game.players.length !== roster.length || roster.some(p => !game.players.includes(p))) {
					game.players.splice(0, game.players.length, ...roster);
				}
			} catch (e) {}
			for (const p of roster) {
				// 先清空武将牌上的牌，再移除技能；不屈等技能的 onremove 会读取这些牌。
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
		const snapshot = () => ({
			hp: Object.fromEntries(game.players.map(p => [p.playerid, p.hp])),
			hand: Object.fromEntries(game.players.map(p => [p.playerid, hand(p)])),
			skills: Object.fromEntries(game.players.slice(0, 4).map(p => [p.playerid, p.getSkills().filter(s => lib.skill[s] && !lib.skill[s].charlotte)])),
		});
		const recordChoice = result => ({
			bool: !!result.bool,
			skill: result.skill || null,
			cards: (result.cards || []).map(c => c.name),
			targets: (result.targets || []).map(nameOf),
		});
		const scenes = [];
		const wanted = Array.isArray(opts.scenes) && opts.scenes.length ? new Set(opts.scenes) : null;
		const scene = async (name, setup, action) => {
			if (wanted && !wanted.has(name)) return;
			const rec = { name };
			const startedAt = performance.now();
			await run('skillAiScene', actor, async () => {
				await reset();
				await setup(rec);
				rec.before = snapshot();
				rec.relations = {
					actorToAlly: get.attitude(actor, ally),
					actorToEnemy1: get.attitude(actor, enemy1),
					actorToEnemy2: get.attitude(actor, enemy2),
				};
				await action(rec);
				rec.after = snapshot();
				try {
					rec.uiSelected = {
						cards: (realHost.ui.selected.cards || []).map(c => c.name),
						targets: (realHost.ui.selected.targets || []).map(nameOf),
					};
				} catch (e) { rec.uiSelected = null; }
			});
			rec.durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
			scenes.push(rec);
		};
		const describeArgs = args => args.map(a => {
			if (Array.isArray(a)) return a.map(c => c && (c.name || c.playerid || c));
			if (a && get.itemtype && get.itemtype(a) === 'player') return 'P:' + a.playerid;
			if (a && a.name) return a.name;
			return a;
		});
		const instrument = player => {
			const log = [];
			const backups = {};
			for (const method of ['discard', 'lose', 'draw', 'useSkill', 'useCard', 'gain', 'loseHp', 'damage', 'recover', 'recast']) {
				if (typeof player[method] !== 'function') continue;
				backups[method] = player[method];
				player[method] = function (...args) {
					if (log.length < 100) log.push({ op: method, args: describeArgs(args) });
					return backups[method].apply(this, args);
				};
			}
			return { log, restore() { for (const [name, fn] of Object.entries(backups)) player[name] = fn; } };
		};
		const clearHand = async player => {
			const cards = player.getCards('h');
			if (cards.length) await player.discard(cards);
		};
		const phaseTurn = async rec => {
			const probe = instrument(actor);
			try { await actor.phaseUse(); } finally { probe.restore(); }
			rec.ops = probe.log;
			rec.turn = {
				hand: hand(actor), hp: actor.hp, maxHp: actor.maxHp,
				armor: actor.getEquip(2)?.name || null,
				dead: game.dead.map(p => p.playerid),
			};
		};
		const choosePhase = async (rec, extra = {}) => {
			_status.currentPhase = actor;
			const result = await actor.chooseToUse(Object.assign({ type: 'phase', filterCard: () => true, filterTarget: () => false }, extra));
			rec.choice = recordChoice(result);
			if (result.bool) await actor.useResult(result);
			return result;
		};

		// 1) 仁德：目标评分是否考虑敌我；敌人空手、队友3手。
		await scene('rende-target', async () => {
			actor.addSkill('rende');
			actor.storage.rende = 0;
			actor.hp = 3;
			actor.maxHp = 4;
			await give(actor, [['wuxie', 'spade', 2], ['wuxie', 'heart', 3]]);
			await give(ally, [['sha', 'club', 4], ['sha', 'club', 5], ['sha', 'club', 6]]);
			actor.update();
		}, async rec => { await choosePhase(rec); });

		// 2) 突袭：只有队友有手牌时，原生AI是否仍偷队友并跳过摸牌。
		await scene('tuxi-only-ally', async () => {
			actor.addSkill('tuxi');
			await give(ally, [['sha', 'club', 7], ['shan', 'diamond', 8]]);
		}, async rec => {
			await actor.phaseDraw();
		});

		// 3) 突袭：两个敌人手牌 1/4，原生AI是否按失牌净收益选人。
		await scene('tuxi-mixed-targets', async () => {
			actor.addSkill('tuxi');
			await give(enemy1, [['sha', 'spade', 9]]);
			await give(enemy2, [['sha', 'club', 2], ['shan', 'diamond', 3], ['tao', 'heart', 4], ['wuzhong', 'heart', 5]]);
		}, async rec => {
			await actor.phaseDraw();
			rec.lost = {
				[enemy1.playerid]: 1 - enemy1.countCards('h'),
				[enemy2.playerid]: 4 - enemy2.countCards('h'),
			};
		});

		// 4) 制衡：满血、无可用目标时，原生AI弃哪些牌。
		await scene('zhiheng-cards', async () => {
			actor.addSkill('zhiheng');
			await give(actor, [['sha', 'spade', 10], ['shan', 'diamond', 11], ['tao', 'heart', 12]]);
		}, async rec => { await choosePhase(rec); });

		// 5) 苦肉：3血1手牌，原生AI是否发动；结算后体力/手牌。
		await scene('kurou-3hp', async () => {
			actor.addSkill('kurou');
			actor.hp = 3;
			actor.maxHp = 4;
			await give(actor, [['wuxie', 'spade', 13]]);
			actor.update();
		}, async rec => { await choosePhase(rec); });

		// 6) 缔盟：队友1手、敌人3手，检查原生AI只按公开手牌数量选择。
		await scene('dimeng-swap', async () => {
			actor.addSkill('dimeng');
			await give(actor, [['wuxie', 'spade', 1], ['wuxie', 'heart', 2]]);
			await give(ally, [['sha', 'club', 3]]);
			await give(enemy1, [['sha', 'spade', 4], ['shan', 'diamond', 5], ['tao', 'heart', 6]]);
		}, async rec => { await choosePhase(rec); });

		// 7) 箜声：准备阶段暂存牌集合；结束阶段是否归还。
		await scene('kongsheng-stash', async () => {
			actor.addSkill('kongsheng');
			await give(actor, [['shan', 'diamond', 7], ['tao', 'heart', 8], ['sha', 'spade', 9]]);
		}, async rec => {
			await actor.phaseZhunbei();
			rec.stored = actor.getExpansions('kongsheng2').map(c => c.name);
		});

		// 7b) 周妃旧版箜声：数组中已有牌时，成本AI的数量阈值是否失真。
		await scene('olkongsheng-array-count', async () => {
			actor.addSkill('olkongsheng');
			const expansionEvent = actor.addToExpansion([card('sha', 'spade', 30)], actor, 'give');
			expansionEvent.gaintag.add('olkongsheng');
			await expansionEvent;
			await give(actor, [['wuxie', 'spade', 31], ['wuxie', 'heart', 32], ['wuxie', 'club', 33]]);
			ally.hp = 3;
			ally.maxHp = 4;
			await give(ally, [['sha', 'diamond', 34]]);
			ally.update();
		}, async rec => {
			const costEvent = { skill: 'olkongsheng' };
			await lib.skill.olkongsheng.cost(costEvent, {}, actor);
			rec.selected = (costEvent.result?.cards || []).map(c => c.name);
			rec.expansion = actor.getExpansions('olkongsheng').length;
		});

		await scene('olkongsheng-repeat', async () => {
			actor.addSkill('olkongsheng');
			const expansionEvent = actor.addToExpansion([card('sha', 'spade', 35)], actor, 'give');
			expansionEvent.gaintag.add('olkongsheng');
			await expansionEvent;
			await give(actor, [['wuxie', 'spade', 36], ['wuxie', 'heart', 37], ['wuxie', 'club', 38]]);
			ally.hp = 3; ally.maxHp = 4;
			await give(ally, [['sha', 'diamond', 39]]);
			ally.update();
		}, async rec => {
			const runs = [], scopes = [];
			for (let i = 0; i < 2; i++) {
				const costEvent = { skill: 'olkongsheng' };
				await lib.skill.olkongsheng.cost(costEvent, {}, actor);
				runs.push((costEvent.result?.cards || []).length);
				scopes.push(!actor.getExpansions.__djscOlkongshengScope);
			}
			rec.runs = runs;
			rec.scopeRestored = scopes.every(Boolean);
		});
		await scene('olkongsheng-cost-error', async () => {
			actor.addSkill('olkongsheng');
			const expansionEvent = actor.addToExpansion([card('sha', 'spade', 57)], actor, 'give');
			expansionEvent.gaintag.add('olkongsheng');
			await expansionEvent;
			await give(actor, [['wuxie', 'spade', 58]]);
		}, async rec => {
			const originalChooseCard = actor.chooseCard;
			let threw = false;
			actor.chooseCard = function () { throw new Error('fixture-choose-card'); };
			try { await lib.skill.olkongsheng.cost({ skill: 'olkongsheng' }, {}, actor); }
			catch (e) { threw = true; }
			finally { actor.chooseCard = originalChooseCard; }
			rec.threw = threw;
			rec.scopeRestored = !actor.getExpansions.__djscOlkongshengScope;
		});

		// 8) 标准制衡：1血持闪+桃时，原生AI是否弃闪换牌。
		await scene('zhiheng-lowhp', async () => {
			actor.addSkill('zhiheng');
			actor.hp = 1;
			actor.maxHp = 4;
			await give(actor, [['shan', 'diamond', 2], ['tao', 'heart', 3]]);
			actor.update();
		}, async rec => {
			const log = [];
			const originalDiscard = actor.discard, originalUseSkill = actor.useSkill;
			actor.discard = function (...args) {
				log.push({ op: 'discard', args: args.map(a => Array.isArray(a) ? a.map(c => c.name) : (a && a.name) || a) });
				return originalDiscard.apply(this, args);
			};
			actor.useSkill = function (...args) {
				log.push({ op: 'useSkill', args: args.map(a => typeof a === 'string' ? a : (Array.isArray(a) ? a.map(c => c && (c.name || c.playerid || c)) : a)) });
				return originalUseSkill.apply(this, args);
			};
			try { await choosePhase(rec); } finally { actor.discard = originalDiscard; actor.useSkill = originalUseSkill; }
			rec.ops = log;
		});

		// 9) 界制衡：3血持桃+两杀时，原生AI是否全手换牌（含桃）。
		await scene('rezhiheng-3hp', async () => {
			actor.addSkill('rezhiheng');
			actor.hp = 3;
			actor.maxHp = 4;
			await give(actor, [['tao', 'heart', 4], ['sha', 'spade', 5], ['sha', 'club', 6]]);
			actor.update();
		}, async rec => { await choosePhase(rec); });

		// 9b) 界制衡：4血持桃+两杀时，应保留原生全手换牌（策略只约束低血）。
		await scene('rezhiheng-4hp', async () => {
			actor.addSkill('rezhiheng');
			actor.hp = 4;
			actor.maxHp = 4;
			await give(actor, [['tao', 'heart', 14], ['sha', 'spade', 15], ['sha', 'club', 16]]);
			actor.update();
		}, async rec => { await choosePhase(rec); });

		// 9c) 界鲁肃缔盟：混合后的暗牌选择是否偷看牌面。
		await scene('redimeng-hidden-info', async rec => {
			actor.addSkill('redimeng');
			await give(actor, [['wuxie', 'spade', 17], ['wuxie', 'heart', 18]]);
			await give(ally, [['tao', 'heart', 19]]);
			await give(enemy1, [['sha', 'spade', 20], ['shan', 'diamond', 21], ['wuzhong', 'heart', 22]]);
			rec.mixed = [...hand(ally), ...hand(enemy1)];
		}, async rec => {
			const pay = actor.getCards('h');
			await actor.useSkill('redimeng', pay, [ally, enemy1]);
			rec.gained = { [ally.playerid]: hand(ally), [enemy1.playerid]: hand(enemy1) };
		});

		await scene('redimeng-permute-values', async rec => {
			actor.addSkill('redimeng');
			rec.runs = [];
		}, async rec => {
			const runOnce = async (allyList, enemyList) => {
				await clearHand(actor); await clearHand(ally); await clearHand(enemy1);
				await give(actor, [['wuxie', 'spade', 77], ['wuxie', 'heart', 78]]);
				await give(ally, allyList);
				await give(enemy1, enemyList);
				const pool = [...ally.getCards('h'), ...enemy1.getCards('h')];
				const pm = window.__skillAiPolicies;
				const beforeStats = pm ? pm.skillAIPolicyStats() : null;
				const before = beforeStats && Array.isArray(beforeStats.redimengTrace) ? beforeStats.redimengTrace.length : 0;
				await actor.useSkill('redimeng', actor.getCards('h'), [ally, enemy1]);
				const gained = {
					[ally.playerid]: hand(ally),
					[enemy1.playerid]: hand(enemy1),
				};
				const indices = {
					[ally.playerid]: ally.getCards('h').map(c => pool.indexOf(c)),
					[enemy1.playerid]: enemy1.getCards('h').map(c => pool.indexOf(c)),
				};
				const afterStats = pm ? pm.skillAIPolicyStats() : null;
				const trace = afterStats && Array.isArray(afterStats.redimengTrace) ? afterStats.redimengTrace.slice(before) : [];
				return { gained, indices, trace, fairMasked: !!(pm && afterStats && Array.isArray(afterStats.redimengTrace)) };
			};
			rec.runs.push(await runOnce([['tao', 'heart', 80]], [['sha', 'spade', 81], ['shan', 'diamond', 82], ['wuzhong', 'heart', 83]]));
			rec.runs.push(await runOnce([['sha', 'club', 84]], [['tao', 'diamond', 85], ['wuzhong', 'spade', 86], ['shan', 'heart', 87]]));
		});

		// 8b) 标准制衡完整 phaseUse：低血/桃/闪/混合/击杀/防具。
		const blockNeighborSha = () => {
			for (const index of [1, 7]) {
				const p = game.players[index];
				if (!p) continue;
				p.identity = 'zhong';
				try { p.setIdentity('zhong'); } catch (e) {}
				p.update();
			}
		};
		await scene('zhiheng-full-3hp-max3', async () => {
			blockNeighborSha();
			actor.addSkill('zhiheng');
			actor.hp = 3; actor.maxHp = 3;
			await give(actor, [['tao', 'heart', 40], ['sha', 'spade', 41], ['sha', 'club', 42]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });
		await scene('zhiheng-full-3hp-max4', async () => {
			blockNeighborSha();
			actor.addSkill('zhiheng');
			actor.hp = 3; actor.maxHp = 4;
			await give(actor, [['tao', 'heart', 43], ['sha', 'spade', 44], ['sha', 'club', 45]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });
		await scene('zhiheng-full-1hp-defense', async () => {
			blockNeighborSha();
			actor.addSkill('zhiheng');
			actor.hp = 1; actor.maxHp = 4;
			await give(actor, [['shan', 'diamond', 46], ['tao', 'heart', 47]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });
		await scene('zhiheng-full-1hp-mixed', async () => {
			blockNeighborSha();
			actor.addSkill('zhiheng');
			actor.hp = 1; actor.maxHp = 4;
			await give(actor, [['shan', 'diamond', 48], ['wuxie', 'spade', 49]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });
		await scene('zhiheng-full-armor', async () => {
			blockNeighborSha();
			actor.addSkill('zhiheng');
			actor.hp = 3; actor.maxHp = 3;
			await actor.equip(card('bagua', 'spade', 52));
			await give(actor, [['tao', 'heart', 53], ['sha', 'club', 54]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });
		await scene('zhiheng-full-1hp-max1', async () => {
			blockNeighborSha();
			actor.addSkill('zhiheng');
			actor.hp = 1; actor.maxHp = 1;
			await give(actor, [['shan', 'diamond', 55], ['tao', 'heart', 56]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });

		await scene('rezhiheng-full-3hp-max3', async () => {
			blockNeighborSha();
			actor.addSkill('rezhiheng');
			actor.hp = 3; actor.maxHp = 3;
			await give(actor, [['tao', 'heart', 88], ['sha', 'spade', 89], ['sha', 'club', 90]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });
		await scene('rezhiheng-full-4hp-max4', async () => {
			blockNeighborSha();
			actor.addSkill('rezhiheng');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['tao', 'heart', 91], ['sha', 'spade', 92], ['sha', 'club', 93]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });

		await scene('rezhiheng-full-1hp-max1', async () => {
			blockNeighborSha();
			actor.addSkill('rezhiheng');
			actor.hp = 1; actor.maxHp = 1;
			await give(actor, [['tao', 'heart', 94], ['shan', 'diamond', 95]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });
		await scene('rezhiheng-full-2hp-max2-mixed', async () => {
			blockNeighborSha();
			actor.addSkill('rezhiheng');
			actor.hp = 2; actor.maxHp = 2;
			await give(actor, [['tao', 'heart', 96], ['sha', 'spade', 97], ['sha', 'club', 98]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });
		await scene('rezhiheng-full-2hp-only-tao', async () => {
			blockNeighborSha();
			actor.addSkill('rezhiheng');
			actor.hp = 2; actor.maxHp = 2;
			await give(actor, [['tao', 'heart', 99], ['sha', 'spade', 100]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });
		await scene('rezhiheng-full-2hp-only-shan', async () => {
			blockNeighborSha();
			actor.addSkill('rezhiheng');
			actor.hp = 2; actor.maxHp = 2;
			await give(actor, [['shan', 'diamond', 101], ['sha', 'club', 102]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });
		await scene('rezhiheng-full-3hp-max4-recovery', async () => {
			blockNeighborSha();
			actor.addSkill('rezhiheng');
			actor.hp = 3; actor.maxHp = 4;
			await give(actor, [['tao', 'heart', 103], ['sha', 'spade', 104], ['sha', 'club', 105]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });
		await scene('rezhiheng-full-armor', async () => {
			blockNeighborSha();
			actor.addSkill('rezhiheng');
			actor.hp = 3; actor.maxHp = 3;
			await actor.equip(card('bagua', 'spade', 106));
			await give(actor, [['tao', 'heart', 107], ['sha', 'club', 108]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });

		// 10) 界张辽突袭：三名敌人手牌 1/4/2，原生AI按什么顺序选目标。
		await scene('new-retuxi-order', async rec => {
			const enemy3 = game.players[4];
			enemy3.identity = 'fan';
			try { enemy3.setIdentity('fan'); } catch (e) {}
			enemy3.update();
			actor.addSkill('new_retuxi');
			await give(enemy1, [['sha', 'spade', 7]]);
			await give(enemy2, [['sha', 'club', 8], ['shan', 'diamond', 9], ['tao', 'heart', 10], ['wuzhong', 'heart', 11]]);
			await give(enemy3, [['sha', 'spade', 12], ['shan', 'club', 13]]);
			rec.extra = { enemy3: enemy3.playerid };
		}, async rec => {
			await actor.phaseDraw();
			rec.lost = Object.fromEntries([enemy1, enemy2, game.players[4]].map(p => {
				const before = p.playerid === enemy1.playerid ? 1 : (p.playerid === enemy2.playerid ? 4 : 2);
				return [p.playerid, before - p.countCards('h')];
			}));
		});

		await scene('new-retuxi-special', async () => {
			const enemy3 = game.players[4];
			enemy3.identity = 'fan';
			try { enemy3.setIdentity('fan'); } catch (e) {}
			enemy3.update();
			enemy1.addSkill('tuntian');
			actor.addSkill('new_retuxi');
			await give(enemy1, [['sha', 'spade', 60], ['shan', 'diamond', 61], ['tao', 'heart', 62], ['wuzhong', 'heart', 63]]);
			await give(enemy2, [['sha', 'club', 64], ['shan', 'spade', 65], ['tao', 'diamond', 66]]);
			await give(enemy3, [['sha', 'heart', 67]]);
		}, async rec => {
			await actor.phaseDraw();
			rec.tuntian = enemy1.hasSkill('tuntian');
			rec.lost = Object.fromEntries([enemy1, enemy2, game.players[4]].map(p => [p.playerid, (p === enemy1 ? 4 : p === enemy2 ? 3 : 1) - p.countCards('h')]));
		});
		await scene('new-retuxi-only-ally', async () => {
			actor.addSkill('new_retuxi');
			await give(ally, [['sha', 'club', 68], ['shan', 'diamond', 69]]);
		}, async rec => {
			await actor.phaseDraw();
			rec.allyHand = hand(ally);
			rec.actorHand = hand(actor);
		});
		await scene('new-retuxi-single', async () => {
			actor.addSkill('new_retuxi');
			await give(enemy1, [['sha', 'spade', 70], ['shan', 'diamond', 71], ['tao', 'heart', 72]]);
		}, async rec => {
			await actor.phaseDraw();
			rec.enemyLost = 3 - enemy1.countCards('h');
			rec.actorHand = hand(actor);
		});
		await scene('new-retuxi-neutral', async () => {
			enemy1.identity = 'nei';
			try { enemy1.setIdentity('nei'); } catch (e) {}
			enemy1.update();
			actor.addSkill('new_retuxi');
			await give(enemy1, [['sha', 'spade', 73], ['shan', 'diamond', 74], ['tao', 'heart', 75], ['wuzhong', 'heart', 76]]);
		}, async rec => {
			await actor.phaseDraw();
			rec.enemyLost = 4 - enemy1.countCards('h');
			rec.attitude = get.attitude(actor, enemy1);
		});
		await scene('new-retuxi-zero', async () => {
			actor.addSkill('new_retuxi');
		}, async rec => {
			await actor.phaseDraw();
			rec.actorHand = hand(actor);
		});

		// === 第二批：生命支付与爆发时机（只固定公开局面，不伪造AI手牌/摸牌） ===
		const hpTarget = (index, hp, maxHp = 4) => {
			const target = game.players[index] || enemy2;
			target.identity = 'fan';
			try { target.setIdentity('fan'); } catch (e) {}
			target.hp = hp;
			target.maxHp = maxHp;
			target.update();
			return target;
		};
		const equipWeapon = async (target, name = 'zhangba', suit = 'spade', number = 400) => {
			await target.equip(card(name, suit, number));
			target.update();
		};
		const qimouBaseline = target => ({ distance: get.distance(actor, target, 'attack'), attackRange: actor.getAttackRange() });
		const finishQimou = (rec, target, baseline) => {
			const paid = (rec.ops || []).filter(item => item && item.op === 'loseHp').reduce((sum, item) => sum + (Number(item.args && item.args[0]) || 0), 0);
			rec.qimou = {
				paid,
				distanceBefore: baseline.distance,
				attackRange: baseline.attackRange,
				targetId: nameOf(target),
				targetHpBefore: rec.before.hp[target.playerid],
				targetHpAfter: target.hp,
				targetDead: !!target.dead,
				reachableAfter: baseline.distance - paid <= baseline.attackRange,
				enemyHpLoss: (() => {
					const enemies = new Set(game.players.filter(p => p !== actor && p !== ally));
					if (target !== actor && target !== ally) enemies.add(target);
					return [...enemies].reduce((sum, p) => sum + Math.max(0, Number(rec.before.hp[p.playerid]) - (p.dead ? 0 : p.hp)), 0);
				})(),
				shaUses: (rec.ops || []).filter(item => item && item.op === 'useCard' && item.args && item.args[0] === 'sha').length,
				actorHpBefore: rec.before.hp[actor.playerid],
				actorHpAfter: actor.hp,
				actorAlive: !actor.dead,
			};
			rec.target = { hp: target.hp, dead: !!target.dead };
		};

		// 标准苦肉：4/3/2血与手牌数量的停止边界。
		await scene('hp-kurou-full-4hp-2cards', async () => {
			blockNeighborSha();
			actor.addSkill('kurou');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['wuxie', 'spade', 200], ['sha', 'heart', 201]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });
		await scene('hp-kurou-full-3hp-1card', async () => {
			blockNeighborSha();
			actor.addSkill('kurou');
			actor.hp = 3; actor.maxHp = 4;
			await give(actor, [['wuxie', 'spade', 202]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });
		await scene('hp-kurou-full-3hp-2cards', async () => {
			blockNeighborSha();
			actor.addSkill('kurou');
			actor.hp = 3; actor.maxHp = 4;
			await give(actor, [['wuxie', 'spade', 203], ['sha', 'heart', 204]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });
		await scene('hp-kurou-full-2hp-1card', async () => {
			blockNeighborSha();
			actor.addSkill('kurou');
			actor.hp = 2; actor.maxHp = 4;
			await give(actor, [['wuxie', 'spade', 205]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });

		// 界苦肉+诈降：4/3/2血；诈降摸3和额外出杀必须纳入同一结算。
		for (const [name, hp, hand] of [
			['hp-rekurou-full-4hp-2cards', 4, [['wuxie', 'spade', 206], ['sha', 'heart', 207]]],
			['hp-rekurou-full-3hp-2cards', 3, [['wuxie', 'spade', 208], ['sha', 'heart', 209]]],
			['hp-rekurou-full-2hp-2cards', 2, [['wuxie', 'spade', 210], ['sha', 'heart', 211]]],
		]) {
			await scene(name, async () => {
				blockNeighborSha();
				actor.addSkill('rekurou');
				actor.addSkill('zhaxiang');
				actor.hp = hp; actor.maxHp = 4;
				await give(actor, hand);
				actor.update();
			}, async rec => { await phaseTurn(rec); });
		}
		await scene('hp-rekurou-redsha-directhit', async () => {
			const target = hpTarget(7, 4, 4);
			actor.addSkill('rekurou');
			actor.addSkill('zhaxiang');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'heart', 212], ['wuxie', 'spade', 213]]);
			await give(target, [['shan', 'diamond', 214]]);
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[7]?.hp, hand: roster[7] ? hand(roster[7]) : [] };
			rec.marks = roster[7] ? roster[7].getSkills().filter(s => s.includes('zhaxiang')) : [];
		});

		// 界魏延奇谋：目标在4距离外，手上有3张杀；原生是否因“杀次数仍可用”而不发动。
		await scene('hp-qimou-distance4-hp3', async () => {
			blockNeighborSha();
			const target = hpTarget(4, 3, 4);
			actor.addSkill('qimou');
			actor.addSkill('xinkuanggu');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 215], ['sha', 'heart', 216], ['sha', 'club', 217]]);
			actor.update();
			target.update();
		}, async rec => {
			const target = roster[4];
			const baseline = qimouBaseline(target);
			await phaseTurn(rec);
			finishQimou(rec, target, baseline);
		});
		await scene('hp-qimou-distance4-hp4-negative', async () => {
			blockNeighborSha();
			const target = hpTarget(4, 4, 4);
			actor.addSkill('qimou');
			actor.addSkill('xinkuanggu');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 218], ['sha', 'heart', 219], ['sha', 'club', 220]]);
			actor.update();
			target.update();
		}, async rec => {
			const target = roster[4];
			const baseline = qimouBaseline(target);
			await phaseTurn(rec);
			finishQimou(rec, target, baseline);
		});
		await scene('hp-qimou-distance3-hp2', async () => {
			blockNeighborSha();
			const target = hpTarget(3, 2, 4);
			actor.addSkill('qimou');
			actor.addSkill('xinkuanggu');
			actor.hp = 3; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 221], ['sha', 'heart', 222]]);
			await give(target, [['tao', 'heart', 223]]);
			actor.update();
			target.update();
		}, async rec => {
			const target = roster[3];
			const baseline = qimouBaseline(target);
			await phaseTurn(rec);
			finishQimou(rec, target, baseline);
		});

		// 界魏延奇谋（OL）：默认最大支付，目标是3血/4血+八卦时是否过度支付。
		await scene('hp-reqimou-distance4-hp3', async () => {
			blockNeighborSha();
			const target = hpTarget(4, 3, 4);
			actor.addSkill('reqimou');
			actor.addSkill('xinkuanggu');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 224], ['sha', 'heart', 225]]);
			await give(target, [['tao', 'heart', 226]]);
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[4]?.hp, dead: !!roster[4]?.dead };
		});
		await scene('hp-reqimou-distance4-hp4-defense', async () => {
			blockNeighborSha();
			const target = hpTarget(4, 4, 4);
			await target.equip(card('bagua', 'spade', 227));
			actor.addSkill('reqimou');
			actor.addSkill('xinkuanggu');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 228], ['sha', 'heart', 229]]);
			await give(target, [['shan', 'diamond', 230], ['shan', 'club', 231], ['tao', 'heart', 232]]);
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[4]?.hp, dead: !!roster[4]?.dead };
		});

		// 典韦强袭（qiangxix）：2血击杀、武器替代、3血均势、1血边界。
		await scene('hp-qiangxix-2hp-target1', async () => {
			const target = hpTarget(7, 1, 4);
			actor.addSkill('qiangxix');
			actor.hp = 2; actor.maxHp = 4;
			await give(target, [['tao', 'heart', 233]]);
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[7]?.hp, hand: roster[7] ? hand(roster[7]) : [] };
		});
		await scene('hp-qiangxix-2hp-weapon-target2', async () => {
			const target = hpTarget(7, 2, 4);
			actor.addSkill('qiangxix');
			actor.hp = 2; actor.maxHp = 4;
			await equipWeapon(actor, 'zhangba', 'spade', 234);
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[7]?.hp, dead: !!roster[7]?.dead };
			rec.weapon = actor.getEquips(1).map(c => c.name);
		});
		await scene('hp-qiangxix-3hp-target3', async () => {
			const target = hpTarget(7, 3, 4);
			actor.addSkill('qiangxix');
			actor.hp = 3; actor.maxHp = 4;
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[7]?.hp, dead: !!roster[7]?.dead };
		});
		await scene('hp-qiangxix-2hp-target2-negative', async () => {
			const target = hpTarget(7, 2, 4);
			actor.addSkill('qiangxix');
			actor.hp = 2; actor.maxHp = 4;
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[7]?.hp, dead: !!roster[7]?.dead };
		});
		await scene('hp-qiangxix-1hp-weapon-target2', async () => {
			const target = hpTarget(7, 2, 4);
			actor.addSkill('qiangxix');
			actor.hp = 1; actor.maxHp = 4;
			await equipWeapon(actor, 'zhangba', 'club', 235);
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[7]?.hp, dead: !!roster[7]?.dead };
			rec.weapon = actor.getEquips(1).map(c => c.name);
		});
		await scene('hp-qiangxix-1hp-no-weapon-negative', async () => {
			const target = hpTarget(7, 2, 4);
			actor.addSkill('qiangxix');
			actor.hp = 1; actor.maxHp = 4;
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[7]?.hp, dead: !!roster[7]?.dead };
		});
		await scene('hp-qiangxix-double-target', async rec => {
			const left = hpTarget(1, 2, 4);
			const right = hpTarget(7, 2, 4);
			actor.addSkill('qiangxix');
			actor.hp = 3; actor.maxHp = 4;
			actor.update();
			left.update();
			right.update();
			rec.extra = { left: left.playerid, right: right.playerid };
		}, async rec => {
			await phaseTurn(rec);
			rec.targets = {
				[roster[1].playerid]: roster[1].hp,
				[roster[7].playerid]: roster[7].hp,
			};
		});

		// 界典韦强袭（olqiangxi）：自伤而非失去体力；与武器支付对照。
		await scene('hp-olqiangxi-3hp-target3', async () => {
			const target = hpTarget(7, 3, 4);
			actor.addSkill('olqiangxi');
			actor.hp = 3; actor.maxHp = 4;
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[7]?.hp, dead: !!roster[7]?.dead };
		});
		await scene('hp-olqiangxi-2hp-weapon-target2', async () => {
			const target = hpTarget(7, 2, 4);
			actor.addSkill('olqiangxi');
			actor.hp = 2; actor.maxHp = 4;
			await equipWeapon(actor, 'zhangba', 'heart', 236);
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[7]?.hp, dead: !!roster[7]?.dead };
			rec.weapon = actor.getEquips(1).map(c => c.name);
		});
		await scene('hp-olqiangxi-2hp-target2-negative', async () => {
			const target = hpTarget(7, 2, 4);
			actor.addSkill('olqiangxi');
			actor.hp = 2; actor.maxHp = 4;
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[7]?.hp, dead: !!roster[7]?.dead };
		});
		await scene('hp-olqiangxi-1hp-weapon-target2', async () => {
			const target = hpTarget(7, 2, 4);
			actor.addSkill('olqiangxi');
			actor.hp = 1; actor.maxHp = 4;
			await equipWeapon(actor, 'zhangba', 'diamond', 237);
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[7]?.hp, dead: !!roster[7]?.dead };
			rec.weapon = actor.getEquips(1).map(c => c.name);
		});
		await scene('hp-olqiangxi-1hp-no-weapon-negative', async () => {
			const target = hpTarget(7, 2, 4);
			actor.addSkill('olqiangxi');
			actor.hp = 1; actor.maxHp = 4;
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[7]?.hp, dead: !!roster[7]?.dead };
		});

		// 失去体力 vs 受到伤害 vs 弃装备：用诈降/遗计观察触发差异。
		await scene('hp-qiangxix-losehp-triggers-zhaxiang', async () => {
			const target = hpTarget(7, 2, 4);
			actor.addSkill('qiangxix');
			actor.addSkill('zhaxiang');
			actor.hp = 3; actor.maxHp = 4;
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[7]?.hp, dead: !!roster[7]?.dead };
			rec.zhaxiangEffect = actor.countMark('zhaxiang_effect');
		});
		await scene('hp-olqiangxi-damage-triggers-yiji', async () => {
			const target = hpTarget(7, 2, 4);
			actor.addSkill('olqiangxi');
			actor.addSkill('yiji');
			actor.hp = 3; actor.maxHp = 4;
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[7]?.hp, dead: !!roster[7]?.dead };
			rec.yijiMarks = actor.countMark('yiji');
		});

		// 第二批击杀收尾：放在所有非致死场景之后。
		await scene('hp-qiangxix-final-kill1', async () => {
			const target = hpTarget(7, 1, 4);
			actor.addSkill('qiangxix');
			actor.hp = 2; actor.maxHp = 4;
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[7]?.hp, dead: !!roster[7]?.dead };
		});
		await scene('hp-olqiangxi-final-kill1', async () => {
			const target = hpTarget(7, 1, 4);
			actor.addSkill('olqiangxi');
			actor.hp = 2; actor.maxHp = 4;
			actor.update();
			target.update();
		}, async rec => {
			await phaseTurn(rec);
			rec.target = { hp: roster[7]?.hp, dead: !!roster[7]?.dead };
		});

		await scene('response-wusheng-duel', async () => {
			actor.addSkill('wusheng');
			await give(actor, [['tao', 'heart', 109], ['sha', 'spade', 110]]);
			actor.hp = 4; actor.maxHp = 4;
			actor.update();
		}, async rec => {
			const before = { hp: actor.hp, hand: hand(actor) };
			await enemy1.useCard(card('juedou', 'spade', 111), actor);
			rec.response = {
				before,
				after: { hp: actor.hp, hand: hand(actor) },
				responded: actor.getHistory('respond').length > 0,
			};
		});

		// 击杀场景放在最后：避免死亡玩家从 game.players 移除后污染后续夹具。
		await scene('rezhiheng-full-kill', async () => {
			actor.addSkill('rezhiheng');
			actor.hp = 3; actor.maxHp = 4;
			const target = game.players[7];
			target.identity = 'fan';
			try { target.setIdentity('fan'); } catch (e) {}
			target.hp = 1;
			target.update();
			await give(actor, [['sha', 'spade', 112], ['sha', 'club', 113]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });
		await scene('zhiheng-full-kill', async () => {
			actor.addSkill('zhiheng');
			actor.hp = 3; actor.maxHp = 4;
			ally.identity = 'fan';
			try { ally.setIdentity('fan'); } catch (e) {}
			ally.hp = 1;
			ally.update();
			await give(actor, [['sha', 'spade', 50], ['sha', 'club', 51]]);
			actor.update();
		}, async rec => { await phaseTurn(rec); });

		/* === 神话再临·风：剩余 11 项登记技能的原生 AI 决策观察 ===
		 * 只固定公开局面并记录宿主技能自身的 AI 选择；不替换技能实现、不读隐藏手牌。 */
		const wrapAIResult = (player, method, callback) => {
			const original = player[method];
			if (typeof original !== 'function') return () => {};
			player[method] = function (...args) {
				const next = original.apply(this, args);
				try {
					if (next && typeof next.forResult === 'function') {
						const originalForResult = next.forResult;
						next.forResult = async function (...forArgs) {
							const result = await originalForResult.apply(this, forArgs);
							try { callback(result); } catch (e) {}
							return result;
						};
					}
				} catch (e) {}
				return next;
			};
			return () => { player[method] = original; };
		};

		// 只固定夹具随机源（判定牌/质疑选择），不改技能或宿主评分。
		const forceJudgeSuit = (players, suit = 'spade') => {
			const backups = new Map();
			const calls = [];
			for (const player of players) {
				if (!player || typeof player.judge !== 'function') continue;
				backups.set(player, player.judge);
				player.judge = function (...args) {
					calls.push(player.playerid);
					const directresult = card('wuxie', suit, 430 + calls.length);
					if (args.length === 1 && typeof args[0] === 'function') {
						return backups.get(player).call(this, { directresult, judge: args[0] });
					}
					if (args.length === 1 && args[0] && typeof args[0] === 'object' && get.itemtype(args[0]) == null) {
						return backups.get(player).call(this, Object.assign({}, args[0], { directresult }));
					}
					if (!args.length) {
						return backups.get(player).call(this, { directresult });
					}
					if (args.length === 2 && typeof args[1] === 'function') {
						return backups.get(player).call(this, { directresult, judge: args[1] });
					}
					return backups.get(player).apply(this, args);
				};
			}
			return { calls, restore() { for (const [player, judge] of backups) player.judge = judge; } };
		};
		const forceGuhuoAnswer = (player, accept) => {
			const original = player.chooseButton;
			if (typeof original !== 'function') return () => {};
			player.chooseButton = function (...args) {
				const next = original.apply(this, args);
				let isGuhuo = false;
				try { isGuhuo = JSON.stringify(args).includes('reguhuo_'); } catch (e) {}
				if (isGuhuo && next && typeof next.set === 'function') {
					const originalSet = next.set;
					next.set = function (key, value) {
						if (key === 'ai') {
							return originalSet.call(this, key, button => {
								const link = button && button.link || [];
								return link[2] === (accept ? 'reguhuo_ally' : 'reguhuo_betray') ? 100 : 0;
							});
						}
						return originalSet.apply(this, arguments);
					};
				}
				return next;
			};
			return () => { player.chooseButton = original; };
		};
		const captureDamage = player => {
			const original = player.damage;
			const events = [];
			player.damage = function (...args) {
				const next = original.apply(this, args);
				events.push(next);
				return next;
			};
			return { events, restore() { player.damage = original; } };
		};
		const captureTempSkill = player => {
			const original = player.addTempSkill;
			const calls = [];
			player.addTempSkill = function (skill, ...args) {
				calls.push({ skill, args: args.map(item => typeof item === 'string' ? item : String(item)) });
				return original.call(this, skill, ...args);
			};
			return { calls, restore() { player.addTempSkill = original; } };
		};
		const guhuoBackup = declared => lib.skill.xinfu_guhuo.chooseButton.backup([[declared]], actor);
		const guhuoUse = async hidden => {
			const declare = 'sha';
			const backup = guhuoBackup(declare);
			lib.skill.xinfu_guhuo_backup = backup;
			await backup.precontent({ result: { cards: [hidden], card: { name: declare, isCard: true } }, skill: 'xinfu_guhuo_backup' }, {}, actor);
			const useEvent = actor.useCard({ name: declare, isCard: true }, [hidden], [enemy1], 'xinfu_guhuo_backup');
			await useEvent;
			return useEvent;
		};
		const runWithMathRandom = async (value, callback) => {
			const original = Math.random;
			Math.random = () => value;
			try { return await callback(); } finally { Math.random = original; }
		};

		await scene('shenhua-releiji-target', async rec => {
			actor.addSkill('releiji');
			await give(actor, [['shan', 'heart', 301]]);
			rec.before = { actor: snapshot(actor), ally: snapshot(ally), enemy1: snapshot(enemy1) };
		}, async rec => {
			const event = { skill: 'releiji' };
			const trigger = { card: { name: 'shan' }, player: actor };
			const targets = [];
			const restore = wrapAIResult(actor, 'chooseTarget', result => { targets.push((result.targets || []).map(nameOf)); });
			const judges = forceJudgeSuit(game.players, 'spade');
			const damages = game.players.map(player => captureDamage(player));
			try {
				await lib.skill.releiji.cost(event, trigger, actor);
				rec.selected = (event.result && event.result.targets || []).map(nameOf);
				if (event.result && event.result.bool && event.result.targets && event.result.targets.length) {
					await lib.skill.releiji.content({ skill: 'releiji', targets: event.result.targets, result: event.result }, trigger, actor);
				}
			} finally {
				damages.forEach(item => item.restore()); judges.restore(); restore();
			}
			rec.targets = targets;
			rec.judges = judges.calls;
			rec.damage = damages.flatMap(item => item.events).map(item => ({
				num: item && item.num, nature: item && item.nature,
				source: item && item.source && item.source.playerid,
				player: item && item.player && item.player.playerid,
			}));
			rec.after = { actor: snapshot(actor), ally: snapshot(ally), enemy1: snapshot(enemy1), enemy2: snapshot(enemy2) };
		});

		await scene('shenhua-guidao-replace', async rec => {
			actor.addSkill('guidao');
			await give(actor, [['sha', 'spade', 302], ['tao', 'heart', 303]]);
			rec.before = { actor: snapshot(actor), ally: snapshot(ally), attitude: get.attitude(actor, ally) };
		}, async rec => {
			const judged = card('wuxie', 'heart', 304);
			const picked = [];
			const restore = wrapAIResult(actor, 'chooseCard', result => picked.push((result.cards || []).map(item => ({ name: item.name, suit: item.suit }))));
			const judgeEvent = ally.judge({ directresult: judged, judge: c => (c && (c.suit || get.suit(c))) === 'spade' ? 4 : 0 });
			await judgeEvent;
			restore();
			const result = judgeEvent.result || {};
			rec.judging = {
				name: result.card && result.card.name,
				suit: result.suit || (result.card && result.card.suit),
				bool: result.bool,
				judge: result.judge,
			};
			rec.picked = picked;
			rec.pickedCards = picked.flat();
			rec.replaced = rec.pickedCards.length > 0 && (result.suit || (result.card && result.card.suit)) === 'spade';
			rec.originalCard = { name: 'wuxie', suit: 'heart' };
			rec.gainedOriginal = hand(actor).includes('wuxie');
			rec.after = { actor: snapshot(actor), ally: snapshot(ally) };
		});

		await scene('shenhua-guidao-decline', async rec => {
			actor.addSkill('guidao');
			await give(actor, [['sha', 'spade', 330]]);
			rec.before = { actor: snapshot(actor), ally: snapshot(ally), attitude: get.attitude(actor, ally) };
		}, async rec => {
			const judged = card('wuxie', 'spade', 331);
			const picked = [];
			const restore = wrapAIResult(actor, 'chooseCard', result => picked.push((result.cards || []).map(item => ({ name: item.name, suit: item.suit }))));
			const judgeEvent = ally.judge({ directresult: judged, judge: c => (c && (c.suit || get.suit(c))) === 'spade' ? 4 : 0 });
			await judgeEvent;
			restore();
			const result = judgeEvent.result || {};
			rec.judging = { name: result.card && result.card.name, suit: result.suit, bool: result.bool, judge: result.judge };
			rec.picked = picked;
			rec.pickedCards = picked.flat();
			rec.replaced = rec.pickedCards.length > 0;
			rec.after = { actor: snapshot(actor), ally: snapshot(ally) };
		});

		await scene('shenhua-huangtian-give', async rec => {
			game.zhu = ally;
			actor.identity = 'zhong'; try { actor.setIdentity('zhong'); } catch (e) {}
			ally.identity = 'zhu'; try { ally.setIdentity('zhu'); } catch (e) {}
			actor.group = 'qun';
			ally.addSkill('huangtian');
			actor.addSkill('huangtian2');
			await give(actor, [['shan', 'heart', 305]]);
			rec.before = { actor: snapshot(actor), ally: snapshot(ally) };
		}, async rec => {
			const probe = instrument(actor);
			const temps = captureTempSkill(ally);
			try { await actor.phaseUse(); } finally { probe.restore(); temps.restore(); }
			rec.ops = probe.log;
			rec.tempCalls = temps.calls;
			rec.after = { actor: snapshot(actor), ally: snapshot(ally), temp: ally.hasSkill('huangtian3') };
		});

		await scene('shenhua-huangtian-negative', async rec => {
			game.zhu = ally;
			actor.identity = 'zhong'; try { actor.setIdentity('zhong'); } catch (e) {}
			ally.identity = 'zhu'; try { ally.setIdentity('zhu'); } catch (e) {}
			actor.group = 'qun';
			ally.addSkill('huangtian');
			actor.addSkill('huangtian2');
			await give(actor, [['sha', 'spade', 332]]);
			rec.before = { actor: snapshot(actor), ally: snapshot(ally) };
		}, async rec => {
			const probe = instrument(actor);
			try { await actor.phaseUse(); } finally { probe.restore(); }
			rec.ops = probe.log;
			rec.after = { actor: snapshot(actor), ally: snapshot(ally), temp: ally.hasSkill('huangtian3') };
		});

		await scene('shenhua-guhuo-claim', async rec => {
			actor.addSkill('xinfu_guhuo');
			await give(actor, [['shan', 'spade', 306]]);
			enemy1.hp = 4; enemy1.maxHp = 4; enemy1.update();
			rec.before = { actor: snapshot(actor), enemy1: snapshot(enemy1) };
		}, async rec => {
			const buttons = [];
			const restore = wrapAIResult(actor, 'chooseButton', result => { buttons.push({ bool: !!result.bool, links: (result.links || []).map(link => link && link[2] || String(link)) }); });
			let result = null;
			try {
				result = await actor.chooseToUse({ type: 'phase', filterCard: cardx => cardx.name === 'sha', filterTarget: (cardx, playerx, target) => target !== playerx, prompt: 'review-guhuo' });
			} finally { restore(); }
			rec.choice = recordChoice(result);
			rec.buttons = buttons;
		});

		await scene('shenhua-guhuo-ai-use', async rec => {
			actor.addSkill('xinfu_guhuo');
			await give(actor, [['shan', 'heart', 334], ['tao', 'heart', 336]]);
			await actor.equip(card('chitu', 'heart', 335));
			enemy1.hp = 2; enemy1.maxHp = 4; enemy1.update();
			rec.before = { actor: snapshot(actor), enemy1: snapshot(enemy1), distance: get.distance(actor, enemy1) };
		}, async rec => {
			rec.probe = {
				distance: get.distance(actor, enemy1),
				equips: actor.getEquips().map(item => item.name),
				canUse: actor.canUse({ name: 'sha' }, enemy1),
				hasValueTarget: actor.hasValueTarget({ name: 'sha' }, enemy1),
				hasSkill: actor.hasSkill('xinfu_guhuo'),
				guhuoFilter: (() => { try { return lib.skill.xinfu_guhuo.filter({ type: 'phase', filterCard: lib.filter.filterCard }, actor); } catch (e) { return String(e); } })(),
				useValue: (() => { try { return actor.getUseValue({ name: 'sha', isCard: true }); } catch (e) { return String(e); } })(),
				handValues: actor.getCards('h').map(cardx => [cardx.name, get.value(cardx)]),
				queue: game.players.map(player => player.playerid),
			};
			const restores = game.players.filter(player => player !== actor).map(player => forceGuhuoAnswer(player, true));
			const damage = captureDamage(enemy1);
			const buttonChoices = [], cardChoices = [], useCalls = [];
			const restoreButton = wrapAIResult(actor, 'chooseButton', result => buttonChoices.push((result.links || []).map(link => link && link[2] || String(link))));
			const restoreCard = wrapAIResult(actor, 'chooseCard', result => cardChoices.push((result.cards || []).map(item => item.name)));
			const originalUseCard = actor.useCard;
			actor.useCard = function (...args) {
				try { useCalls.push({ card: args[0] && args[0].name || null, skill: typeof args[3] === 'string' ? args[3] : null }); } catch (e) {}
				return originalUseCard.apply(this, args);
			};
			let choiceEvent = null;
			try {
				await runWithMathRandom(0.9, async () => {
					choiceEvent = actor.chooseToUse({ type: 'phase', filterCard: cardx => cardx.name === 'sha' });
					await choiceEvent;
				});
			} finally { actor.useCard = originalUseCard; restoreCard(); restoreButton(); damage.restore(); restores.forEach(restore => restore()); }
			const choiceResult = choiceEvent && choiceEvent.result || {};
			rec.choice = recordChoice(choiceResult);
			rec.declared = choiceResult.card && choiceResult.card.name || null;
			rec.declaredNature = choiceResult.card && choiceResult.card.nature || null;
			rec.buttonChoices = buttonChoices;
			rec.cardChoices = cardChoices;
			rec.useCalls = useCalls;
			rec.targetAttitudes = (choiceResult.targets || []).map(target => get.attitude(actor, target));
			rec.targetsSelf = (choiceResult.targets || []).includes(actor);
			rec.used = !!choiceResult.bool;
			rec.damage = damage.events.map(item => ({ num: item && item.num, player: item && item.player && item.player.playerid }));
			rec.guhuoPhase = actor.hasSkill('guhuo_phase');
			rec.targetChanyuan = enemy1.hasSkill('chanyuan');
			rec.after = { actor: snapshot(actor), enemy1: snapshot(enemy1) };
		});

		await scene('shenhua-guhuo-real-questioned', async rec => {
			actor.addSkill('xinfu_guhuo');
			await give(actor, [['sha', 'spade', 336]]);
			enemy1.hp = 2; enemy1.maxHp = 4; enemy1.update();
			rec.before = { actor: snapshot(actor), enemy1: snapshot(enemy1) };
		}, async rec => {
			const restores = game.players.filter(player => player !== actor).map(player => forceGuhuoAnswer(player, player !== enemy1));
			const damage = captureDamage(enemy1);
			let useEvent = null;
			try { useEvent = await guhuoUse(actor.getCards('h', 'sha')[0]); } finally { damage.restore(); restores.forEach(restore => restore()); }
			rec.declared = 'sha';
			rec.hidden = 'sha';
			rec.damage = damage.events.map(item => ({ num: item && item.num, player: item && item.player && item.player.playerid }));
			rec.guhuoPhase = actor.hasSkill('guhuo_phase');
			rec.enemyChanyuan = enemy1.hasSkill('chanyuan');
			rec.cancelled = !!(useEvent && useEvent.cancelled);
			rec.after = { actor: snapshot(actor), enemy1: snapshot(enemy1) };
		});

		await scene('shenhua-guhuo-fake-questioned', async rec => {
			actor.addSkill('xinfu_guhuo');
			await give(actor, [['shan', 'heart', 337], ['tao', 'club', 345]]);
			await actor.equip(card('chitu', 'heart', 346));
			enemy1.hp = 2; enemy1.maxHp = 4; enemy1.update();
			rec.before = { actor: snapshot(actor), enemy1: snapshot(enemy1), distance: get.distance(actor, enemy1) };
		}, async rec => {
			const restores = game.players.filter(player => player !== actor).map(player => forceGuhuoAnswer(player, player !== enemy1));
			const damage = captureDamage(enemy1);
			const buttonChoices = [], cardChoices = [], useCalls = [];
			const restoreButton = wrapAIResult(actor, 'chooseButton', result => buttonChoices.push((result.links || []).map(link => link && link[2] || String(link))));
			const restoreCard = wrapAIResult(actor, 'chooseCard', result => cardChoices.push((result.cards || []).map(item => item.name)));
			const originalUseCard = actor.useCard;
			actor.useCard = function (...args) {
				try { useCalls.push({ card: args[0] && args[0].name || null, skill: typeof args[3] === 'string' ? args[3] : null }); } catch (e) {}
				return originalUseCard.apply(this, args);
			};
			let choiceEvent = null;
			try {
				await runWithMathRandom(0.9, async () => {
					choiceEvent = actor.chooseToUse({ type: 'phase', filterCard: cardx => cardx.name === 'sha' });
					await choiceEvent;
				});
			} finally { actor.useCard = originalUseCard; restoreCard(); restoreButton(); damage.restore(); restores.forEach(restore => restore()); }
			const choiceResult = choiceEvent && choiceEvent.result || {};
			rec.choice = recordChoice(choiceResult);
			rec.declared = choiceResult.card && choiceResult.card.name || (buttonChoices.flat()[0] || (useCalls[0] && useCalls[0].card) || null);
			rec.buttonChoices = buttonChoices;
			rec.cardChoices = cardChoices;
			rec.useCalls = useCalls;
			rec.hidden = (choiceResult.cards || []).map(item => item.name).concat(cardChoices.flat());
			rec.damage = damage.events.map(item => ({ num: item && item.num, player: item && item.player && item.player.playerid }));
			rec.guhuoPhase = actor.hasSkill('guhuo_phase');
			rec.enemyChanyuan = enemy1.hasSkill('chanyuan');
			const beforeHand = rec.before && rec.before.hand && rec.before.hand[actor.playerid] || [];
			const afterHand = hand(actor);
			const activationLost = (choiceResult.cards || []).length > 0 || rec.hidden.length > 0 || rec.guhuoPhase || useCalls.length > 0;
			rec.activated = activationLost || afterHand.length < beforeHand.length;
			rec.declined = !rec.activated;
			rec.cancelled = rec.activated && damage.events.length === 0 && enemy1.hp === 2;
			rec.after = { actor: snapshot(actor), enemy1: snapshot(enemy1) };
		});

		await scene('shenhua-guhuo-phase', async rec => {
			actor.addSkill('xinfu_guhuo');
			await give(actor, [['shan', 'spade', 321]]);
			enemy1.hp = 4; enemy1.maxHp = 4; enemy1.update();
			rec.before = { actor: snapshot(actor), enemy1: snapshot(enemy1) };
		}, async rec => {
			const probe = instrument(actor);
			try { await actor.phaseUse(); } finally { probe.restore(); }
			rec.ops = probe.log;
		});

		await scene('shenhua-shensu-skip', async rec => {
			actor.addSkill('xinshensu');
			await actor.addJudge(card('lebu', 'spade', 307));
			await give(actor, [['sha', 'spade', 308], ['sha', 'heart', 309], ['sha', 'club', 310]]);
			enemy1.hp = 4; enemy1.maxHp = 4; enemy1.update();
			rec.before = { actor: snapshot(actor), enemy1: snapshot(enemy1), judge: actor.getCards('j').length };
		}, async rec => {
			const probe = instrument(actor);
			try { await actor.phaseJudge(); } finally { probe.restore(); }
			rec.ops = probe.log;
			rec.shensuAfter = { judge: actor.getCards('j').length, turnedOver: actor.isTurnedOver ? actor.isTurnedOver() : null };
			rec.usedSha = probe.log.some(item => item && item.op === 'useCard' && item.args && item.args[0] === 'sha');
		});

		await scene('shenhua-shensu-negative', async rec => {
			actor.addSkill('xinshensu');
			await actor.addJudge(card('lebu', 'spade', 339));
			await give(actor, [['sha', 'spade', 340], ['sha', 'heart', 341]]);
			enemy1.hp = 4; enemy1.maxHp = 4; enemy1.update();
			rec.before = { actor: snapshot(actor), enemy1: snapshot(enemy1), judge: actor.getCards('j').length };
		}, async rec => {
			const probe = instrument(actor);
			try { await actor.phaseJudge(); } finally { probe.restore(); }
			rec.ops = probe.log;
			rec.shensuAfter = { judge: actor.getCards('j').length, turnedOver: actor.isTurnedOver ? actor.isTurnedOver() : null };
			rec.usedSha = probe.log.some(item => item && item.op === 'useCard' && item.args && item.args[0] === 'sha');
		});

		await scene('shenhua-tianxiang-redirect', async rec => {
			actor.addSkill('retianxiang');
			await give(actor, [['tao', 'heart', 311]]);
			actor.hp = 4; actor.maxHp = 4;
			enemy1.hp = 3; enemy1.maxHp = 4; enemy1.update();
			rec.before = { actor: snapshot(actor), ally: snapshot(ally), enemy1: snapshot(enemy1) };
		}, async rec => {
			const targets = [], controls = [];
			const restoreTarget = wrapAIResult(actor, 'chooseCardTarget', result => targets.push((result.targets || []).map(nameOf)));
			const restoreControl = wrapAIResult(actor, 'chooseControlList', result => controls.push(result.index));
			const probe = instrument(actor);
			try { await actor.damage(1, enemy1); } finally { probe.restore(); restoreTarget(); restoreControl(); }
			rec.targets = targets; rec.controls = controls; rec.ops = probe.log;
			rec.after = { actor: snapshot(actor), ally: snapshot(ally), enemy1: snapshot(enemy1) };
		});

		await scene('shenhua-tianxiang-negative', async rec => {
			actor.addSkill('retianxiang');
			await give(actor, [['sha', 'spade', 342]]);
			actor.hp = 4; actor.maxHp = 4;
			enemy1.hp = 4; enemy1.maxHp = 4; enemy1.update();
			rec.before = { actor: snapshot(actor), ally: snapshot(ally), enemy1: snapshot(enemy1) };
		}, async rec => {
			const targets = [];
			const restoreTarget = wrapAIResult(actor, 'chooseCardTarget', result => targets.push((result.targets || []).map(nameOf)));
			const probe = instrument(actor);
			try { await actor.damage(1, enemy1); } finally { probe.restore(); restoreTarget(); }
			rec.targets = targets; rec.ops = probe.log;
			rec.after = { actor: snapshot(actor), ally: snapshot(ally), enemy1: snapshot(enemy1) };
		});

		await scene('shenhua-hongyan-suit', async rec => {
			actor.addSkill('hongyan');
			const spade = card('sha', 'spade', 312);
			const heart = card('sha', 'heart', 313);
			rec.suits = { spade: get.suit(spade, actor), heart: get.suit(heart, actor) };
			rec.colors = { spade: get.color(spade, actor), heart: get.color(heart, actor) };
		}, async rec => {});

		await scene('shenhua-kuanggu-draw', async rec => {
			actor.addSkill('xinkuanggu');
			actor.hp = 3; actor.maxHp = 4;
			await actor.equip(card('zhuge', 'spade', 323));
			await actor.equip(card('chitu', 'heart', 343));
			await give(actor, [['sha', 'spade', 314]]);
			enemy1.hp = 3; enemy1.maxHp = 4; enemy1.update();
			rec.before = { actor: snapshot(actor), enemy1: snapshot(enemy1) };
			rec.kuangguProbe = { distance: get.distance(actor, enemy1), hasSkill: actor.hasSkill('xinkuanggu') };
		}, async rec => {
			const choices = [];
			const restore = wrapAIResult(actor, 'chooseDrawRecover', result => choices.push(result.control));
			const probe = instrument(actor);
			const damage = captureDamage(enemy1);
			try { await actor.useCard(actor.getCards('h', 'sha')[0], enemy1); } finally { damage.restore(); probe.restore(); restore(); }
			rec.choices = choices; rec.ops = probe.log;
			rec.damage = damage.events.map(item => ({
				checkKuanggu: item && item.checkKuanggu, num: item && item.num,
				source: item && item.source && item.source.playerid,
				player: item && item.player && item.player.playerid,
			}));
			rec.kuangguAfter = { actorHp: actor.hp, actorHand: hand(actor), enemyHp: enemy1.hp };
		});

		await scene('shenhua-kuanggu-recover', async rec => {
			actor.addSkill('xinkuanggu');
			actor.hp = 3; actor.maxHp = 4;
			await actor.equip(card('chitu', 'heart', 344));
			await give(actor, [['sha', 'club', 322], ['sha', 'spade', 314]]);
			enemy1.hp = 3; enemy1.maxHp = 4; enemy1.update();
			rec.before = { actor: snapshot(actor), enemy1: snapshot(enemy1), distance: get.distance(actor, enemy1) };
		}, async rec => {
			const choices = [];
			const restore = wrapAIResult(actor, 'chooseDrawRecover', result => choices.push(result.control));
			const probe = instrument(actor);
			const damage = captureDamage(enemy1);
			try { await actor.useCard(actor.getCards('h', 'sha')[0], enemy1); } finally { damage.restore(); probe.restore(); restore(); }
			rec.choices = choices; rec.ops = probe.log;
			rec.damage = damage.events.map(item => ({
				checkKuanggu: item && item.checkKuanggu, num: item && item.num,
				source: item && item.source && item.source.playerid,
				player: item && item.player && item.player.playerid,
			}));
			rec.kuangguAfter = { actorHp: actor.hp, actorHand: hand(actor), enemyHp: enemy1.hp };
		});

		await scene('shenhua-jushou-4hp-empty', async rec => {
			actor.addSkill('jushou');
			actor.hp = 4; actor.maxHp = 4;
			rec.before = { actor: snapshot(actor), turnedOver: actor.isTurnedOver ? actor.isTurnedOver() : null };
		}, async rec => {
			const probe = instrument(actor);
			try { await actor.phaseJieshu(); } finally { probe.restore(); }
			rec.ops = probe.log;
			rec.jushouAfter = { hand: hand(actor), turnedOver: actor.isTurnedOver ? actor.isTurnedOver() : null };
		});

		await scene('shenhua-jushou-lowhp', async rec => {
			actor.addSkill('jushou');
			actor.hp = 3; actor.maxHp = 4;
			rec.before = { actor: snapshot(actor), turnedOver: actor.isTurnedOver ? actor.isTurnedOver() : null };
		}, async rec => {
			const probe = instrument(actor);
			try { await actor.phaseJieshu(); } finally { probe.restore(); }
			rec.ops = probe.log;
			rec.jushouAfter = { hand: hand(actor), turnedOver: actor.isTurnedOver ? actor.isTurnedOver() : null };
		});

		await scene('shenhua-buqu-damage', async rec => {
			actor.addSkill('gzbuqu');
			actor.hp = 1; actor.maxHp = 4;
			rec.before = { actor: snapshot(actor), expansions: actor.getExpansions('gzbuqu').length };
		}, async rec => {
			const probe = instrument(actor);
			try { await actor.damage(1); } finally { probe.restore(); }
			rec.ops = probe.log;
			rec.buquAfter = {
				hp: actor.hp, expansions: actor.getExpansions('gzbuqu').map(c => c.name),
				dying: actor.isDying ? actor.isDying() : null, alive: !actor.dead,
			};
		});

		await scene('shenhua-buqu-negative', async rec => {
			actor.addSkill('gzbuqu');
			actor.hp = 2; actor.maxHp = 4;
			rec.before = { actor: snapshot(actor), expansions: actor.getExpansions('gzbuqu').length };
		}, async rec => {
			const probe = instrument(actor);
			try { await actor.damage(1); } finally { probe.restore(); }
			rec.ops = probe.log;
			rec.buquAfter = {
				hp: actor.hp, expansions: actor.getExpansions('gzbuqu').map(c => c.name),
				dying: actor.isDying ? actor.isDying() : null, alive: !actor.dead,
			};
		});

		await scene('shenhua-buqu-recover-choice', async rec => {
			actor.addSkill('gzbuqu');
			actor.hp = 1; actor.maxHp = 4;
			const expansion = actor.addToExpansion([card('shan', 'spade', 1), card('sha', 'club', 1)], 'gain2');
			expansion.gaintag.add('gzbuqu');
			await expansion;
			rec.before = { actor: snapshot(actor), expansions: actor.getExpansions('gzbuqu').map(c => ({ name: c.name, number: get.number(c) })) };
		}, async rec => {
			const picks = [];
			const restore = wrapAIResult(actor, 'chooseCardButton', result => picks.push((result.links || []).map(link => link && link.name)));
			const probe = instrument(actor);
			try { await actor.recover(1); } finally { probe.restore(); restore(); }
			rec.ops = probe.log;
			rec.recoverPicks = picks;
			rec.buquAfter = {
				hp: actor.hp,
				expansions: actor.getExpansions('gzbuqu').map(c => ({ name: c.name, number: get.number(c) })),
				dying: actor.isDying ? actor.isDying() : null, alive: !actor.dead,
			};
		});

		await scene('shenhua-liegong-hit', async rec => {
			actor.addSkill('xinliegong');
			actor.hp = 3; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 315], ['wuxie', 'heart', 316]]);
			enemy1.hp = 4; enemy1.maxHp = 4; enemy1.update();
			rec.before = { actor: snapshot(actor), enemy1: snapshot(enemy1) };
		}, async rec => {
			const probe = instrument(enemy1);
			const damage = captureDamage(enemy1);
			let useEvent = null;
			try { useEvent = actor.useCard(actor.getCards('h', 'sha')[0], enemy1); await useEvent; } finally { damage.restore(); probe.restore(); }
			rec.ops = probe.log;
			rec.useCard = {
				directHit: (useEvent && useEvent.directHit || []).map(nameOf),
				extraDamage: useEvent && useEvent.customArgs && useEvent.customArgs[enemy1.playerid] && useEvent.customArgs[enemy1.playerid].extraDamage,
			};
			rec.damage = damage.events.map(item => ({ num: item && item.num, player: item && item.player && item.player.playerid }));
			rec.after = { actor: snapshot(actor), enemy1: snapshot(enemy1) };
		});

		await scene('shenhua-liegong-negative', async rec => {
			actor.addSkill('xinliegong');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 317]]);
			enemy1.hp = 2; enemy1.maxHp = 4;
			await give(enemy1, [['wuxie', 'heart', 318], ['wuxie', 'club', 319], ['wuxie', 'spade', 320]]);
			enemy1.update();
			rec.before = { actor: snapshot(actor), enemy1: snapshot(enemy1) };
		}, async rec => {
			const probe = instrument(enemy1);
			const damage = captureDamage(enemy1);
			let useEvent = null;
			try { useEvent = actor.useCard(actor.getCards('h', 'sha')[0], enemy1); await useEvent; } finally { damage.restore(); probe.restore(); }
			rec.ops = probe.log;
			rec.useCard = {
				directHit: (useEvent && useEvent.directHit || []).map(nameOf),
				extraDamage: useEvent && useEvent.customArgs && useEvent.customArgs[enemy1.playerid] && useEvent.customArgs[enemy1.playerid].extraDamage,
			};
			rec.damage = damage.events.map(item => ({ num: item && item.num, player: item && item.player && item.player.playerid }));
			rec.after = { actor: snapshot(actor), enemy1: snapshot(enemy1) };
		});

		/* === 神话再临·火：首轮原生固定局面 === */
		await scene('shenhua-huo-quhu-compare', async rec => {
			actor.addSkill('quhu');
			actor.hp = 2; actor.maxHp = 4;
			await give(actor, [['wuxie', 'spade', 682]]);
			enemy1.hp = 3; enemy1.maxHp = 4;
			await give(enemy1, [['shan', 'heart', 681]]);
			enemy1.update();
			rec.setup = { actorHp: actor.hp, enemyHp: enemy1.hp, enemyHand: hand(enemy1) };
		}, async rec => {
			const probe = instrument(actor);
			const targets = [];
			const restore = wrapAIResult(actor, 'chooseTarget', result => targets.push((result.targets || []).map(nameOf)));
			const skillTargets = [];
			const originalUseSkill = actor.useSkill;
			actor.useSkill = function (skill, cards, targetList) {
				try { if (skill === 'quhu') skillTargets.push((targetList || []).map(nameOf)); } catch (e) {}
				return originalUseSkill.apply(this, arguments);
			};
			try { await actor.phaseUse(); } finally { actor.useSkill = originalUseSkill; probe.restore(); restore(); }
			rec.result = { ops: probe.log, targets: targets.concat(skillTargets), skillTargets, actorHp: actor.hp, actorHand: hand(actor), enemyHp: enemy1.hp, enemyHand: hand(enemy1) };
		});

		await scene('shenhua-huo-jieming-damage', async rec => {
			actor.addSkill('jieming');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'heart', 664]]);
			ally.hp = 4; ally.maxHp = 4; ally.update();
			rec.setup = { actorHand: hand(actor), allyHand: hand(ally) };
		}, async rec => {
			const targets = [];
			const restore = wrapAIResult(actor, 'chooseTarget', result => targets.push((result.targets || []).map(nameOf)));
			const probe = instrument(actor);
			try { await actor.damage(1, enemy1); } finally { probe.restore(); restore(); }
			rec.result = { targets, ops: probe.log, actorHp: actor.hp, actorHand: hand(actor), allyHp: ally.hp, allyHand: hand(ally) };
		});

		await scene('shenhua-huo-oldniepan-dying', async rec => {
			actor.addSkill('oldniepan');
			actor.hp = 1; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 820], ['shan', 'heart', 821]]);
			rec.setup = { actorHp: actor.hp, hand: hand(actor) };
		}, async rec => {
			const probe = instrument(actor);
			try { await actor.damage(2, enemy1); } finally { probe.restore(); }
			rec.result = { ops: probe.log, hp: actor.hp, hand: hand(actor), alive: !actor.dead, used: !!actor.storage.oldniepan };
		});

		await scene('shenhua-huo-tianyi-compare', async rec => {
			actor.addSkill('tianyi');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 830], ['wuxie', 'heart', 831], ['shan', 'club', 832]]);
			enemy1.hp = 4; enemy1.maxHp = 4;
			await give(enemy1, [['sha', 'diamond', 820], ['shan', 'club', 821]]);
			enemy1.update();
			rec.setup = { hand: hand(actor), enemyHand: hand(enemy1) };
		}, async rec => {
			const probe = instrument(actor);
			try { await lib.skill.tianyi.content({ target: enemy1, skill: 'tianyi' }, {}, actor); } finally { probe.restore(); }
			rec.result = {
				ops: probe.log, hand: hand(actor), enemyHp: enemy1.hp,
				tianyi2: actor.hasSkill('tianyi2'), tianyi3: actor.hasSkill('tianyi3'),
			};
		});

		await scene('shenhua-huo-shuangxiong-judge', async rec => {
			actor.addSkill('shuangxiong');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 840], ['shan', 'heart', 841], ['tao', 'club', 842], ['wuxie', 'diamond', 843], ['sha', 'spade', 844]]);
			rec.setup = { hand: hand(actor), hp: actor.hp };
		}, async rec => {
			const probe = instrument(actor);
			try { await actor.phaseDraw(); } finally { probe.restore(); }
			rec.result = {
				ops: probe.log, hand: hand(actor), viewas: actor.hasSkill('shuangxiong_viewas'),
				storage: actor.getStorage ? actor.getStorage('shuangxiong_viewas') : null,
			};
		});

		await scene('shenhua-huo-luanji-wanjian', async rec => {
			actor.addSkill('luanji');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['wuxie', 'spade', 520], ['shan', 'spade', 521]]);
			enemy1.hp = 2; enemy1.maxHp = 4;
			enemy2.hp = 2; enemy2.maxHp = 4;
			enemy1.update(); enemy2.update();
			rec.setup = { hand: hand(actor), enemy1: enemy1.hp, enemy2: enemy2.hp };
		}, async rec => {
			const probe = instrument(actor);
			try { await actor.phaseUse(); } finally { probe.restore(); }
			rec.result = { ops: probe.log, hand: hand(actor), enemy1: enemy1.hp, enemy2: enemy2.hp };
		});

		await scene('shenhua-huo-jianchu-sha', async rec => {
			actor.addSkill('jianchu');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 530]]);
			enemy1.hp = 4; enemy1.maxHp = 4;
			await enemy1.equip(card('zhuge', 'club', 531));
			enemy1.update();
			rec.setup = { equips: enemy1.getEquips().map(item => item.name), hand: hand(actor) };
		}, async rec => {
			const probe = instrument(enemy1);
			let useEvent = null;
			try { useEvent = actor.useCard(actor.getCards('h', 'sha')[0], enemy1); await useEvent; } finally { probe.restore(); }
			rec.result = { ops: probe.log, equips: enemy1.getEquips().map(item => item.name), enemyHp: enemy1.hp, directHit: (useEvent && useEvent.directHit || []).map(nameOf) };
		});

		await scene('shenhua-huo-lianhuan-tiesuo', async rec => {
			actor.addSkill('lianhuan');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'club', 670], ['sha', 'diamond', 673]]);
			enemy1.hp = 4; enemy1.maxHp = 4; enemy2.hp = 4; enemy2.maxHp = 4;
			enemy1.update(); enemy2.update();
			rec.setup = { hand: hand(actor) };
		}, async rec => {
			const probe = instrument(actor);
			const targets = [];
			const restore = wrapAIResult(actor, 'chooseTarget', result => targets.push((result.targets || []).map(nameOf)));
			const tiesuoTargets = [];
			const originalUseCard = actor.useCard;
			actor.useCard = function (cardInfo, cards, cardTargets, skill) {
				try { if (cardInfo && cardInfo.name === 'tiesuo') tiesuoTargets.push((cardTargets || []).map(nameOf)); } catch (e) {}
				return originalUseCard.apply(this, arguments);
			};
			try { await actor.phaseUse(); } finally { actor.useCard = originalUseCard; probe.restore(); restore(); }
			rec.result = { ops: probe.log, targets, tiesuoTargets, hand: hand(actor), enemy1: enemy1.hp, enemy2: enemy2.hp };
		});

		await scene('shenhua-huo-huoji-red', async rec => {
			actor.addSkill('huoji');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['wuxie', 'heart', 522]]);
			enemy1.hp = 4; enemy1.maxHp = 4;
			await give(enemy1, [['shan', 'club', 523]]);
			enemy1.update();
			rec.setup = { hand: hand(actor), enemyHand: hand(enemy1) };
		}, async rec => {
			const probe = instrument(actor);
			try { await actor.phaseUse(); } finally { probe.restore(); }
			rec.result = { ops: probe.log, hand: hand(actor), enemyHp: enemy1.hp, enemyHand: hand(enemy1) };
		});

		await scene('shenhua-huo-passive-rules', async rec => {
			rec.setup = {};
			rec.setup.baseDistance = get.distance(actor, enemy1);
			actor.addSkill('mashu');
			rec.setup.mashuDistance = get.distance(actor, enemy1);
			game.zhu = actor;
			actor.addSkill('xueyi');
			ally.group = 'qun';
			rec.setup.maxHandcard = actor.getHandcardLimit();
			rec.setup.hasArmorSlot = actor.hasEmptySlot(2);
			actor.addSkill('bazhen');
			rec.setup.bazhenExtra = actor.hasSkill('bazhen_bagua');
			await give(actor, [['wuxie', 'spade', 750]]);
			actor.addSkill('kanpo');
			rec.setup.kanpoView = (() => { try { return lib.skill.kanpo.viewAsFilter(actor); } catch (e) { return String(e); } })();
		}, async rec => {
			rec.result = { hand: hand(actor), maxHandcard: actor.getHandcardLimit() };
		});

		/* === 神话再临·火：第二轮正向发动与反向不发动场景 === */
		await scene('shenhua-huo-luanji-wanjian-use', async rec => {
			blockNeighborSha();
			actor.addSkill('luanji');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'spade', 3], ['shan', 'spade', 4], ['shan', 'spade', 5]]);
			for (const player of game.players) {
				if (player === actor) continue;
				player.identity = 'fan';
				try { player.setIdentity('fan'); } catch (e) {}
				player.hp = 20; player.maxHp = 20;
				player.update();
			}
			enemy1.hp = 1; enemy1.maxHp = 4; enemy1.update();
			enemy2.hp = 1; enemy2.maxHp = 4; enemy2.update();
			rec.setup = { hand: hand(actor), enemy1: enemy1.hp, enemy2: enemy2.hp, allOthersEnemy: true };
		}, async rec => {
			const damages = game.players.map(player => captureDamage(player));
			const probe = instrument(actor);
			try { await actor.phaseUse(); } finally { probe.restore(); damages.forEach(item => item.restore()); }
			rec.ops = probe.log;
			rec.damage = damages.flatMap(item => item.events.map(event => ({ num: event && event.num, player: event && event.player && event.player.playerid })));
			rec.wanjian = (probe.log || []).filter(item => item && item.op === 'useCard' && item.args && item.args[0] === 'wanjian').map(item => ({ cards: item.args[1], targets: item.args[2], skill: item.args[3] }));
			rec.after = { hand: hand(actor), enemy1: enemy1.hp, enemy2: enemy2.hp };
		});
		await scene('shenhua-huo-luanji-no-pair', async rec => {
			blockNeighborSha();
			actor.addSkill('luanji');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'spade', 540], ['shan', 'heart', 541]]);
			enemy1.hp = 1; enemy1.maxHp = 4; enemy1.update();
			rec.setup = { hand: hand(actor) };
		}, async rec => {
			const probe = instrument(actor);
			try { await actor.phaseUse(); } finally { probe.restore(); }
			rec.ops = probe.log;
			rec.wanjian = (probe.log || []).filter(item => item && item.op === 'useCard' && item.args && item.args[0] === 'wanjian');
			rec.after = { hand: hand(actor), enemy1: enemy1.hp };
		});

		await scene('shenhua-huo-huoji-use', async rec => {
			actor.addSkill('huoji');
			actor.hp = 3; actor.maxHp = 4;
			await give(actor, [['shan', 'heart', 44], ['shan', 'heart', 45], ['wuxie', 'diamond', 46], ['tao', 'heart', 47], ['shan', 'diamond', 48]]);
			enemy1.hp = 4; enemy1.maxHp = 4;
			await give(enemy1, [['tao', 'heart', 600]]);
			enemy1.update();
			rec.setup = { hand: hand(actor), enemyHand: hand(enemy1) };
		}, async rec => {
			const damage = captureDamage(enemy1);
			const probe = instrument(actor);
			try { await actor.phaseUse(); } finally { probe.restore(); damage.restore(); }
			rec.ops = probe.log;
			rec.damage = damage.events.map(event => ({ num: event && event.num, nature: event && event.nature, player: event && event.player && event.player.playerid }));
			rec.huogong = (probe.log || []).filter(item => item && item.op === 'useCard' && item.args && item.args[0] === 'huogong').map(item => ({ cards: item.args[1], targets: item.args[2], skill: item.args[3] }));
			rec.after = { hand: hand(actor), enemyHp: enemy1.hp, enemyHand: hand(enemy1) };
		});
		await scene('shenhua-huo-huoji-no-red', async rec => {
			actor.addSkill('huoji');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'spade', 49], ['sha', 'club', 50]]);
			enemy1.hp = 4; enemy1.maxHp = 4;
			await give(enemy1, [['tao', 'heart', 601]]);
			enemy1.update();
			rec.setup = { hand: hand(actor), enemyHand: hand(enemy1) };
		}, async rec => {
			const probe = instrument(actor);
			try { await actor.phaseUse(); } finally { probe.restore(); }
			rec.ops = probe.log;
			rec.huogong = (probe.log || []).filter(item => item && item.op === 'useCard' && item.args && item.args[0] === 'huogong');
			rec.after = { hand: hand(actor), enemyHp: enemy1.hp, enemyHand: hand(enemy1) };
		});

		await scene('shenhua-huo-kanpo-response', async rec => {
			actor.addSkill('kanpo');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'club', 51]]);
			rec.setup = { hand: hand(actor) };
		}, async rec => {
			const damage = captureDamage(actor);
			const probe = instrument(actor);
			try { await enemy1.useCard(card('nanman', 'spade', 752), actor); } finally { probe.restore(); damage.restore(); }
			rec.ops = probe.log;
			rec.damage = damage.events.map(event => ({ num: event && event.num, player: event && event.player && event.player.playerid }));
			rec.wuxie = (probe.log || []).filter(item => item && item.op === 'useCard' && item.args && item.args[0] === 'wuxie').map(item => ({ cards: item.args[1], targets: item.args[2], skill: item.args[3] }));
			rec.after = { hp: actor.hp, hand: hand(actor) };
		});
		await scene('shenhua-huo-kanpo-no-black', async rec => {
			actor.addSkill('kanpo');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'heart', 53]]);
			rec.setup = { hand: hand(actor) };
		}, async rec => {
			const damage = captureDamage(actor);
			const probe = instrument(actor);
			try { await enemy1.useCard(card('nanman', 'spade', 754), actor); } finally { probe.restore(); damage.restore(); }
			rec.ops = probe.log;
			rec.damage = damage.events.map(event => ({ num: event && event.num, player: event && event.player && event.player.playerid }));
			rec.wuxie = (probe.log || []).filter(item => item && item.op === 'useCard' && item.args && item.args[0] === 'wuxie');
			rec.after = { hp: actor.hp, hand: hand(actor) };
		});

		await scene('shenhua-huo-bazhen-bagua', async rec => {
			actor.addSkill('bazhen');
			actor.hp = 4; actor.maxHp = 4;
			await equipWeapon(enemy1, 'zhangba', 'spade', 555);
			await give(enemy1, [['sha', 'heart', 560]]);
			enemy1.update();
			rec.setup = { bazhenExtra: actor.hasSkill('bazhen_bagua'), emptyArmorSlot: actor.hasEmptySlot(2), armor: actor.getEquip(2) ? actor.getEquip(2).name : null, hand: hand(actor), enemyHand: hand(enemy1) };
		}, async rec => {
			const judges = forceJudgeSuit([actor], 'heart');
			const damage = captureDamage(actor);
			const sha = enemy1.getCards('h', 'sha')[0] || card('sha', 'heart', 560);
			try { await enemy1.useCard(sha, actor); } finally { damage.restore(); judges.restore(); }
			rec.judges = judges.calls;
			rec.damage = damage.events.map(event => ({ num: event && event.num, player: event && event.player && event.player.playerid }));
			rec.after = { hp: actor.hp, armor: actor.getEquip(2) ? actor.getEquip(2).name : null };
		});
		await scene('shenhua-huo-bazhen-armor-negative', async rec => {
			actor.addSkill('bazhen');
			actor.hp = 4; actor.maxHp = 4;
			await actor.equip(card('renwang', 'spade', 557));
			actor.update();
			await equipWeapon(enemy1, 'zhangba', 'spade', 58);
			await give(enemy1, [['sha', 'heart', 561]]);
			enemy1.update();
			rec.setup = { bazhenExtra: actor.hasSkill('bazhen_bagua'), emptyArmorSlot: actor.hasEmptySlot(2), armor: actor.getEquip(2) ? actor.getEquip(2).name : null, enemyHand: hand(enemy1) };
		}, async rec => {
			const judges = forceJudgeSuit([actor], 'heart');
			const damage = captureDamage(actor);
			const sha = enemy1.getCards('h', 'sha')[0] || card('sha', 'heart', 561);
			try { await enemy1.useCard(sha, actor); } finally { damage.restore(); judges.restore(); }
			rec.judges = judges.calls;
			rec.damage = damage.events.map(event => ({ num: event && event.num, player: event && event.player && event.player.playerid }));
			rec.after = { hp: actor.hp, bazhenExtra: actor.hasSkill('bazhen_bagua'), armor: actor.getEquip(2) ? actor.getEquip(2).name : null };
		});

		await scene('shenhua-huo-quhu-no-target', async rec => {
			actor.addSkill('quhu');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'heart', 660]]);
			for (const player of game.players) {
				if (player === actor) continue;
				player.hp = 4; player.maxHp = 4; player.update();
			}
			rec.setup = { actorHp: actor.hp, otherHp: game.players.filter(player => player !== actor).map(player => player.hp) };
		}, async rec => {
			const probe = instrument(actor);
			const targets = [];
			const restore = wrapAIResult(actor, 'chooseTarget', result => targets.push((result.targets || []).map(nameOf)));
			try { await actor.phaseUse(); } finally { probe.restore(); restore(); }
			rec.result = { ops: probe.log, targets, actorHp: actor.hp, actorHand: hand(actor) };
		});
		await scene('shenhua-huo-quhu-risky-decline', async rec => {
			actor.addSkill('quhu');
			actor.hp = 1; actor.maxHp = 4;
			await give(actor, [['shan', 'heart', 665]]);
			enemy1.hp = 4; enemy1.maxHp = 4; enemy1.update();
			rec.setup = { actorHp: actor.hp, hand: hand(actor), enemyHp: enemy1.hp };
		}, async rec => {
			const probe = instrument(actor);
			try { await actor.phaseUse(); } finally { probe.restore(); }
			rec.result = { ops: probe.log, actorHp: actor.hp, actorHand: hand(actor), enemyHp: enemy1.hp };
		});

		await scene('shenhua-huo-jieming-no-benefit', async rec => {
			actor.addSkill('jieming');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['wuxie', 'spade', 700], ['wuxie', 'club', 701], ['wuxie', 'heart', 702], ['wuxie', 'diamond', 703]]);
			ally.hp = 4; ally.maxHp = 4;
			await give(ally, [['wuxie', 'spade', 704], ['wuxie', 'club', 705], ['wuxie', 'heart', 706], ['wuxie', 'diamond', 707]]);
			enemy2.hp = 4; enemy2.maxHp = 4;
			await give(enemy2, [['wuxie', 'spade', 708], ['wuxie', 'club', 709], ['wuxie', 'heart', 710], ['wuxie', 'diamond', 711]]);
			enemy1.hp = 4; enemy1.maxHp = 4; enemy1.update();
			ally.update(); enemy2.update();
			rec.setup = { actorHand: hand(actor), allyHand: hand(ally), enemy1Hand: hand(enemy1), enemy2Hand: hand(enemy2) };
		}, async rec => {
			const targets = [];
			const restore = wrapAIResult(actor, 'chooseTarget', result => targets.push((result.targets || []).map(nameOf)));
			const probe = instrument(actor);
			try { await actor.damage(1, enemy1); } finally { probe.restore(); restore(); }
			rec.result = {
				targets, ops: probe.log,
				actorHp: actor.hp, allyHp: ally.hp, allyHand: hand(ally),
				enemy1Hp: enemy1.hp, enemy1Hand: hand(enemy1), enemy2Hand: hand(enemy2),
			};
		});

		await scene('shenhua-huo-oldniepan-tao', async rec => {
			actor.addSkill('oldniepan');
			actor.hp = 1; actor.maxHp = 4;
			await give(actor, [['tao', 'heart', 812], ['tao', 'diamond', 813]]);
			rec.setup = { hp: actor.hp, hand: hand(actor) };
		}, async rec => {
			const probe = instrument(actor);
			try { await actor.damage(1, enemy1); } finally { probe.restore(); }
			rec.result = { ops: probe.log, hp: actor.hp, hand: hand(actor), alive: !actor.dead, used: !!actor.storage.oldniepan };
		});

		await scene('shenhua-huo-tianyi-win-sha', async rec => {
			actor.addSkill('tianyi');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 9], ['wuxie', 'heart', 900], ['shan', 'club', 7]]);
			enemy1.hp = 4; enemy1.maxHp = 4;
			await give(enemy1, [['sha', 'diamond', 500], ['wuxie', 'spade', 501]]);
			enemy1.update();
			rec.setup = { hand: hand(actor), enemyHand: hand(enemy1) };
		}, async rec => {
			const damage = captureDamage(enemy1);
			const probe = instrument(actor);
			const targets = [];
			const restore = wrapAIResult(actor, 'chooseTarget', result => targets.push((result.targets || []).map(nameOf)));
			try { await actor.phaseUse(); } finally { probe.restore(); restore(); damage.restore(); }
			rec.result = {
				ops: probe.log, targets, hand: hand(actor), enemyHp: enemy1.hp, enemyHand: hand(enemy1),
				tianyi2: actor.hasSkill('tianyi2'), tianyi3: actor.hasSkill('tianyi3'),
				damage: damage.events.map(event => ({ num: event && event.num, player: event && event.player && event.player.playerid })),
			};
		});
		await scene('shenhua-huo-tianyi-lose-sha', async rec => {
			actor.addSkill('tianyi');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 9], ['shan', 'club', 2]]);
			enemy1.hp = 4; enemy1.maxHp = 4;
			await give(enemy1, [['tao', 'heart', 999], ['wuxie', 'spade', 998]]);
			enemy1.update();
			rec.setup = { hand: hand(actor), enemyHand: hand(enemy1) };
		}, async rec => {
			const damage = captureDamage(enemy1);
			const probe = instrument(actor);
			try { await actor.phaseUse(); } finally { probe.restore(); damage.restore(); }
			rec.result = {
				ops: probe.log, hand: hand(actor), enemyHp: enemy1.hp,
				tianyi2: actor.hasSkill('tianyi2'), tianyi3: actor.hasSkill('tianyi3'),
				shaUsed: (probe.log || []).filter(item => item && item.op === 'useCard' && item.args && item.args[0] === 'sha').length,
				damage: damage.events.map(event => ({ num: event && event.num, player: event && event.player && event.player.playerid })),
			};
		});

		await scene('shenhua-huo-tianyi-lose-content', async rec => {
			actor.addSkill('tianyi');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 9], ['shan', 'club', 2]]);
			enemy1.hp = 4; enemy1.maxHp = 4;
			await give(enemy1, [['tao', 'heart', 997]]);
			enemy1.update();
			rec.setup = { hand: hand(actor), enemyHand: hand(enemy1) };
		}, async rec => {
			const probe = instrument(actor);
			try { await lib.skill.tianyi.content({ target: enemy1, skill: 'tianyi' }, {}, actor); } finally { probe.restore(); }
			const probeSha = card('sha', 'spade', 880);
			rec.result = {
				ops: probe.log,
				tianyi2: actor.hasSkill('tianyi2'), tianyi3: actor.hasSkill('tianyi3'),
				shaEnabled: (() => { try { return !!lib.filter.cardEnabled(probeSha, actor); } catch (error) { return String(error); } })(),
				shaUsable: (() => { try { return !!lib.filter.cardUsable(probeSha, actor); } catch (error) { return String(error); } })(),
				hand: hand(actor),
			};
		});

		await scene('shenhua-huo-shuangxiong-duel', async rec => {
			actor.addSkill('shuangxiong');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 850], ['shan', 'heart', 851], ['tao', 'club', 852], ['wuxie', 'diamond', 853], ['sha', 'spade', 854]]);
			enemy1.hp = 4; enemy1.maxHp = 4; enemy1.update();
			rec.setup = { hand: hand(actor), hp: actor.hp };
		}, async rec => {
			const judges = forceJudgeSuit([actor], 'heart');
			const damage = captureDamage(enemy1);
			const probe = instrument(actor);
			try { await actor.phaseDraw(); await actor.phaseUse(); } finally { probe.restore(); damage.restore(); judges.restore(); }
			rec.result = {
				ops: probe.log, judges: judges.calls, hand: hand(actor), enemyHp: enemy1.hp,
				viewas: actor.hasSkill('shuangxiong_viewas'), storage: actor.getStorage ? actor.getStorage('shuangxiong_viewas') : null,
				damage: damage.events.map(event => ({ num: event && event.num, player: event && event.player && event.player.playerid })),
			};
		});
		await scene('shenhua-huo-shuangxiong-no-judge', async rec => {
			actor.addSkill('shuangxiong');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 855], ['shan', 'heart', 856], ['tao', 'club', 857]]);
			enemy1.hp = 4; enemy1.maxHp = 4; enemy1.update();
			rec.setup = { hand: hand(actor), hp: actor.hp };
		}, async rec => {
			const judges = forceJudgeSuit([actor], 'heart');
			const probe = instrument(actor);
			try { await actor.phaseDraw(); } finally { probe.restore(); judges.restore(); }
			rec.result = { ops: probe.log, judges: judges.calls, hand: hand(actor), viewas: actor.hasSkill('shuangxiong_viewas') };
		});

		await scene('shenhua-huo-jianchu-no-equip', async rec => {
			actor.addSkill('jianchu');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 532]]);
			enemy1.hp = 4; enemy1.maxHp = 4;
			await give(enemy1, [['tao', 'heart', 650]]);
			enemy1.update();
			rec.setup = { equips: enemy1.getEquips().map(item => item.name), enemyHand: hand(enemy1) };
		}, async rec => {
			const probe = instrument(enemy1);
			const damage = captureDamage(enemy1);
			let useEvent = null;
			try { useEvent = actor.useCard(actor.getCards('h', 'sha')[0], enemy1); await useEvent; } finally { damage.restore(); probe.restore(); }
			rec.result = {
				ops: probe.log, equips: enemy1.getEquips().map(item => item.name), enemyHp: enemy1.hp,
				enemyHand: hand(enemy1), directHit: (useEvent && useEvent.directHit || []).map(nameOf),
				damage: damage.events.map(event => ({ num: event && event.num, player: event && event.player && event.player.playerid })),
			};
		});

		await scene('shenhua-huo-lianhuan-ally-risk', async rec => {
			actor.addSkill('lianhuan');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'club', 671]]);
			for (const player of game.players) {
				if (player === actor || player === ally) continue;
				if (!player.isLinked()) await player.link(true);
				player.update();
			}
			rec.setup = { hand: hand(actor), allyLinked: ally.isLinked(), othersLinked: game.players.filter(player => player !== actor && player !== ally).every(player => player.isLinked()) };
		}, async rec => {
			const probe = instrument(actor);
			const tiesuoTargets = [];
			const originalUseCard = actor.useCard;
			actor.useCard = function (cardInfo, cards, cardTargets, skill) {
				try { if (cardInfo && cardInfo.name === 'tiesuo') tiesuoTargets.push((cardTargets || []).map(nameOf)); } catch (e) {}
				return originalUseCard.apply(this, arguments);
			};
			try { await actor.phaseUse(); } finally { actor.useCard = originalUseCard; probe.restore(); }
			rec.result = {
				ops: probe.log, hand: hand(actor), allyLinked: ally.isLinked(), tiesuoTargets,
				recast: (probe.log || []).some(item => item && item.op === 'recast'),
				draws: (probe.log || []).filter(item => item && item.op === 'draw').length,
			};
		});

		await scene('shenhua-huo-lianhuan-recast', async rec => {
			actor.addSkill('lianhuan');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'club', 672]]);
			for (const player of game.players) {
				if (player === actor) continue;
				if (!player.isLinked()) await player.link(true);
				player.update();
			}
			rec.setup = { hand: hand(actor), linked: game.players.filter(player => player.isLinked()).length };
		}, async rec => {
			const probe = instrument(actor);
			const capture = captureTiesuoTargets(actor);
			try { await actor.phaseUse(); } finally { capture.restore(); probe.restore(); }
			const targets = capture.targets.flat();
			rec.result = {
				ops: probe.log, hand: hand(actor), linked: game.players.filter(player => player.isLinked()).length,
				targets: targets.map(describePlayer), targetIds: targets.map(player => player.playerid),
				links: links(),
				recast: (probe.log || []).some(item => item && item.op === 'recast'),
				draws: (probe.log || []).filter(item => item && item.op === 'draw').length,
			};
		});

		await scene('shenhua-huo-lianhuan-unlink-ally-risk', async rec => {
			actor.addSkill('lianhuan');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'club', 900]]);
			ally.hp = 1; ally.maxHp = 4;
			enemy1.addSkill('huoji');
			await give(enemy1, [['sha', 'heart', 901]]);
			await linkPlayers(game.players.filter(player => player !== actor));
			rec.setup = {
				hand: hand(actor), allyHp: ally.hp,
				enemyFireSkill: enemy1.hasSkill('huoji'),
				links: links(),
			};
		}, async rec => {
			const probe = instrument(actor);
			const capture = captureTiesuoTargets(actor);
			try { await actor.phaseUse(); } finally { capture.restore(); probe.restore(); }
			const targets = capture.targets.flat();
			rec.result = {
				ops: probe.log, targets: targets.map(describePlayer), targetIds: targets.map(player => player.playerid),
				recast: (probe.log || []).some(item => item && item.op === 'recast'),
				draws: (probe.log || []).filter(item => item && item.op === 'draw').length,
				links: links(), allyHp: ally.hp, allyLinked: ally.isLinked(),
			};
		});

		await scene('shenhua-huo-lianhuan-keep-enemy-linked', async rec => {
			actor.addSkill('lianhuan');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'club', 910]]);
			enemy1.hp = 2; enemy2.hp = 2;
			await linkPlayers(game.players.filter(player => player !== actor && player !== ally));
			rec.setup = { hand: hand(actor), links: links(), enemyHp: { [enemy1.playerid]: enemy1.hp, [enemy2.playerid]: enemy2.hp } };
		}, async rec => {
			const probe = instrument(actor);
			const capture = captureTiesuoTargets(actor);
			try { await actor.phaseUse(); } finally { capture.restore(); probe.restore(); }
			const targets = capture.targets.flat();
			const linkedBeforeDamage = links();
			let chain = null;
			if (enemy1.isLinked() && enemy2.isLinked()) {
				const before = { [enemy1.playerid]: enemy1.hp, [enemy2.playerid]: enemy2.hp };
				await enemy1.damage(1, 'fire', actor);
				chain = {
					before,
					after: { [enemy1.playerid]: enemy1.hp, [enemy2.playerid]: enemy2.hp },
					links: links(),
				};
			}
			rec.result = {
				ops: probe.log, targets: targets.map(describePlayer), targetIds: targets.map(player => player.playerid),
				recast: (probe.log || []).some(item => item && item.op === 'recast'),
				draws: (probe.log || []).filter(item => item && item.op === 'draw').length,
				links: linkedBeforeDamage, chain,
			};
		});

		await scene('shenhua-huo-lianhuan-full-linked-recast', async rec => {
			actor.addSkill('lianhuan');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'club', 920]]);
			for (const player of game.players) player.addSkill('ns_xiandao');
			const others = game.players.filter(player => player !== actor);
			for (let index = 0; index < others.length; index++) {
				const player = others[index];
				await give(player, [0, 1, 2, 3].map(offset => ['shan', 'diamond', 921 + index * 10 + offset]));
			}
			await linkPlayers(game.players);
			rec.setup = {
				hand: hand(actor), links: links(), allImmune: game.players.every(player => player.hasSkillTag('nofire') && player.hasSkillTag('nothunder')),
				otherHands: Object.fromEntries(others.map(player => [player.playerid, player.countCards('h')])),
			};
		}, async rec => {
			const probe = instrument(actor);
			const capture = captureTiesuoTargets(actor);
			try { await actor.phaseUse(); } finally { capture.restore(); probe.restore(); }
			const targets = capture.targets.flat();
			rec.result = {
				ops: probe.log, targets: targets.map(describePlayer), targetIds: targets.map(player => player.playerid),
				recast: (probe.log || []).some(item => item && item.op === 'recast'),
				draws: (probe.log || []).filter(item => item && item.op === 'draw').length,
				links: links(), hand: hand(actor),
			};
		});

		await scene('shenhua-huo-lianhuan-link-enemies', async rec => {
			actor.addSkill('lianhuan');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'club', 950]]);
			enemy1.hp = 2; enemy2.hp = 2;
			await linkPlayers(game.players.filter(player => player !== actor && player !== enemy1 && player !== enemy2));
			rec.setup = { hand: hand(actor), links: links(), enemyHp: { [enemy1.playerid]: enemy1.hp, [enemy2.playerid]: enemy2.hp } };
		}, async rec => {
			const probe = instrument(actor);
			const capture = captureTiesuoTargets(actor);
			try { await actor.phaseUse(); } finally { capture.restore(); probe.restore(); }
			const targets = capture.targets.flat();
			const linkedBeforeDamage = links();
			let chain = null;
			if (enemy1.isLinked() && enemy2.isLinked()) {
				const before = { [enemy1.playerid]: enemy1.hp, [enemy2.playerid]: enemy2.hp };
				await enemy1.damage(1, 'fire', actor);
				chain = {
					before,
					after: { [enemy1.playerid]: enemy1.hp, [enemy2.playerid]: enemy2.hp },
					links: links(),
				};
			}
			rec.result = {
				ops: probe.log, targets: targets.map(describePlayer), targetIds: targets.map(player => player.playerid),
				recast: (probe.log || []).some(item => item && item.op === 'recast'),
				links: linkedBeforeDamage, chain,
			};
		});

		await scene('shenhua-huo-lianhuan-unlinked-ally-only', async rec => {
			actor.addSkill('lianhuan');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'club', 960]]);
			await linkPlayers(game.players.filter(player => player !== actor && player !== ally));
			rec.setup = { hand: hand(actor), allyLinked: ally.isLinked(), links: links() };
		}, async rec => {
			const probe = instrument(actor);
			const capture = captureTiesuoTargets(actor);
			try { await actor.phaseUse(); } finally { capture.restore(); probe.restore(); }
			const targets = capture.targets.flat();
			rec.result = {
				ops: probe.log, targets: targets.map(describePlayer), targetIds: targets.map(player => player.playerid),
				recast: (probe.log || []).some(item => item && item.op === 'recast'),
				draws: (probe.log || []).filter(item => item && item.op === 'draw').length,
				links: links(),
			};
		});

		await scene('shenhua-huo-lianhuan-self-linked', async rec => {
			actor.addSkill('lianhuan');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'club', 970]]);
			await linkPlayers(game.players.filter(player => player !== ally));
			rec.setup = { hand: hand(actor), actorLinked: actor.isLinked(), allyLinked: ally.isLinked(), links: links() };
		}, async rec => {
			const probe = instrument(actor);
			const capture = captureTiesuoTargets(actor);
			try { await actor.phaseUse(); } finally { capture.restore(); probe.restore(); }
			const targets = capture.targets.flat();
			rec.result = {
				ops: probe.log, targets: targets.map(describePlayer), targetIds: targets.map(player => player.playerid),
				recast: (probe.log || []).some(item => item && item.op === 'recast'),
				draws: (probe.log || []).filter(item => item && item.op === 'draw').length,
				links: links(), actorLinked: actor.isLinked(),
			};
		});

		await scene('shenhua-huo-lianhuan-recast-blocked', async rec => {
			actor.addSkill('lianhuan');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'club', 980]]);
			await linkPlayers(game.players.slice());
			rec.setup = { hand: hand(actor), links: links(), recastBlocked: true };
		}, async rec => {
			const probe = instrument(actor);
			const capture = captureTiesuoTargets(actor);
			const originalCanRecast = actor.canRecast;
			actor.canRecast = () => false;
			try { await actor.phaseUse(); } finally { actor.canRecast = originalCanRecast; capture.restore(); probe.restore(); }
			const targets = capture.targets.flat();
			rec.result = {
				ops: probe.log, targets: targets.map(describePlayer), targetIds: targets.map(player => player.playerid),
				recast: (probe.log || []).some(item => item && item.op === 'recast'),
				draws: (probe.log || []).filter(item => item && item.op === 'draw').length,
				links: links(), actorLinked: actor.isLinked(), allyLinked: ally.isLinked(),
			};
		});

		// 质量审查候选：原生AI在合法选择中是否明显次优。场景只固定公开局面。
		await scene('quality-luanji-ally-lethal', async rec => {
			actor.addSkill('luanji');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['wugu', 'spade', 1091], ['wugu', 'spade', 1092]]);
			ally.hp = 1; ally.maxHp = 4; ally.update();
			enemy1.hp = 2; enemy1.maxHp = 4; enemy2.hp = 2; enemy2.maxHp = 4;
			enemy1.update(); enemy2.update();
			rec.setup = { hand: hand(actor), allyHp: ally.hp, enemyHp: [enemy1.hp, enemy2.hp] };
		}, async rec => {
			// 只取AI决策分，不真正结算万箭：1血空手队友一旦被命中会进入濒死，
			// 死亡/救援夹具在部分种子会卡住宿主；伤害与结算由 enemy-lethal 场景覆盖。
			const cardx = actor.getCards('h', 'wugu')[0];
			const check = lib.skill.luanji.check(cardx);
			rec.result = {
				check,
				allyHp: ally.hp,
				hand: hand(actor),
				uses: [],
			};
		});

		await scene('quality-luanji-enemy-lethal', async rec => {
			actor.addSkill('luanji');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['shan', 'spade', 1094], ['shan', 'spade', 1095], ['shan', 'spade', 1096]]);
			ally.hp = 4; ally.maxHp = 4; ally.update();
			enemy1.hp = 1; enemy1.maxHp = 4; enemy2.hp = 2; enemy2.maxHp = 4;
			enemy1.update(); enemy2.update();
			rec.setup = { hand: hand(actor), allyHp: ally.hp, enemyHp: [enemy1.hp, enemy2.hp] };
		}, async rec => {
			const probe = instrument(actor);
			const uses = [];
			const originalUseCard = actor.useCard;
			actor.useCard = function (cardInfo, cards, targets, skill) {
				try {
					if (cardInfo && cardInfo.name === 'wanjian') uses.push({ skill, targets: (targets || []).map(nameOf) });
				} catch (e) {}
				return originalUseCard.apply(this, arguments);
			};
			try { await actor.phaseUse(); } finally { actor.useCard = originalUseCard; probe.restore(); }
			rec.result = {
				ops: probe.log, uses,
				allyHp: ally.hp, allyDead: !!ally.dead,
				enemy1Hp: enemy1.hp, enemy1Dead: !!enemy1.dead, enemy2Hp: enemy2.hp,
			};
		});

		await scene('quality-qiangxix-crossbow', async rec => {
			actor.addSkill('qiangxix');
			actor.hp = 4; actor.maxHp = 4;
			await actor.equip(card('zhuge', 'club', 1095));
			await give(actor, [['sha', 'spade', 1096], ['sha', 'spade', 1097], ['sha', 'spade', 1098]]);
			enemy1.hp = 4; enemy1.maxHp = 4; enemy1.update();
			rec.setup = { hand: hand(actor), weapon: actor.getEquips(1).map(c => c.name), enemyHp: enemy1.hp };
		}, async rec => {
			await phaseTurn(rec);
			rec.result = {
				weapon: actor.getEquips(1).map(c => c.name),
				enemyHp: enemy1.hp, enemyDead: !!enemy1.dead,
				skills: actor.getSkills().filter(skill => lib.skill[skill]),
			};
		});

		await scene('quality-qiangxix-zhangba', async rec => {
			actor.addSkill('qiangxix');
			actor.hp = 4; actor.maxHp = 4;
			await actor.equip(card('zhangba', 'club', 1099));
			await give(actor, [['sha', 'spade', 1201], ['sha', 'spade', 1202], ['sha', 'spade', 1203]]);
			enemy1.hp = 4; enemy1.maxHp = 4; enemy1.update();
			rec.setup = { hand: hand(actor), weapon: actor.getEquips(1).map(c => c.name), enemyHp: enemy1.hp };
		}, async rec => {
			await phaseTurn(rec);
			rec.result = {
				weapon: actor.getEquips(1).map(c => c.name),
				enemyHp: enemy1.hp, enemyDead: !!enemy1.dead,
			};
		});

		await scene('quality-guhuo-true-questioned', async rec => {
			actor.addSkill('xinfu_guhuo');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 1204], ['wugu', 'spade', 1205]]);
			rec.randomValue = 0.9;
			enemy1.hp = 2; enemy1.maxHp = 4; enemy1.update();
			rec.setup = { hand: hand(actor), enemyHp: enemy1.hp };
		}, async rec => {
			const restores = game.players.filter(player => player !== actor).map(player => forceGuhuoAnswer(player, false));
			const damage = captureDamage(enemy1);
			const buttonChoices = [], cardChoices = [], useCalls = [];
			const restoreButton = wrapAIResult(actor, 'chooseButton', result => buttonChoices.push((result.links || []).map(link => link && link[2] || String(link))));
			const restoreCard = wrapAIResult(actor, 'chooseCard', result => cardChoices.push((result.cards || []).map(item => item.name)));
			const originalUseCard = actor.useCard;
			actor.useCard = function (...args) {
				try { useCalls.push({ card: args[0] && args[0].name || null, skill: typeof args[3] === 'string' ? args[3] : null }); } catch (e) {}
				return originalUseCard.apply(this, args);
			};
			let choiceEvent = null;
			try {
				await runWithMathRandom(0.9, async () => {
					choiceEvent = actor.chooseToUse({ type: 'phase', filterCard: cardx => cardx.name === 'sha' });
					await choiceEvent;
				});
			} finally { actor.useCard = originalUseCard; restoreCard(); restoreButton(); damage.restore(); restores.forEach(restore => restore()); }
			const choiceResult = choiceEvent && choiceEvent.result || {};
			rec.choice = recordChoice(choiceResult);
			rec.declared = choiceResult.card && choiceResult.card.name || (buttonChoices.flat()[0] || null);
			rec.hidden = (choiceResult.cards || []).map(item => item.name).concat(cardChoices.flat());
			rec.buttonChoices = buttonChoices;
			rec.cardChoices = cardChoices;
			rec.useCalls = useCalls;
			rec.actorHp = actor.hp;
			rec.enemyHp = enemy1.hp;
			rec.guhuoPhase = actor.hasSkill('guhuo_phase');
			rec.damage = damage.events.map(item => ({ num: item && item.num, player: item && item.player && item.player.playerid }));
		});

		await scene('quality-kuanggu-lowhp', async rec => {
			actor.addSkill('xinkuanggu');
			actor.hp = 1; actor.maxHp = 4;
			const target = game.players.find(player => player !== actor && get.distance(actor, player) <= 1) || enemy1;
			target.hp = 3; target.maxHp = 4; target.update();
			rec.setup = { hp: actor.hp, hand: hand(actor), target: nameOf(target), distance: get.distance(actor, target) };
		}, async rec => {
			const target = game.players.find(player => player !== actor && get.distance(actor, player) <= 1) || enemy1;
			const probe = instrument(actor);
			try { await target.damage(1, actor); } finally { probe.restore(); }
			rec.result = { ops: probe.log, hp: actor.hp, hand: hand(actor), enemyHp: target.hp };
		});

		await scene('quality-kuanggu-midhp', async rec => {
			actor.addSkill('xinkuanggu');
			actor.hp = 3; actor.maxHp = 4;
			const target = game.players.find(player => player !== actor && get.distance(actor, player) <= 1) || enemy1;
			target.hp = 3; target.maxHp = 4; target.update();
			rec.setup = { hp: actor.hp, hand: hand(actor), target: nameOf(target), distance: get.distance(actor, target) };
		}, async rec => {
			const target = game.players.find(player => player !== actor && get.distance(actor, player) <= 1) || enemy1;
			const probe = instrument(actor);
			try { await target.damage(1, actor); } finally { probe.restore(); }
			rec.result = { ops: probe.log, hp: actor.hp, hand: hand(actor), enemyHp: target.hp };
		});

		await scene('quality-releiji-linked-ally', async rec => {
			actor.addSkill('releiji');
			await give(actor, [['shan', 'heart', 1301]]);
			ally.hp = 1; ally.maxHp = 4;
			enemy1.hp = 4; enemy1.maxHp = 4;
			enemy2.hp = 4; enemy2.maxHp = 4;
			await linkPlayers([ally, enemy1, enemy2]);
			rec.setup = { hand: hand(actor), allyHp: ally.hp, links: links() };
		}, async rec => {
			const event = { skill: 'releiji' };
			const trigger = { card: { name: 'shan' }, player: actor };
			const judges = forceJudgeSuit(game.players, 'spade');
			const damages = game.players.map(player => captureDamage(player));
			try {
				await lib.skill.releiji.cost(event, trigger, actor);
				if (event.result && event.result.bool && event.result.targets && event.result.targets.length) {
					await lib.skill.releiji.content({ skill: 'releiji', targets: event.result.targets, result: event.result }, trigger, actor);
				}
			} finally { damages.forEach(item => item.restore()); judges.restore(); }
			rec.result = {
				selected: (event.result && event.result.targets || []).map(nameOf),
				damage: damages.flatMap(item => item.events).map(item => ({
					num: item && item.num, player: item && item.player && item.player.playerid,
					source: item && item.source && item.source.playerid,
				})),
				allyHp: ally.hp, allyDead: !!ally.dead, links: links(),
			};
		});

		await scene('quality-releiji-unlinked-ally', async rec => {
			actor.addSkill('releiji');
			await give(actor, [['shan', 'heart', 1302]]);
			ally.hp = 4; ally.maxHp = 4;
			enemy1.hp = 4; enemy1.maxHp = 4;
			enemy2.hp = 4; enemy2.maxHp = 4;
			await linkPlayers([enemy1, enemy2]);
			rec.setup = { hand: hand(actor), allyHp: ally.hp, links: links() };
		}, async rec => {
			const event = { skill: 'releiji' };
			const trigger = { card: { name: 'shan' }, player: actor };
			const judges = forceJudgeSuit(game.players, 'spade');
			const damages = game.players.map(player => captureDamage(player));
			try {
				await lib.skill.releiji.cost(event, trigger, actor);
				if (event.result && event.result.bool && event.result.targets && event.result.targets.length) {
					await lib.skill.releiji.content({ skill: 'releiji', targets: event.result.targets, result: event.result }, trigger, actor);
				}
			} finally { damages.forEach(item => item.restore()); judges.restore(); }
			rec.result = {
				selected: (event.result && event.result.targets || []).map(nameOf),
				damage: damages.flatMap(item => item.events).map(item => ({
					num: item && item.num, player: item && item.player && item.player.playerid,
					source: item && item.source && item.source.playerid,
				})),
				allyHp: ally.hp, allyDead: !!ally.dead, links: links(),
			};
		});

		await scene('quality-shuangxiong-3cards', async rec => {
			actor.addSkill('shuangxiong');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 1303], ['shan', 'heart', 1304], ['sha', 'club', 1305]]);
			enemy1.hp = 3; enemy1.maxHp = 4; enemy1.update();
			rec.setup = { hand: hand(actor), enemyHp: enemy1.hp };
		}, async rec => {
			const judges = forceJudgeSuit([actor], 'heart');
			const probe = instrument(actor);
			const uses = [];
			const originalUseCard = actor.useCard;
			actor.useCard = function (cardInfo, cards, targets, skill) {
				try { uses.push({ card: cardInfo && cardInfo.name || null, targets: (targets || []).map(nameOf), skill: typeof skill === 'string' ? skill : null }); } catch (e) {}
				return originalUseCard.apply(this, arguments);
			};
			try { await actor.phaseDraw(); await actor.phaseUse(); } finally { actor.useCard = originalUseCard; probe.restore(); judges.restore(); }
			rec.result = {
				ops: probe.log, uses, judges: judges.calls,
				viewas: actor.hasSkill('shuangxiong_viewas'),
				storage: actor.getStorage ? actor.getStorage('shuangxiong_viewas') : null,
				hand: hand(actor), enemyHp: enemy1.hp,
			};
		});

		await scene('quality-shuangxiong-forced', async rec => {
			actor.addSkill('shuangxiong');
			actor.hp = 4; actor.maxHp = 4;
			await give(actor, [['sha', 'spade', 1306], ['shan', 'heart', 1307], ['sha', 'club', 1308]]);
			enemy1.hp = 3; enemy1.maxHp = 4; enemy1.update();
			rec.setup = { hand: hand(actor), enemyHp: enemy1.hp };
		}, async rec => {
			const originalCheck = lib.skill.shuangxiong_judge.check;
			lib.skill.shuangxiong_judge.check = () => true;
			const judges = forceJudgeSuit([actor], 'heart');
			const probe = instrument(actor);
			const damages = game.players.map(player => captureDamage(player));
			const uses = [];
			const originalUseCard = actor.useCard;
			actor.useCard = function (cardInfo, cards, targets, skill) {
				try { uses.push({ card: cardInfo && cardInfo.name || null, targets: (targets || []).map(nameOf), skill: typeof skill === 'string' ? skill : null }); } catch (e) {}
				return originalUseCard.apply(this, arguments);
			};
			try { await actor.phaseDraw(); await actor.phaseUse(); } finally {
				lib.skill.shuangxiong_judge.check = originalCheck;
				actor.useCard = originalUseCard; probe.restore(); judges.restore(); damages.forEach(item => item.restore());
			}
			rec.result = {
				ops: probe.log, uses, judges: judges.calls,
				viewas: actor.hasSkill('shuangxiong_viewas'),
				storage: actor.getStorage ? actor.getStorage('shuangxiong_viewas') : null,
				hand: hand(actor), enemyHp: enemy1.hp,
				hpAfter: Object.fromEntries(game.players.map(player => [player.playerid, player.hp])),
				damage: damages.flatMap(item => item.events).map(item => ({ num: item && item.num, player: item && item.player && item.player.playerid })),
			};
		});

		await scene('quality-card-values', async rec => {
			rec.setup = { hand: hand(actor) };
		}, async rec => {
			const names = ['sha', 'shan', 'tao', 'wuxie', 'wugu', 'juedou', 'nanman', 'wanjian', 'shandian', 'tiesuo', 'huogong', 'jiu', 'lebu'];
			const values = {};
			for (const name of names) {
				const cardx = card(name, 'spade', 1400 + Object.keys(values).length);
				await actor.gain(cardx, 'gain2');
				try { values[name] = get.value(cardx, actor); } catch (error) { values[name] = String(error); }
				await actor.discard(cardx);
			}
			const equipValues = {};
			for (const name of ['zhuge', 'zhangba', 'qinggang', 'bagua']) {
				const cardx = card(name, 'club', 1500 + Object.keys(equipValues).length);
				equipValues[name] = {
					equip: (() => { try { return get.equipValue(cardx, actor); } catch (error) { return String(error); } })(),
					value: (() => { try { return get.value(cardx, actor); } catch (error) { return String(error); } })(),
				};
			}
			rec.result = { values, equipValues };
		});

		await scene('quality-qiangxix-check', async rec => {
			actor.addSkill('qiangxix');
			actor.hp = 4; actor.maxHp = 4;
			await actor.equip(card('zhuge', 'club', 1513));
			await give(actor, [['sha', 'spade', 1514], ['sha', 'spade', 1515], ['sha', 'spade', 1516]]);
			enemy1.hp = 4; enemy1.maxHp = 4; enemy1.update();
			rec.setup = { hand: hand(actor), weapon: actor.getEquips(1).map(c => c.name) };
		}, async rec => {
			const calls = [];
			const original = lib.skill.qiangxix.check;
			lib.skill.qiangxix.check = function (cardx) {
				calls.push({ name: cardx && cardx.name, subtype: cardx && get.subtype(cardx) });
				return cardx && get.subtype(cardx) === 'equip1' ? -100 : 0;
			};
			try { await phaseTurn(rec); } finally {
				if (original === undefined) delete lib.skill.qiangxix.check;
				else lib.skill.qiangxix.check = original;
			}
			rec.result = { calls, weapon: actor.getEquips(1).map(c => c.name), enemyHp: enemy1.hp, ops: rec.ops };
		});

		await scene('quality-qiangxix-ai1', async rec => {
			actor.addSkill('qiangxix');
			actor.hp = 4; actor.maxHp = 4;
			await actor.equip(card('zhuge', 'club', 1509));
			await give(actor, [['sha', 'spade', 1510], ['sha', 'spade', 1511], ['sha', 'spade', 1512]]);
			enemy1.hp = 4; enemy1.maxHp = 4; enemy1.update();
			rec.setup = { hand: hand(actor), weapon: actor.getEquips(1).map(c => c.name) };
		}, async rec => {
			const calls = [];
			const original = lib.skill.qiangxix.ai1;
			lib.skill.qiangxix.ai1 = function (cardx) {
				calls.push({ name: cardx && cardx.name, subtype: cardx && get.subtype(cardx) });
				return cardx && get.subtype(cardx) === 'equip1' ? -100 : 0;
			};
			try { await phaseTurn(rec); } finally {
				if (original === undefined) delete lib.skill.qiangxix.ai1;
				else lib.skill.qiangxix.ai1 = original;
			}
			rec.result = { calls, weapon: actor.getEquips(1).map(c => c.name), enemyHp: enemy1.hp, ops: rec.ops };
		});

		await scene('quality-qiangxix-debug', async rec => {
			actor.addSkill('qiangxix');
			actor.hp = 4; actor.maxHp = 4;
			await actor.equip(card('zhuge', 'club', 1505));
			await give(actor, [['sha', 'spade', 1506], ['sha', 'spade', 1507], ['sha', 'spade', 1508]]);
			enemy1.hp = 4; enemy1.maxHp = 4; enemy1.update();
			rec.setup = { hand: hand(actor), weapon: actor.getEquips(1).map(c => c.name) };
		}, async rec => {
			const calls = [];
			const original = lib.skill.qiangxix.ai.result.player;
			lib.skill.qiangxix.ai.result.player = function (player, target) {
				const cards = (globalThis.ui && globalThis.ui.selected && globalThis.ui.selected.cards || []).map(cardx => cardx.name);
				const out = original.apply(this, arguments);
				calls.push({ hp: player.hp, targetHp: target && target.hp, cards, out });
				return out;
			};
			try { await phaseTurn(rec); } finally { lib.skill.qiangxix.ai.result.player = original; }
			rec.result = { calls, weapon: actor.getEquips(1).map(c => c.name), enemyHp: enemy1.hp };
		});

		const policyStats = policyModule ? policyModule.skillAIPolicyStats() : null;
		try {
			const score = await import('/extension/无名AI/score/index.js?v=41a');
			const before = score.isScoreEngineEnabled();
			lib.config.extension_无名AI_decisionScore = false;
			const off = score.isScoreEngineEnabled();
			lib.config.extension_无名AI_decisionScore = true;
			const on = score.isScoreEngineEnabled();
			scenes.push({ name: 'engine-disabled-gate', before, off, on });
		} catch (e) {
			scenes.push({ name: 'engine-disabled-gate', error: String(e) });
		}
		if (policyModule) {
			const marked = () => ({
				rezhiheng: !!(lib.skill.rezhiheng && lib.skill.rezhiheng.check && lib.skill.rezhiheng.check.__djscSkillPolicy),
				qimou: !!(lib.skill.qimou && lib.skill.qimou.ai && lib.skill.qimou.ai.result && lib.skill.qimou.ai.result.player && lib.skill.qimou.ai.result.player.__djscSkillPolicy),
				reqimouContent: !!(lib.skill.reqimou && typeof lib.skill.reqimou.content === 'function' && lib.skill.reqimou.content.__djscSkillPolicy),
				reqimouGate: !!(lib.skill.reqimou && lib.skill.reqimou.ai && lib.skill.reqimou.ai.result && lib.skill.reqimou.ai.result.player && lib.skill.reqimou.ai.result.player.__djscSkillPolicy),
			});
			const before = marked();
			policyModule.uninstallSkillAIPolicies();
			const afterUninstall = marked();
			policyModule.installSkillAIPolicies();
			const afterReinstall = marked();
			scenes.push({
				name: 'policy-lifecycle',
				before, afterUninstall, afterReinstall,
				stats: policyStats,
				statsAfterReinstall: policyModule.skillAIPolicyStats(),
			});
		}
		if (opts.fullLifecycle && policyModule) {
			let error = null, afterUninstall = null, afterReinstall = null;
			try {
				const score = await import('/extension/无名AI/score/index.js?v=41a');
				score.uninstallScoreEngine();
				afterUninstall = policyModule.skillAIPolicyStats().installed;
				score.installScoreEngine();
				await new Promise(resolve => setTimeout(resolve, 300));
				afterReinstall = policyModule.skillAIPolicyStats().installed;
			} catch (e) { error = String(e); }
			scenes.push({ name: 'full-engine-lifecycle', afterUninstall, afterReinstall, error });
		}

		return {
			hostVersion: lib.version,
			mode: get.mode(),
			players: game.players.length,
			extensionInstalled: !!installExtension,
			policyStats,
			scenes,
		};
	}, { installExtension: !!options.installExtension, policyOnly: !!options.policyOnly, fullLifecycle: !!options.fullLifecycle, scenes: Array.isArray(options.scenes) ? options.scenes : null });

	assert.equal(report.mode, 'identity');
	assert(report.players >= 6);
	assert(report.scenes.every(scene => scene && scene.name));
	return report;
}
