// 神话再临·风固定局面的原生/扩展语义对照。
// 只比较技能选择、目标敌我、支付、伤害/回复和技能结算字段；座位与随机牌面单列为允许差异。
function findScene(report, name) {
	const scene = (report.scenes || []).find(item => item && item.name === name);
	if (!scene) throw new Error('宿主场景未执行：' + name);
	return scene;
}

export function shenhuaSceneSemantic(name, scene) {
	const actor = Object.keys(scene.before && scene.before.skills || {})[0];
	const ally = Object.keys(scene.before && scene.before.skills || {})[1];
	const idOnly = value => String(value || '').split(':')[0];
	const hand = (snapshot, id) => snapshot && snapshot.hand && snapshot.hand[id] || [];
	const opUsed = (op, predicate) => (scene.ops || []).some(item => item && item.op === op && (!predicate || predicate(item)));
	const damage = (scene.damage || [])[0];
	const hpDelta = id => Number(scene.after.hp[id]) - Number(scene.before.hp[id]);
	const isEnemy = id => !!id && id !== actor && id !== ally;
	const targets = (scene.selected || (scene.choice && scene.choice.targets) || (scene.targets || []).flat() || []).map(idOnly);
	const opUsesSkill = skill => (scene.ops || []).some(item => item && item.op === 'useSkill' && Array.isArray(item.args) && item.args[0] === skill);
	const opLoseHp = () => (scene.ops || []).filter(item => item && item.op === 'loseHp').reduce((sum, item) => sum + (Number(item.args && item.args[0]) || 0), 0);
	const result = scene.result || scene;
	const resultOps = result.ops || scene.ops || [];
	const resultUsesSkill = skill => resultOps.some(item => item && item.op === 'useSkill' && Array.isArray(item.args) && item.args[0] === skill);
	switch (name) {
		case 'quality-jushou-turned':
			return { drew: Number(result.drew), turned: result.turned === true, hp: Number(result.hp) };
		case 'quality-jushou-normal':
			return { drew: Number(result.drew), turned: result.turned === true };
		case 'quality-shensu1-lowhand-lebu':
			return { usedSha: !!result.usedSha, judgeSkipped: Number(result.judge) === 1, targetEnemy: isEnemy(result.target) };
		case 'quality-shensu1-reverse-lowvalue':
			return { usedSha: Number(result.usedSha || 0), judgeResolved: Number(result.judgeCalls || 0) > 0, lebuGone: !(result.judgeAfter || []).includes('lebu'), handCount: Number(result.handCount || 0) };
		case 'quality-guhuo-full-lowhp-fake-lastshan':
			return { activated: !!result.activated, keptShan: hand(scene.after, actor).includes('shan'), hp: Number(result.hpAfter), enemyHp: Number(result.enemyHpAfter) };
		case 'quality-guhuo-full-lowhp-true-sha-forced':
			return { activated: !!result.activated, guhuo: (result.useCalls || []).some(item => item && item.skill === 'xinfu_guhuo_backup'), enemyHp: Number(result.enemyHpAfter), chanyuan: !!result.enemyChanyuan, hp: Number(result.hpAfter) };
		case 'quality-guhuo-full-lowhp-fake-expendable':
			return { activated: !!result.activated, hiddenShandian: hand(scene.before, actor).includes('shandian') && !hand(scene.after, actor).includes('shandian'), keptShan: hand(scene.after, actor).includes('shan'), hp: Number(result.hpAfter), enemyHp: Number(result.enemyHpAfter) };
		case 'quality-guhuo-full-midhp-fake-expendable':
			return { activated: !!result.activated, hiddenShandian: (result.hidden || []).includes('shandian'), keptShan: hand(scene.after, actor).includes('shan'), enemyHp: Number(result.enemyHpAfter) };
		case 'quality-guhuo-bluff-lowhp': {
			const scores = result.checkScores || [];
			return { positive: scores.some(item => Number(item.out) > 0), zero: scores.length > 0 && scores.every(item => Number(item.out) === 0), hp: Number(result.hp) };
		}
		case 'quality-guhuo-bluff-midhp': {
			const scores = result.checkScores || [];
			return { positive: scores.some(item => Number(item.out) > 0), hp: Number(result.hp) };
		}
		case 'quality-huangtian-last-shan':
			return { used: resultUsesSkill('huangtian2'), keptShan: hand(scene.after, actor).includes('shan') };
		case 'quality-huangtian-last-shan-with-shandian':
			return { used: resultUsesSkill('huangtian2'), keptShan: hand(scene.after, actor).includes('shan'), allyGotShandian: hand(scene.after, ally).includes('shandian') };
		case 'quality-huangtian-forced-shan-with-shandian':
			return { used: resultUsesSkill('huangtian2'), keptShan: hand(scene.after, actor).includes('shan'), allyGotShan: hand(scene.after, ally).includes('shan') };
		case 'quality-huangtian-midhp':
			return { used: resultUsesSkill('huangtian2'), allyGotShan: hand(scene.after, ally).includes('shan') };
		case 'shenhua-releiji-target': {
			const targetDamage = (scene.damage || []).find(item => item && item.player === targets[0]);
			return { targetEnemy: isEnemy(targets[0]), thunderDamage: targetDamage && targetDamage.num, thunder: targetDamage && targetDamage.nature, hpDelta: targets[0] ? hpDelta(targets[0]) : null };
		}
		case 'shenhua-guidao-replace':
			return { replaced: !!scene.replaced, judgingSuit: scene.judging && scene.judging.suit, gainedOriginal: !!scene.gainedOriginal, pickedSpadeSha: (scene.picked || []).flat().some(card => card && card.name === 'sha' && card.suit === 'spade') };
		case 'shenhua-guidao-decline':
			return { replaced: !!scene.replaced, picked: (scene.picked || []).flat().length, judgingSuit: scene.judging && scene.judging.suit };
		case 'shenhua-huangtian-give':
			return { used: opUsed('useSkill', item => item.args && item.args[0] === 'huangtian2'), temp: (scene.tempCalls || []).some(item => item.skill === 'huangtian3'), allyGotShan: hand(scene.after, ally).includes('shan') };
		case 'shenhua-huangtian-negative':
			return { used: opUsed('useSkill', item => item.args && item.args[0] === 'huangtian2'), temp: (scene.tempCalls || []).length, allyHand: hand(scene.after, ally).length };
		case 'shenhua-guhuo-real-questioned':
			return { declaredSha: scene.declared === 'sha' && scene.hidden === 'sha', chanyuan: !!scene.enemyChanyuan, damage: damage && damage.num, cancelled: !!scene.cancelled };
		case 'shenhua-guhuo-fake-questioned': {
			const lost = hand(scene.before, actor).length - hand(scene.after, actor).length;
			const activated = scene.activated != null ? !!scene.activated : !!(scene.cancelled || lost > 0 || (scene.useCalls || []).length || scene.guhuoPhase);
			const outcome = !activated ? 'declined' : (scene.cancelled ? 'cancelled' : 'used');
			return { declaredSha: (scene.buttonChoices || []).flat().includes('sha') || scene.declared === 'sha', noDamage: !(scene.damage || []).length, noChanyuan: !scene.enemyChanyuan, outcome };
		}
		case 'shenhua-guhuo-claim':
			return { buttonSha: (scene.buttons || []).some(item => item && item.links && item.links.includes('sha')) };
		case 'shenhua-guhuo-phase':
			return { usedAny: (scene.ops || []).length > 0 };
		case 'shenhua-shensu-skip': {
			const used = (scene.ops || []).find(item => item && item.op === 'useCard' && item.args && item.args[0] === 'sha');
			const target = used ? String(used.args[1] || '').replace(/^P:/, '') : null;
			return { usedSha: !!used, targetEnemy: isEnemy(target), hpDelta: target ? hpDelta(target) : null, judgeSkipped: scene.shensuAfter && scene.shensuAfter.judge === 1 };
		}
		case 'shenhua-shensu-negative':
			return { usedSha: opUsed('useCard', item => item.args && item.args[0] === 'sha'), judgeResolved: scene.shensuAfter && scene.shensuAfter.judge === 0 };
		case 'shenhua-tianxiang-redirect': {
			const target = (scene.targets || []).flat().map(idOnly)[0];
			return { targetEnemy: isEnemy(target), control: (scene.controls || [])[0], actorHpDelta: hpDelta(actor), targetHpDelta: target ? hpDelta(target) : null, targetGotTao: target ? hand(scene.after, target).includes('tao') : false };
		}
		case 'shenhua-tianxiang-negative':
			return { targetCount: (scene.targets || []).length, actorHpDelta: hpDelta(actor), handKept: hand(scene.after, actor).length === hand(scene.before, actor).length };
		case 'shenhua-hongyan-suit':
			return { spadeSuit: scene.suits && scene.suits.spade, spadeColor: scene.colors && scene.colors.spade, heartSuit: scene.suits && scene.suits.heart };
		case 'shenhua-kuanggu-draw':
			return { choice: (scene.choices || [])[0], damage: damage && damage.num, draw: opUsed('draw', item => Number(item.args && item.args[0]) === 1), hpDelta: damage ? hpDelta(damage.player) : null };
		case 'shenhua-kuanggu-recover':
			return { choice: (scene.choices || [])[0], recover: opUsed('recover', item => Number(item.args && item.args[0]) === 1), draw: opUsed('draw', item => Number(item.args && item.args[0]) > 0), hpDelta: hpDelta(actor) };
		case 'shenhua-jushou-4hp-empty':
			return { draw: opUsed('draw'), turnedOver: !!(scene.jushouAfter && scene.jushouAfter.turnedOver) };
		case 'shenhua-jushou-lowhp':
			return { draw: (scene.ops || []).filter(item => item && item.op === 'draw').map(item => Number(item.args && item.args[0])).join(','), turnedOver: !!(scene.jushouAfter && scene.jushouAfter.turnedOver), hand: hand(scene.after, actor).length };
		case 'shenhua-buqu-damage':
			return { hp: scene.buquAfter && scene.buquAfter.hp, expansions: (scene.buquAfter && scene.buquAfter.expansions || []).length, dying: !!scene.buquAfter.dying, alive: !!scene.buquAfter.alive };
		case 'shenhua-buqu-negative':
			return { hp: scene.buquAfter && scene.buquAfter.hp, expansions: (scene.buquAfter && scene.buquAfter.expansions || []).length };
		case 'shenhua-buqu-recover-choice':
			return { hp: scene.buquAfter && scene.buquAfter.hp, expansions: (scene.buquAfter && scene.buquAfter.expansions || []).length, picks: (scene.recoverPicks || []).flat().length };
		case 'shenhua-liegong-hit':
			return { damage: damage && damage.num, directHit: !!(scene.useCard && scene.useCard.directHit && scene.useCard.directHit.length), extraDamage: scene.useCard && scene.useCard.extraDamage, hpDelta: damage ? hpDelta(damage.player) : null };
		case 'shenhua-liegong-negative':
			return { damage: damage && damage.num, directHit: !!(scene.useCard && scene.useCard.directHit && scene.useCard.directHit.length), extraDamage: scene.useCard && scene.useCard.extraDamage, hpDelta: damage ? hpDelta(damage.player) : null };
		case 'shenhua-huo-luanji-wanjian-use': {
			const data = scene.result || scene;
			const wanjian = (data.ops || scene.ops || []).filter(item => item && item.op === 'useCard' && item.args && item.args[0] === 'wanjian');
			const firstTargets = wanjian[0] && wanjian[0].args[2] || [];
			const hits = (data.damage || scene.damage || []).filter(item => item && isEnemy(item.player));
			return { used: wanjian.length > 0, skill: wanjian.every(item => item.args[3] === 'luanji'), targetCount: firstTargets.length, multiTarget: firstTargets.length >= 2, enemyDamaged: hits.length > 0 };
		}
		case 'shenhua-huo-luanji-wanjian':
			return { used: opUsed('useCard', item => item.args && item.args[0] === 'wanjian'), handCount: hand(scene.after, actor).length };
		case 'shenhua-huo-luanji-no-pair':
			return { used: opUsed('useCard', item => item.args && item.args[0] === 'wanjian'), handCount: hand(scene.after, actor).length };
		case 'shenhua-huo-huoji-use': {
			const data = scene.result || scene;
			const hits = (data.damage || scene.damage || []).filter(item => item && item.nature === 'fire' && isEnemy(item.player));
			return { usedHuogong: (data.ops || scene.ops || []).some(item => item && item.op === 'useCard' && item.args && item.args[0] === 'huogong'), fireDamage: hits.length > 0, enemyHpLoss: Object.keys(scene.before.hp).filter(id => isEnemy(id)).reduce((sum, id) => sum + Math.max(0, Number(scene.before.hp[id]) - Number(scene.after.hp[id] || 0)), 0) };
		}
		case 'shenhua-huo-huoji-red':
			return { usedHuogong: opUsed('useCard', item => item.args && item.args[0] === 'huogong') };
		case 'shenhua-huo-huoji-no-red':
			return { usedHuogong: opUsed('useCard', item => item.args && item.args[0] === 'huogong') };
		case 'shenhua-huo-kanpo-response': {
			const data = scene.result || scene;
			return { usedWuxie: (data.ops || scene.ops || []).some(item => item && item.op === 'useCard' && item.args && item.args[0] === 'wuxie' && item.args[3] === 'kanpo'), damageCount: (data.damage || scene.damage || []).length, actorHpDelta: hpDelta(actor) };
		}
		case 'shenhua-huo-kanpo-no-black': {
			const data = scene.result || scene;
			return { usedWuxie: (data.ops || scene.ops || []).some(item => item && item.op === 'useCard' && item.args && item.args[0] === 'wuxie'), damageCount: (data.damage || scene.damage || []).length, actorHpDelta: hpDelta(actor) };
		}
		case 'shenhua-huo-bazhen-bagua':
		case 'shenhua-huo-bazhen-armor-negative': {
			const data = scene.result || scene;
			return { extraSkill: !!scene.setup.bazhenExtra, judged: ((data.judges || scene.judges || []).length > 0), damageCount: (data.damage || scene.damage || []).length, actorHpDelta: hpDelta(actor) };
		}
		case 'shenhua-huo-quhu-compare': {
			const data = scene.result || scene;
			const list = (data.targets || scene.targets || []).flat().map(idOnly);
			return { usedQuhu: (data.ops || scene.ops || []).some(item => item && item.op === 'useSkill' && item.args && item.args[0] === 'quhu'), targetEnemy: list.every(isEnemy), damage: (data.damage || scene.damage || []).length };
		}
		case 'shenhua-huo-quhu-no-target':
		case 'shenhua-huo-quhu-risky-decline':
			return { usedQuhu: ((scene.result || scene).ops || []).some(item => item && item.op === 'useSkill' && item.args && item.args[0] === 'quhu'), actorHp: (scene.result || scene).actorHp };
		case 'shenhua-huo-jieming-damage': {
			const data = scene.result || scene;
			const list = (data.targets || []).flat().map(idOnly);
			return { targetAlly: list.length > 0 && list.every(id => id === ally), allyDraw: hand(scene.after, ally).length - hand(scene.before, ally).length };
		}
		case 'shenhua-huo-jieming-no-benefit': {
			const data = scene.result || scene;
			const list = (data.targets || []).flat().filter(Boolean).map(idOnly);
			return { targetCount: list.length, allyHandDelta: hand(scene.after, ally).length - hand(scene.before, ally).length, enemyHandDelta: Object.keys(scene.before.hp).filter(id => isEnemy(id) && scene.before.hand[id]).reduce((sum, id) => sum + hand(scene.after, id).length - hand(scene.before, id).length, 0), drawCalls: (data.ops || scene.ops || []).filter(item => item && item.op === 'draw').length };
		}
		case 'shenhua-huo-oldniepan-dying':
			return { usedOldniepan: ((scene.result || scene).ops || []).some(item => item && item.op === 'useSkill' && item.args && item.args[0] === 'oldniepan'), hp: (scene.result || scene).hp, handCount: hand(scene.after, actor).length, alive: !!(scene.result || scene).alive };
		case 'shenhua-huo-oldniepan-tao':
			return { usedOldniepan: ((scene.result || scene).ops || []).some(item => item && item.op === 'useSkill' && item.args && item.args[0] === 'oldniepan'), usedTao: ((scene.result || scene).ops || []).some(item => item && item.op === 'useCard' && item.args && item.args[0] === 'tao'), hp: (scene.result || scene).hp };
		case 'shenhua-huo-tianyi-compare': {
			const data = scene.result || scene;
			return { tianyi2: !!data.tianyi2, tianyi3: !!data.tianyi3, handCount: hand(scene.after, actor).length };
		}
		case 'shenhua-huo-tianyi-win-sha':
		case 'shenhua-huo-tianyi-lose-sha': {
			const data = scene.result || scene;
			const enemyHpLoss = Object.keys(scene.before.hp).filter(id => isEnemy(id)).reduce((sum, id) => sum + Math.max(0, Number(scene.before.hp[id]) - Number(scene.after.hp[id] || 0)), 0);
			return { usedTianyi: (data.ops || scene.ops || []).some(item => item && item.op === 'useSkill' && item.args && item.args[0] === 'tianyi'), tianyi2: !!data.tianyi2, tianyi3: !!data.tianyi3, shaUsed: (data.ops || scene.ops || []).some(item => item && item.op === 'useCard' && item.args && item.args[0] === 'sha'), enemyDamaged: enemyHpLoss > 0 };
		}
		case 'shenhua-huo-tianyi-lose-content':
			return { tianyi3: !!(scene.result || scene).tianyi3, shaEnabled: (scene.result || scene).shaEnabled };
		case 'shenhua-huo-shuangxiong-judge':
			return { viewas: !!(scene.result || scene).viewas };
		case 'shenhua-huo-shuangxiong-duel': {
			const data = scene.result || scene;
			const juedou = (data.ops || scene.ops || []).filter(item => item && item.op === 'useCard' && item.args && item.args[0] === 'juedou' && item.args[3] === 'shuangxiong_viewas');
			const enemyHpLoss = Object.keys(scene.before.hp).filter(id => isEnemy(id)).reduce((sum, id) => sum + Math.max(0, Number(scene.before.hp[id]) - Number(scene.after.hp[id] || 0)), 0);
			return { judged: ((data.judges || scene.judges || []).length > 0), viewas: !!data.viewas, juedouUsed: juedou.length > 0, enemyDamaged: enemyHpLoss > 0 };
		}
		case 'shenhua-huo-shuangxiong-no-judge':
			return { judged: ((scene.result || scene).judges || []).length > 0, viewas: !!(scene.result || scene).viewas };
		case 'shenhua-huo-jianchu-sha': {
			const data = scene.result || scene;
			return { directHit: (data.directHit || []).length > 0, equips: (data.equips || []).length, enemyHpDelta: Object.keys(scene.before.hp).filter(id => isEnemy(id)).reduce((sum, id) => sum + Math.max(0, Number(scene.before.hp[id]) - Number(scene.after.hp[id] || 0)), 0) };
		}
		case 'shenhua-huo-jianchu-no-equip': {
			const data = scene.result || scene;
			return { directHit: (data.directHit || []).length > 0, enemyGainedSha: (data.enemyHand || []).includes('sha'), enemyHpDelta: Object.keys(scene.before.hp).filter(id => isEnemy(id)).reduce((sum, id) => sum + Math.max(0, Number(scene.before.hp[id]) - Number(scene.after.hp[id] || 0)), 0) };
		}
		case 'shenhua-huo-lianhuan-tiesuo': {
			const data = scene.result || scene;
			const targetsList = (data.tiesuoTargets || []).flat().map(idOnly);
			return { usedTiesuo: targetsList.length > 0, targetCount: targetsList.length, targetsAllEnemies: targetsList.every(isEnemy), recast: !!data.recast };
		}
		case 'shenhua-huo-lianhuan-ally-risk': {
			const data = scene.result || scene;
			const targetsList = (data.tiesuoTargets || []).flat().map(idOnly);
			return { usedTiesuo: targetsList.length > 0, recast: !!data.recast, allyTargeted: targetsList.includes(ally) };
		}
		case 'shenhua-huo-lianhuan-recast': {
			const data = scene.result || scene;
			const targetsList = (data.targetIds || (data.tiesuoTargets || []).flat()).map(idOnly);
			return { usedTiesuo: targetsList.length > 0, targetAlly: targetsList.includes(ally), recast: !!data.recast, draws: Number(data.draws) || 0, allyLinkedAfter: (data.links || {})[ally] };
		}
		case 'shenhua-huo-lianhuan-unlink-ally-risk': {
			const data = scene.result || scene;
			const targetsList = (data.targetIds || []).map(idOnly);
			return { usedTiesuo: targetsList.length > 0, targetAlly: targetsList.includes(ally), recast: !!data.recast, draws: Number(data.draws) || 0, allyLinkedAfter: data.allyLinked };
		}
		case 'shenhua-huo-lianhuan-keep-enemy-linked': {
			const data = scene.result || scene;
			const enemy1 = Object.keys(scene.before.hp || {})[2];
			const enemy2 = Object.keys(scene.before.hp || {})[3];
			return {
				usedTiesuo: (data.targetIds || []).length > 0,
				recast: !!data.recast,
				enemy1Linked: (data.links || {})[enemy1],
				enemy2Linked: (data.links || {})[enemy2],
				chainDamage: data.chain ? [Number(data.chain.after[enemy1]) - Number(data.chain.before[enemy1]), Number(data.chain.after[enemy2]) - Number(data.chain.before[enemy2])] : null,
			};
		}
		case 'shenhua-huo-lianhuan-full-linked-recast': {
			const data = scene.result || scene;
			return {
				usedTiesuo: (data.targetIds || []).length > 0,
				recast: !!data.recast,
				allLinked: Object.values(data.links || {}).every(Boolean),
				allImmune: !!(scene.setup && scene.setup.allImmune),
			};
		}
		case 'shenhua-huo-lianhuan-link-enemies': {
			const data = scene.result || scene;
			const enemy1 = Object.keys(scene.before.hp || {})[2];
			const enemy2 = Object.keys(scene.before.hp || {})[3];
			const targetsList = (data.targetIds || []).map(idOnly);
			return {
				usedTiesuo: targetsList.length > 0,
				targetCount: targetsList.length,
				targetsAllEnemies: targetsList.every(isEnemy),
				enemy1Linked: (data.links || {})[enemy1],
				enemy2Linked: (data.links || {})[enemy2],
				recast: !!data.recast,
				chainDamage: data.chain ? [Number(data.chain.after[enemy1]) - Number(data.chain.before[enemy1]), Number(data.chain.after[enemy2]) - Number(data.chain.before[enemy2])] : null,
			};
		}
		case 'shenhua-huo-lianhuan-unlinked-ally-only': {
			const data = scene.result || scene;
			return { usedTiesuo: (data.targetIds || []).length > 0, recast: !!data.recast, allyLinkedAfter: (data.links || {})[ally] };
		}
		case 'shenhua-huo-lianhuan-self-linked': {
			const data = scene.result || scene;
			const targetsList = (data.targetIds || []).map(idOnly);
			return { targetSelf: targetsList.includes(actor), targetCount: targetsList.length, recast: !!data.recast, actorLinkedAfter: data.actorLinked };
		}
		case 'shenhua-huo-lianhuan-recast-blocked': {
			const data = scene.result || scene;
			const targetsList = (data.targetIds || []).map(idOnly);
			return {
				targetCount: targetsList.length,
				targetsActorOrAlly: targetsList.every(id => id === actor || id === ally),
				recast: !!data.recast,
				draws: Number(data.draws) || 0,
				actorLinkedAfter: data.actorLinked,
				allyLinkedAfter: data.allyLinked,
			};
		}
		case 'shenhua-huo-passive-rules':
			return { baseDistance: scene.setup.baseDistance, mashuDistance: scene.setup.mashuDistance, maxHandcard: scene.setup.maxHandcard, bazhenExtra: !!(scene.setup.bazhenExtra), kanpoView: !!(scene.setup.kanpoView) };
		case 'quality-kuanggu-lowhp':
		case 'quality-kuanggu-midhp': {
			const data = scene.result || scene;
			const recovered = (data.ops || []).some(item => item && item.op === 'recover' && Number(item.args && item.args[0]) === 1);
			const drawn = (data.ops || []).some(item => item && item.op === 'draw' && Number(item.args && item.args[0]) > 0);
			return { hp: Number(data.hp), recovered, draw: drawn };
		}
		case 'quality-luanji-ally-lethal': {
			const data = scene.result || scene;
			return { check: Number(data.check), allyHp: Number(data.allyHp), used: (data.uses || []).length > 0 };
		}
		case 'quality-luanji-enemy-lethal': {
			const data = scene.result || scene;
			const used = (data.uses || []).length > 0 || (data.ops || []).some(item => item && item.op === 'useCard' && item.args && item.args[0] === 'wanjian');
			// 乱击后可能因随机摸牌继续追加万箭，只比较“是否发动、队友是否存活、敌方是否受伤”。
			const enemyDamaged = Object.keys(scene.before.hp || {}).filter(id => isEnemy(id)).some(id => Number(scene.after.hp[id] || 0) < Number(scene.before.hp[id]));
			return { used, allyAlive: Number(scene.after.hp[ally] || 0) > 0, enemyDamaged };
		}
		case 'hp-qiangxix-2hp-target1':
		case 'hp-qiangxix-2hp-weapon-target2': {
			const ops = scene.ops || [];
			return { used: ops.some(item => item && item.op === 'useSkill' && item.args && item.args[0] === 'qiangxix'), loseHp: ops.some(item => item && item.op === 'loseHp'), weaponDiscarded: ops.some(item => item && item.op === 'discard' && (item.args[0] || []).includes('zhangba')), targetHp: scene.target && scene.target.hp, actorHp: scene.turn && scene.turn.hp };
		}
		default:
			if (name.startsWith('hp-qimou') || name.startsWith('qimou-')) {
				const qimou = scene.qimou || {};
				const actorId = Object.keys(scene.before && scene.before.skills || {})[0];
				const targetHpBefore = Number(qimou.targetHpBefore);
				const targetHpAfter = Number(qimou.targetHpAfter);
				return {
					usedQimou: opUsesSkill('qimou'),
					paid: opLoseHp(),
					targetReachable: qimou.reachableAfter === true,
					targetHpDelta: Number.isFinite(targetHpBefore) && Number.isFinite(targetHpAfter) ? targetHpAfter - targetHpBefore : null,
					enemyHpLoss: Number(qimou.enemyHpLoss) || 0,
					shaUses: Number(qimou.shaUses) || 0,
					actorHpBefore: Number(qimou.actorHpBefore ?? (scene.before && scene.before.hp && scene.before.hp[actorId])),
					actorAlive: qimou.actorAlive !== false,
				};
			}
			return null;
	}
}

