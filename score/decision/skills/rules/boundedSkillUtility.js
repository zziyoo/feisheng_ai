/* 局部选择的启发式账本：各分项必须先换算到同一局部尺度。
 * 它不接收模型分、get.effect 或其他未经校准的分数。 */
export function localUtility(parts) {
	let total = 0;
	const contributions = [];
	for (const part of parts || []) {
		if (!part || typeof part.source !== 'string' || !Number.isFinite(part.value)) return null;
		if (contributions.some(item => item.source === part.source)) return null;
		contributions.push({ source: part.source, value: part.value });
		total += part.value;
	}
	return { total, contributions };
}

/* 仅比较明确提供的有限组合；空组合代表放弃，不改变宿主合法性。 */
export function bestLocalPlan(plans) {
	let best = { total: 0, cards: [], target: null, contributions: [] };
	for (const plan of plans || []) {
		if (plan && Number.isFinite(plan.total) && plan.total > best.total) best = plan;
	}
	return best;
}
