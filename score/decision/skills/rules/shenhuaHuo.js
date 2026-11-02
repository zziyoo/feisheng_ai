/* 神话再临·火 AI 规则：只处理已在真实宿主复现的决策缺陷。 */
export function lianhuanLinkedTargetSkip(target, player) {
	if (!target || target === player) return true;
	try {
		if (typeof target.isLinked === 'function' && target.isLinked()) return true;
	} catch (e) {}
	return false;
}