// 已登记的奇谋修复差异：只有这些场景允许原生否决、扩展支付。
// 支付档位、支付后可达、实际敌方体力损失、角色存活都是硬条件。
const REGISTERED_QIMOU_FIXES = {
	'hp-qimou-distance4-hp3': { paid: 3, minEnemyHpLoss: 1, targetMustBeHit: false },
	'hp-qimou-distance3-hp2': { paid: 2, minEnemyHpLoss: 1, targetMustBeHit: true },
};

export function validateQimouDifference(name, native, extension) {
	const registered = REGISTERED_QIMOU_FIXES[name];
	if (!registered) {
		const same = JSON.stringify(native) === JSON.stringify(extension);
		return same ? null : '未登记的奇谋场景出现原生/扩展差异';
	}
	if (native.usedQimou !== false || native.paid !== 0) return '原生基线不再是未发动/未支付';
	if (extension.usedQimou !== true) return '扩展未实际发动奇谋';
	if (extension.paid !== registered.paid) return '支付档位不符：期望 ' + registered.paid + '，实际 ' + extension.paid;
	if (!(extension.paid < extension.actorHpBefore)) return '支付会耗尽体力';
	if (!extension.actorAlive) return '支付后角色死亡';
	if (!extension.targetReachable) return '支付后目标仍不可达';
	if (!(extension.enemyHpLoss >= registered.minEnemyHpLoss)) return '未造成预期敌方体力损失';
	if (registered.targetMustBeHit && !(extension.targetHpDelta < 0)) return '指定目标未受到伤害';
	return null;
}

