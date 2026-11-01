export function fairButtonScore(playerId, index) {
	const source = String(playerId == null ? '' : playerId) + '|' + Math.max(0, Number(index) || 0);
	let hash = 2166136261;
	for (let i = 0; i < source.length; i++) {
		hash ^= source.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return ((hash >>> 0) % 1000) / 1000;
}

export function shouldMaskHiddenButtonChoice(isHuman, auto, skillIds) {
	if (isHuman && !auto) return false;
	return Array.isArray(skillIds) && skillIds.includes('redimeng');
}
