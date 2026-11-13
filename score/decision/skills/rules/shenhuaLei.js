/* 旧版镇骨 cost 内嵌目标评分的指纹：min(5,自己手牌)-目标手牌。
 * 原生候选把同一回调改为即时差额后，不再套扩展评分。 */
export function zhenguCostNeedsFix(source) {
	const text = String(source || '');
	return /Math\.min\(\s*5\s*,\s*player2\.countCards\(["']h["']\)\s*\)\s*-\s*target\.countCards\(["']h["']\)/.test(text)
		&& !/ownHand\s*<\s*targetHand/.test(text);
}

/* 与宿主 sync 的即时变化一致：
 * 自己手牌少于目标时目标弃至自己手牌数；否则目标摸至 min(5,自己手牌)，已超出则不减少。 */
export function zhenguImmediateDelta(ownHand, targetHand) {
	const own = Number(ownHand), target = Number(targetHand);
	if (!Number.isFinite(own) || !Number.isFinite(target)) return 0;
	return own < target ? own - target : Math.min(5, own) - Math.min(5, target);
}

/* Match the stock 1.11.7 scorer so a different native or third-party scorer stays in place. */
export function xiongluanTargetNeedsFix(callback) {
	if (typeof callback !== 'function') return false;
	const source = Function.prototype.toString.call(callback).replace(/\s+/g, '').replace(/'/g, '"');
	return source === [
		'(player,target)=>{leths=player.countCards("h",(card)=>{',
		'if(!get.tag(card,"damage")||get.effect(target,card,player,player)<=0){return0;}',
		'if(get.name(card,player)==="sha"){if(target.getEquip("bagua")){return0.5;}',
		'if(target.getEquip("rewrite_bagua")){return0.25;}}return1;}),',
		'ts=target.hp+target.hujia+game.countPlayer((current)=>{',
		'if(get.attitude(current,target)>0){returncurrent.countCards("hs")/8;}return0;});',
		'if(hs>=ts){return-hs;}return0;}',
	].join('');
}

/* 旧版箜声成本 AI 的兼容性指纹。宿主改写这段表达式后不再套 shim。 */
export function olkongshengCostNeedsFix(source) {
	const text = String(source || '');
	return /getExpansions\s*\(\s*["']olkongsheng["']\s*\)\s*\+/.test(text) && text.includes('ui.selected.cards.length');
}

/* 只在一次 olkongsheng cost 调用中使用的数组视图：
 * 保留索引/长度/迭代/JSON 序列化，只让算术转换得到数量。 */
export function olkongshengExpansionView(cards) {
	if (!Array.isArray(cards)) return cards;
	const view = cards.slice();
	view.valueOf = function () { return view.length; };
	view.toString = function () { return String(view.length); };
	return view;
}