export function rawSceneTargets(scene) {
	const idOnly = value => String(value || '').split(':')[0];
	return (scene.selected || (scene.choice && scene.choice.targets) || (scene.targets || []).flat() || []).map(idOnly).sort();
}

export function rawSceneDraws(scene) {
	return (scene.ops || []).filter(item => item && (item.op === 'draw' || item.op === 'gain')).map(item => JSON.stringify(item.args));
}

export function compareNativeExtension(nativeReport, extensionReport, scenes) {
	const rows = [];
	const randomDifferences = [];
	const strategyDifferences = [];
	let semanticAll = true;
	let exactAll = true;
	for (const name of scenes) {
		const nativeScene = findScene(nativeReport, name);
		const extensionScene = findScene(extensionReport, name);
		const native = shenhuaSceneSemantic(name, nativeScene);
		const extension = shenhuaSceneSemantic(name, extensionScene);
		if (!native || !extension) throw new Error('未定义原生/扩展对照语义：' + name);
		const semanticMatch = JSON.stringify(native) === JSON.stringify(extension);
		const rawTargetsEqual = JSON.stringify(rawSceneTargets(nativeScene)) === JSON.stringify(rawSceneTargets(extensionScene));
		const rawDrawsEqual = JSON.stringify(rawSceneDraws(nativeScene)) === JSON.stringify(rawSceneDraws(extensionScene));
		const exactMatch = semanticMatch && rawTargetsEqual && rawDrawsEqual;
		const qimouScene = name.startsWith('hp-qimou') || name.startsWith('qimou-');
		let qimouError = null;
		let allowed = semanticMatch;
		let note = semanticMatch ? '语义一致' : null;
		if (qimouScene) {
			qimouError = validateQimouDifference(name, native, extension);
			if (qimouError) {
				allowed = false;
				note = qimouError;
			} else if (!semanticMatch) {
				allowed = true;
				note = '已登记的奇谋修复差异：扩展在支付档位正确、目标支付后可达且取得实际伤害时允许支付，原生保持否决。';
				strategyDifferences.push({ scene: name, type: 'qimou-policy-fix', native, extension, note });
			}
		} else if (!allowed) {
			const guhuoDecline = name === 'shenhua-guhuo-fake-questioned' && native.noDamage && extension.noDamage && native.noChanyuan && extension.noChanyuan && native.declaredSha && extension.declaredSha && native.outcome === 'cancelled' && extension.outcome === 'declined';
			if (guhuoDecline) {
				allowed = true;
				note = '策略差异：原生先发动假声明再被质疑取消，扩展 AI 选择放弃；两者均未造成伤害、质疑者均未获得缠怨。';
				strategyDifferences.push({ scene: name, type: 'guhuo-fake-questioned-decline', native, extension, note });
			}
			const kuangguLowHp = name === 'quality-kuanggu-lowhp' && native.hp === 1 && native.recovered === false && native.draw === true && extension.hp === 2 && extension.recovered === true && extension.draw === false;
			if (kuangguLowHp) {
				allowed = true;
				note = '策略差异：原生1血仍摸牌，扩展1血优先回复；扩展体力由1升至2且未摸牌。';
				strategyDifferences.push({ scene: name, type: 'kuanggu-lowhp-recover', native, extension, note });
			}
			const luanjiAllyVeto = name === 'quality-luanji-ally-lethal' && native.check > 0 && extension.check === 0 && native.allyHp === 1 && extension.allyHp === 1;
			if (luanjiAllyVeto) {
				allowed = true;
				note = '策略差异：原生乱击评分对1血空手无防具队友仍为正（实际万箭会使其进入濒死），扩展评分为0并拒绝发动；本场景只比较决策分，结算由全敌方场景覆盖。';
				strategyDifferences.push({ scene: name, type: 'luanji-ally-lethal-veto', native, extension, note });
			}
			const jushouTurned = name === 'quality-jushou-turned' && native.drew === 0 && native.turned === true && extension.drew === 3 && extension.turned === false;
			if (jushouTurned) {
				allowed = true;
				note = '策略差异：原生已翻面且体力4手牌3时不发动据守；扩展摸3张并翻回正面，无额外回合成本。';
				strategyDifferences.push({ scene: name, type: 'jushou-turned-free-draw', native, extension, note });
			}
			const shensuLowHand = name === 'quality-shensu1-lowhand-lebu' && native.usedSha === false && native.judgeSkipped === false && extension.usedSha === true && extension.judgeSkipped === true;
			if (shensuLowHand) {
				allowed = true;
				note = '策略差异：原生手牌2时放弃神速1并结算乐不思蜀；扩展跳过判定并使用虚拟杀。';
				strategyDifferences.push({ scene: name, type: 'shensu1-lowhand-judge-skip', native, extension, note });
			}
			const guhuoLowHp = name === 'quality-guhuo-bluff-lowhp' && native.positive === true && native.zero === false && extension.positive === false && extension.zero === true && native.hp === 1 && extension.hp === 1;
			if (guhuoLowHp) {
				allowed = true;
				note = '策略差异：原生1血无真牌仍给诈称正分；扩展将声明分置0，避免被质疑后失去最后1点体力。';
				strategyDifferences.push({ scene: name, type: 'guhuo-lowhp-bluff-guard', native, extension, note });
			}
			const huangtianLastShan = name === 'quality-huangtian-last-shan' && native.used === true && native.keptShan === false && extension.used === false && extension.keptShan === true;
			if (huangtianLastShan) {
				allowed = true;
				note = '策略差异：原生1血把最后一张闪转交主公；扩展保留该闪。';
				strategyDifferences.push({ scene: name, type: 'huangtian-last-shan-kept', native, extension, note });
			}
			const huangtianForcedShan = name === 'quality-huangtian-forced-shan-with-shandian' && native.used === true && native.keptShan === false && extension.used === false && extension.keptShan === true;
			if (huangtianForcedShan) {
				allowed = true;
				note = '策略差异：原生在1血持闪+闪电且本次选闪时仍把最后一张闪交给主公；扩展按实际选牌保留闪，仅允许转交闪电。';
				strategyDifferences.push({ scene: name, type: 'huangtian-forced-shan-kept', native, extension, note });
			}
		}
		if (!allowed) semanticAll = false;
		if (!exactMatch) exactAll = false;
		if (!rawTargetsEqual) randomDifferences.push({ scene: name, type: '对称目标座位不同', native: rawSceneTargets(nativeScene), extension: rawSceneTargets(extensionScene) });
		if (!rawDrawsEqual) randomDifferences.push({ scene: name, type: '摸牌/获得牌面随机不同', native: rawSceneDraws(nativeScene), extension: rawSceneDraws(extensionScene) });
		rows.push({ scene: name, exact_match: exactMatch, semantic_match: allowed, native, extension, note, qimou_error: qimouError || undefined });
	}
	return { rows, exact_all: exactAll, semantic_all: semanticAll, allowed_random_differences: randomDifferences, strategy_differences: strategyDifferences };
}
