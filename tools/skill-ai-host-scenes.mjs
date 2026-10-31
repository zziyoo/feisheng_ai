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
		const run = async (name, player, content) => {
			const event = game.createEvent(name, false);
			event.player = player;
			event.setContent(content);
			await game.loop(event);
		};
		const card = (name, suit = 'spade', number = 1) => game.createCard(name, suit, number);
		const hand = player => player.getCards('h').map(c => c.name);
		const counts = () => Object.fromEntries(game.players.map(p => [p.playerid, p.countCards('h')]));
		const nameOf = p => p.playerid + ':' + (p.name1 || p.name || '?');
		const reset = async () => {
			for (const p of game.players) {
				p.clearSkills(true);
				try {
					p.dead = false;
					if (Array.isArray(game.dead)) {
						const index = game.dead.indexOf(p);
						if (index >= 0) game.dead.splice(index, 1);
					}
				} catch (e) {}
				const cards = p.getCards('hej');
				if (cards.length) await p.discard(cards);
				p.hp = p.maxHp = 4;
				for (const key of Object.keys(p.storage || {})) delete p.storage[key];
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
		const scene = async (name, setup, action) => {
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
			for (const method of ['discard', 'lose', 'draw', 'useSkill', 'useCard', 'gain']) {
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
				const before = pm ? pm.skillAIPolicyStats().redimengTrace.length : 0;
				await actor.useSkill('redimeng', actor.getCards('h'), [ally, enemy1]);
				const gained = {
					[ally.playerid]: hand(ally),
					[enemy1.playerid]: hand(enemy1),
				};
				const indices = {
					[ally.playerid]: ally.getCards('h').map(c => pool.indexOf(c)),
					[enemy1.playerid]: enemy1.getCards('h').map(c => pool.indexOf(c)),
				};
				const trace = pm ? pm.skillAIPolicyStats().redimengTrace.slice(before) : [];
				return { gained, indices, trace, fairMasked: !!pm };
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

		// 击杀场景放在最后：避免死亡玩家从 game.players 移除后污染后续夹具。
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

		const policyStats = policyModule ? policyModule.skillAIPolicyStats() : null;
		if (policyModule) {
			const marked = () => !!(lib.skill.rezhiheng && lib.skill.rezhiheng.check && lib.skill.rezhiheng.check.__djscSkillPolicy);
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
	}, { installExtension: !!options.installExtension, policyOnly: !!options.policyOnly, fullLifecycle: !!options.fullLifecycle });

	assert.equal(report.mode, 'identity');
	assert(report.players >= 6);
	assert(report.scenes.every(scene => scene && scene.name));
	return report;
}
