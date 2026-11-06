/* 分包自愿注册的有界软建议；注册表不改变技能合法性。 */
import { applyOwnedUtility } from '../utility/utilityPipeline.js?v=41a';
const hints = new Map();

export function registerSkillPlanHint(id, fn) {
	const entry = { fn };
	const list = hints.get(id) || [];
	list.push(entry);
	hints.set(id, list);
	return () => {
		const active = hints.get(id);
		if (!active) return;
		const index = active.indexOf(entry);
		if (index >= 0) active.splice(index, 1);
		if (!active.length) hints.delete(id);
	};
}

export function applySkillPlanHints(player, candidates) {
	if (!hints.size) return;
	for (const candidate of candidates) {
		if (candidate.type !== 'skill') continue;
		const list = hints.get(candidate.id);
		if (!list || list.length !== 1) continue;
		try {
			const hint = list[0].fn(player);
			if (!hint || !Number.isFinite(hint.delta)) continue;
			applyOwnedUtility(candidate, 'refresh-standard-plan', [{ dimension: 'resource',
				delta: Math.max(-0.25, Math.min(0.75, hint.delta)),
				details: { status: hint.status, total: hint.total, cost: hint.cost, reserve: hint.reserve } }]);
		} catch (_) { /* 评分建议失败时沿用已有候选 */ }
	}
}
