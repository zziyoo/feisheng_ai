/* 神话再临·风 纯决策函数层：所有函数只做纯计算，不触宿主对象。
 * 与原生补丁 docs/skill-ai-quality-20261103/wind-native/ 中的同名决策保持一致。
 * 本轮（2026-11 风包质量深化轮）新增/修订的函数均标注与原生入口的对应关系。 */

/* 界魏延【奇谋 qimou】：复刻宿主 content 的支付档位，只用于 AI 复算，不改技能规则。 */
export function qimouTargetX(hp, shaCount) {
	const life = Number(hp);
	const sha = Math.floor(Number(shaCount));
	if (!Number.isFinite(life) || !Number.isFinite(sha)) return 0;
	if (life >= 4 && sha >= 3) return 3;
	if (life >= 3 && sha >= 2) return 2;
	return 1;
}

/*
 * qimou 原生 gate 的缺陷（2026-10-31 真实宿主复现）：
 * `if (lib.filter.cardUsable(card, player)) return 0` 在“杀次数未用完”时直接否决奇谋，
 * 即使目标在攻击范围外——而减距离恰恰是奇谋存在的目的。
 * 只在“杀次数可用”恰好是唯一阻塞条件、且支付能把可击杀的远处目标纳入射程时放宽。
 */
export function shouldBypassQimouCountBlock(input) {
	const { nativeResult, hp, shaCount, cardEnabled, cardUsable, targets } = input || {};
	if (Number(nativeResult) > 0) return false;
	if (!cardEnabled || !cardUsable) return false;
	const sha = Math.max(0, Math.floor(Number(shaCount) || 0));
	const life = Number(hp);
	if (!Number.isFinite(life) || life <= 1 || sha <= 0) return false;
	const x = qimouTargetX(life, sha);
	if (life <= x) return false;
	const killPotential = Math.min(sha, x + 1);
	for (const target of Array.isArray(targets) ? targets : []) {
		if (!target || typeof target !== 'object') continue;
		if (target.currentlyInRange) continue;
		if (!target.canUseIgnoringDistance) continue;
		if (!(Number(target.effect) > 0)) continue;
		const attackDistance = Number(target.attackDistance);
		if (!Number.isFinite(attackDistance) || attackDistance > x + 1) continue;
		const targetHp = Number(target.hp);
		if (!Number.isFinite(targetHp)) continue;
		if (targetHp > x) continue;
		if (targetHp > killPotential) continue;
		return true;
	}
	return false;
}

/* qimou 支付最小化（本轮新增，对应原生 content 内的循环）：
 * 第x档攻击距离上限 x+1、杀次数上限 原有+x。在已有目标记录中寻找
 * 能形成有效打击的最低支付档；找不到则维持原档位。 */
export function qimouMinimalPayment(input) {
	const { tier, baseUsable, shaCount, hp, targets } = input || {};
	const sha = Math.max(0, Math.floor(Number(shaCount) || 0));
	const base = Math.max(0, Math.floor(Number(baseUsable) || 0));
	const life = Number(hp);
	let num = Number(tier);
	if (!Number.isFinite(num) || num < 1) num = 1;
	if (!Number.isFinite(life) || life <= 1) return Math.min(num, Math.max(1, life || 1));
	const list = Array.isArray(targets) ? targets : [];
	for (let x = 1; x < num; x++) {
		const usable = base + x;
		for (const target of list) {
			if (!target || typeof target !== 'object') continue;
			if (target.currentlyInRange) continue;
			if (!target.canUseIgnoringDistance) continue;
			if (!(Number(target.effect) > 0)) continue;
			const attackDistance = Number(target.attackDistance);
			if (!Number.isFinite(attackDistance) || attackDistance > x + 1) continue;
			const targetHp = Number(target.hp);
			if (!Number.isFinite(targetHp)) continue;
			if (targetHp > Math.min(sha, usable)) continue;
			return x;
		}
	}
	return num;
}

/* 界魏延【狂骨】：本轮扩展为三分支（对应原生 cost 的嵌套条件）。
 * hp<=1 回复（与宿主 chooseDrawRecover 对 hp==1 的处理一致）；
 * 杀充足时回复（原生语义保留）；2血且无桃储备时回复；其余摸牌。 */
export function kuangguChoice(input) {
	const { hp, isDamaged, recoverEffect, shaReady, shaUsable, taoCount } = input || {};
	if (!isDamaged || !(Number(recoverEffect) > 0)) return 'draw_card';
	const life = Number(hp);
	if (Number.isFinite(life) && life <= 1) return 'recover_hp';
	const ready = Number(shaReady);
	const usable = Number(shaUsable);
	if (Number.isFinite(usable) && usable > 0 && Number.isFinite(ready) && ready >= usable) return 'recover_hp';
	const tao = Number(taoCount);
	if (Number.isFinite(life) && life <= 2 && (Number.isFinite(tao) ? tao === 0 : false)) return 'recover_hp';
	return 'draw_card';
}

