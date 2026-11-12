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

/* 1.11.7 宿主 find(2) 在循环外 return list[i]：i 是块级循环变量，
 * 评估第二目标时抛 ReferenceError。只匹配这一已知形态，宿主修复后自动跳过。 */
export function redimengFindNeedsFix(source) {
	const text = String(source == null ? '' : source);
	return /return\s+list\[i\]\s*;/.test(text) && /for\s*\(\s*let\s+i2?\s*=/.test(text);
}
