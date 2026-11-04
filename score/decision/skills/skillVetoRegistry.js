/*
 * 分包动态技能否决注册表。
 *
 * 背景：完整引擎的主动技能发起决策（skillPlayBrain.decideSkill）走静态 profile，
 * 不经过宿主 lib.skill[x].ai.result.* 的运行时评分。分包若只 wrap 结果函数，
 * 引擎层会绕过。本模块给 skillPlayBrain.vetoSkill 提供一个局部接线点：
 * 分包在 install 时按技能 ID 注册运行时否决函数，引擎决策时查询。
 *
 * 约定：
 * - 注册函数签名 (profile, ctx) => { veto: true, reason } 或 null/undefined（不表态）；
 * - 任何抛错都 fail-open（不否决），避免分包缺陷阻塞引擎；
 * - ctx 由引擎传入，ctx.me.ref 是真实玩家引用（可读手牌/局面）；
 * - 只做"是否发动"的运行时裁决，不改技能规则、目标合法性或结算；
 * - 注册时带 tag，分包卸载时按 tag 清理，防止跨分包残留。
 */

const REGISTRY = new Map(); /* sid -> Array<{ tag, fn }> */

export function registerSkillVeto(sid, fn, tag) {
	if (typeof sid !== 'string' || !sid || typeof fn !== 'function') return () => {};
	const list = REGISTRY.get(sid) || [];
	const entry = { tag: tag || '', fn };
	list.push(entry);
	REGISTRY.set(sid, list);
	return function unregister() {
		const current = REGISTRY.get(sid) || [];
		const index = current.indexOf(entry);
		if (index >= 0) current.splice(index, 1);
		if (!current.length) REGISTRY.delete(sid);
	};
}

export function unregisterSkillVetoesByTag(tag) {
	if (!tag) return;
	for (const [sid, list] of Array.from(REGISTRY.entries())) {
		const remaining = list.filter(entry => entry.tag !== tag);
		if (remaining.length) REGISTRY.set(sid, remaining);
		else REGISTRY.delete(sid);
	}
}

/* 引擎查询：返回 { veto, reason, source } 或 null（无人表态）。 */
export function dynamicSkillVeto(sid, profile, ctx) {
	const list = REGISTRY.get(sid);
	if (!list || !list.length) return null;
	for (const entry of list) {
		try {
			const result = entry.fn(profile, ctx);
			if (result && result.veto) {
				return { veto: true, reason: String(result.reason || '分包动态否决'), source: entry.tag || sid };
			}
		} catch (e) { /* fail-open */ }
	}
	return null;
}

/* 测试/卸载辅助：当前注册表快照。 */
export function skillVetoSnapshot() {
	const out = {};
	for (const [sid, list] of REGISTRY.entries()) out[sid] = list.map(entry => entry.tag);
	return out;
}