/* 曹仁【据守】：已翻面发动；其余情况沿用原生手牌阈值。 */
export function jushouShouldActivate(input) {
	const { hp, hand, turned } = input || {};
	if (turned) return true;
	const life = Number(hp);
	const cards = Number(hand);
	if (!Number.isFinite(life) || !Number.isFinite(cards)) return false;
	if (life + cards >= 4) return false;
	return true;
}

/* 神速1：手牌<=2时原生放弃；若判定区有乐/兵粮/闪电，跳过判定本身有收益。
 * 但跳过摸牌有代价：只有虚拟杀收益不低于一次摸牌价值时才放宽。 */
export function shensu1ShouldUse(input) {
	const { check, harmfulJudge, effect, drawEffect } = input || {};
	if (!(Number(effect) > 0)) return false;
	if (check) return true;
	if (!harmfulJudge) return false;
	return Number(effect) >= Number(drawEffect);
}

/* 神速4（本轮新增，对应原生 cost 的 check 重构）：
 * 已翻面或舍班可移牌时放行（原生保留）；需要弃牌时只在
 * 低体力保命、被乐压制下回合、或存在可收割的濒死敌人时放行。 */
export function shensu4ShouldUse(input) {
	const { turned, shebianCanMove, needDiscard, hp, hasLebu, killTarget } = input || {};
	if (turned) return true;
	if (shebianCanMove) return true;
	if (!(Number(needDiscard) > 0)) return false;
	const life = Number(hp);
	if (Number.isFinite(life) && life <= 2) return true;
	if (hasLebu) return true;
	return !!killTarget;
}

/* 蛊惑扣置材料（本轮新增，对应原生 backup.ai1 的确定性门槛）：
 * 真牌恒优先；诈称材料只在低价值（与原生声明门槛 raw<6 一致）且非濒死时支付。 */
export function guhuoMaterialScore(input) {
	const { isTrueCard, materialValue, isDying } = input || {};
	const value = Number(materialValue);
	if (isTrueCard) return 5;
	if (isDying) return 0;
	if (!Number.isFinite(value) || value < 6) return 4 - (Number.isFinite(value) ? value / 2 : 0);
	return 0;
}

/* 天香两方案联合评分的纯比较部分（对应原生 txOptions 的比较）：
 * 返回 0 选“伤害+摸牌”，1 选“失去体力+赠牌”，-1 表示由调用方回退原生。 */
export function retianxiangOptionIndex(eff1, eff2) {
	const a = Number(eff1);
	const b = Number(eff2);
	if (!Number.isFinite(a) || !Number.isFinite(b)) return -1;
	return a >= b ? 0 : 1;
}

/* 黄天（本轮修订，对应原生 result.target 的完整逻辑）：
 * 返回 null 表示交还原生评分；否则给出替代分。
 * 低体力（<=2）交牌者选中最后一张闪时保守保留。 */
export function huangtianTargetScore(input) {
	const { hp, handShan, selectedShan, selectedShandian, hasSelection } = input || {};
	const life = Number(hp);
	const shan = Number(handShan);
	if (!Number.isFinite(life) || !Number.isFinite(shan)) return null;
	if (life > 2 || shan > 1) return null;
	if (!hasSelection) return null;
	if (selectedShan) {
		return 0;
	}
	if (selectedShandian) return null;
	return 0;
}

/* 周泰【不屈】伤害估值模型（本轮新增，对应原生 ai.effect.target）：
 * dupChance = Σ_创 max(0, 8 - 公开区该点数张数) / 108，再加 0.1 压制价值。
 * outCount 为公开区（弃牌堆+装备/判定区+创自身）各点数张数统计；
 * 无创时：血量>1 正常估值 1，血量<=1 时第一张创必不重复，只保留 0.2 压制价值。 */
export function buquDamageFactor(input) {
	const { creations, outCount, hp } = input || {};
	const list = Array.isArray(creations) ? creations : [];
	if (!list.length) {
		const life = Number(hp);
		return Number.isFinite(life) && life > 1 ? 1 : 0.2;
	}
	const counts = outCount && typeof outCount === 'object' ? outCount : {};
	let dupChance = 0;
	for (const num of list) {
		const n = Number(num);
		if (!Number.isFinite(n)) continue;
		const out = Number(counts[n]);
		dupChance += Math.max(0, 8 - (Number.isFinite(out) ? out : 0)) / 108;
	}
	return Math.min(1, dupChance + 0.1);
}
