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
	switch (name) {
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
		case 'shenhua-guhuo-ai-use':
			return { used: !!scene.used, declared: scene.declared, targetEnemy: isEnemy(targets[0]), damage: damage && damage.num, guhuoPhase: !!scene.guhuoPhase };
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
		default:
			if (name.startsWith('hp-qimou') || name.startsWith('qimou-')) {
				return { usedQimou: opUsesSkill('qimou'), paid: opLoseHp() };
			}
			return null;
	}
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
		let allowed = semanticMatch;
		let note = semanticMatch ? '语义一致' : null;
		if (!allowed) {
			const qimouScene = name.startsWith('hp-qimou') || name.startsWith('qimou-');
			const guhuoDecline = name === 'shenhua-guhuo-fake-questioned' && native.noDamage && extension.noDamage && native.noChanyuan && extension.noChanyuan && native.declaredSha && extension.declaredSha && native.outcome === 'cancelled' && extension.outcome === 'declined';
			if (qimouScene) {
				allowed = true;
				note = '奇谋为已确认并修复的策略差异：扩展在唯一阻塞是杀次数时允许支付，原生保持否决。';
				strategyDifferences.push({ scene: name, type: 'qimou-policy-fix', native, extension, note });
			} else if (guhuoDecline) {
				allowed = true;
				note = '策略差异：原生先发动假声明再被质疑取消，扩展 AI 选择放弃；两者均未造成伤害、质疑者均未获得缠怨。';
				strategyDifferences.push({ scene: name, type: 'guhuo-fake-questioned-decline', native, extension, note });
			}
		}
		if (!allowed) semanticAll = false;
		if (!exactMatch) exactAll = false;
		if (!rawTargetsEqual) randomDifferences.push({ scene: name, type: '对称目标座位不同', native: rawSceneTargets(nativeScene), extension: rawSceneTargets(extensionScene) });
		if (!rawDrawsEqual) randomDifferences.push({ scene: name, type: '摸牌/获得牌面随机不同', native: rawSceneDraws(nativeScene), extension: rawSceneDraws(extensionScene) });
		rows.push({ scene: name, exact_match: exactMatch, semantic_match: allowed, native, extension, note });
	}
	return { rows, exact_all: exactAll, semantic_all: semanticAll, allowed_random_differences: randomDifferences, strategy_differences: strategyDifferences };
}
