import assert from 'node:assert/strict';
import { DEFENSE_RULES, retentionAdjustment, shouldSkipExchange, fairButtonScore, olkongshengCostNeedsFix, olkongshengExpansionView, shouldMaskHiddenButtonChoice, retuxiHandBonus, qimouTargetX, shouldBypassQimouCountBlock, reqimouNeedsPayment, reqimouOptimalX, reqimouKillableByHand, reqimouKillBenefit, interpretBaseUses, kuangguChoice, luanjiAllyLethal } from '../score/decision/skills/skillAIPolicyRules.js';

let passed = 0;
const check = (name, fn) => {
	fn();
	passed++;
	console.log('PASS', name);
};

const rule = DEFENSE_RULES.rezhiheng;

check('低血保留桃', () => {
	assert.equal(retentionAdjustment('tao', 3, 'h', 1, rule), -1);
	assert.equal(retentionAdjustment('tao', 1, 'h', 0.5, rule), -1);
});
check('低血保留闪', () => {
	assert.equal(retentionAdjustment('shan', 2, 'h', 1, rule), -1);
});
check('四血不改变原生评分', () => {
	assert.equal(retentionAdjustment('tao', 4, 'h', 1, rule), 1);
	assert.equal(retentionAdjustment('shan', 4, 'h', 1, rule), 1);
});
check('装备区不干预', () => {
	assert.equal(retentionAdjustment('tao', 1, 'e', 1, rule), 1);
});
check('已经为负的成本分保持更负', () => {
	assert.equal(retentionAdjustment('tao', 1, 'h', -3, rule), -3);
});
check('非法输入原样返回', () => {
	assert.equal(retentionAdjustment('tao', null, 'h', 1, rule), 1);
	assert.equal(retentionAdjustment('tao', 1, 'h', NaN, rule), NaN);
});
check('只剩防御牌时停止换牌', () => {
	assert.equal(shouldSkipExchange(1, ['tao', 'shan'], rule), true);
	assert.equal(shouldSkipExchange(3, ['shan'], rule), true);
});
check('仍有非防御牌时照常换牌', () => {
	assert.equal(shouldSkipExchange(1, ['tao', 'sha'], rule), false);
	assert.equal(shouldSkipExchange(2, ['tao', 'shan', 'sha'], rule), false);
});
check('高血或空手不触发停止', () => {
	assert.equal(shouldSkipExchange(4, ['tao'], rule), false);
	assert.equal(shouldSkipExchange(3, [], rule), false);
});
check('公平选择只依赖玩家与位置', () => {
	const a = fairButtonScore('p1', 0);
	const b = fairButtonScore('p1', 0);
	const c = fairButtonScore('p1', 1);
	const d = fairButtonScore('p2', 0);
	assert.equal(a, b);
	assert.notEqual(a, c);
	assert.notEqual(a, d);
	assert(a >= 0 && a < 1);
});

check('箜声成本指纹只在原表达式存在时命中', () => {
	assert.equal(olkongshengCostNeedsFix('const n = player.getExpansions("olkongsheng") + ui.selected.cards.length;'), true);
	assert.equal(olkongshengCostNeedsFix('const n = player.getExpansions("olkongsheng").length + ui.selected.cards.length;'), false);
	assert.equal(olkongshengCostNeedsFix('const n = other();'), false);
});
check('箜声数组视图保留数组语义', () => {
	const original = [{ name: 'tao' }, { name: 'sha' }];
	const view = olkongshengExpansionView(original);
	assert.equal(Array.isArray(view), true);
	assert.equal(view.length, 2);
	assert.equal(view[0], original[0]);
	assert.equal([...view].length, 2);
	assert.deepEqual(view.map(c => c.name), ['tao', 'sha']);
	assert.equal(JSON.stringify(view), '[{"name":"tao"},{"name":"sha"}]');
	assert.equal(view + 1, 3);
	assert.equal(String(view), '2');
	assert.equal(view.valueOf(), 2);
	assert.equal(original.length, 2);
	assert.equal(original.valueOf(), original);
});
check('缔盟遮蔽只对 AI 且只在 redimeng 上下文', () => {
	assert.equal(shouldMaskHiddenButtonChoice(false, false, ['redimeng']), true);
	assert.equal(shouldMaskHiddenButtonChoice(true, false, ['redimeng']), false);
	assert.equal(shouldMaskHiddenButtonChoice(true, true, ['redimeng']), true);
	assert.equal(shouldMaskHiddenButtonChoice(false, false, ['dimeng']), false);
	assert.equal(shouldMaskHiddenButtonChoice(false, false, null), false);
});
check('突袭手牌奖励有界且避开特殊失牌收益', () => {
	assert.equal(retuxiHandBonus(4, true, false), 1);
	assert.equal(retuxiHandBonus(100, true, false), 2);
	assert.equal(retuxiHandBonus(4, false, false), 0);
	assert.equal(retuxiHandBonus(4, true, true), 0);
	assert.equal(retuxiHandBonus(0, true, false), 0);
});

check('奇谋支付档位复刻宿主 content', () => {
	assert.equal(qimouTargetX(4, 3), 3);
	assert.equal(qimouTargetX(4, 2), 2);
	assert.equal(qimouTargetX(3, 2), 2);
	assert.equal(qimouTargetX(3, 1), 1);
	assert.equal(qimouTargetX(2, 3), 1);
	assert.equal(qimouTargetX(1, 3), 1);
});

const qimouTarget = over => ({
	currentlyInRange: false,
	canUseIgnoringDistance: true,
	effect: 1,
	attackDistance: 4,
	hp: over,
});

check('奇谋：远处可击杀目标放宽 cardUsable 阻塞（复现正向）', () => {
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 4, shaCount: 3, cardEnabled: true, cardUsable: true,
		targets: [qimouTarget(3)],
	}), true);
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 3, shaCount: 2, cardEnabled: true, cardUsable: true,
		targets: [{ ...qimouTarget(2), attackDistance: 3 }],
	}), true);
});
check('奇谋：目标过厚不放宽（复现反向）', () => {
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 4, shaCount: 3, cardEnabled: true, cardUsable: true,
		targets: [qimouTarget(4)],
	}), false);
});
check('奇谋：目标已在射程内不放宽（杀可直接使用）', () => {
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 4, shaCount: 3, cardEnabled: true, cardUsable: true,
		targets: [{ ...qimouTarget(3), currentlyInRange: true }],
	}), false);
});
check('奇谋：杀次数耗尽走原生路径，不重复放宽', () => {
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 4, shaCount: 3, cardEnabled: true, cardUsable: false,
		targets: [qimouTarget(3)],
	}), false);
});
check('奇谋：1血不放宽；2血付1换击杀允许', () => {
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 1, shaCount: 3, cardEnabled: true, cardUsable: true,
		targets: [qimouTarget(1)],
	}), false);
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 2, shaCount: 3, cardEnabled: true, cardUsable: true,
		targets: [{ ...qimouTarget(1), attackDistance: 2 }],
	}), true, 'hp2 支付1后剩1血，与 4→1 的档位风险一致');
});
check('奇谋：目标距离超出档位射程不放宽', () => {
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 4, shaCount: 3, cardEnabled: true, cardUsable: true,
		targets: [{ ...qimouTarget(3), attackDistance: 6 }],
	}), false);
});
check('奇谋：原生已放行或无杀时不干预', () => {
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 1, hp: 4, shaCount: 3, cardEnabled: true, cardUsable: true,
		targets: [qimouTarget(3)],
	}), false);
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 4, shaCount: 0, cardEnabled: true, cardUsable: true,
		targets: [qimouTarget(3)],
	}), false);
});

check('奇谋OL：贴脸且一发杀可收割时 gate 拦截（复现正向）', () => {
	assert.equal(reqimouNeedsPayment([{
		effect: 1, canUseIgnoringDistance: true, currentlyInRange: true, hp: 1, baseUses: 1,
	}]), false);
});
check('奇谋OL：需要额外出杀或减距离时 gate 放行', () => {
	assert.equal(reqimouNeedsPayment([{
		effect: 1, canUseIgnoringDistance: true, currentlyInRange: true, hp: 2, baseUses: 1,
	}]), true);
	assert.equal(reqimouNeedsPayment([{
		effect: 1, canUseIgnoringDistance: true, currentlyInRange: false, hp: 1, baseUses: 1,
	}]), true);
	assert.equal(reqimouNeedsPayment([]), false);
});
check('奇谋OL：支付档位按距离与击杀收紧', () => {
	const mk = (distance, hp, range = 1) => ({ effect: 1, canUseIgnoringDistance: true, distance, attackRange: range, hp });
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 2, baseUses: 1, targets: [mk(1, 2)] }), 1);
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 2, baseUses: 1, targets: [mk(2, 2)] }), 1);
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: 1, targets: [mk(4, 3)] }), 3);
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 2, baseUses: 1, targets: [mk(4, 3)] }), null, '手杀不足时回退原生档位');
});
check('奇谋OL：长武器按真实攻击范围缩短支付', () => {
	const mk = (distance, hp, range) => ({ effect: 1, canUseIgnoringDistance: true, distance, attackRange: range, hp });
	/* 审查复现：距离4、攻击范围3、目标2血、基础1杀 → 支付1即可 */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 2, baseUses: 1, targets: [mk(4, 2, 3)] }), 1);
	/* 目标+1马距离5、攻击范围3 → 支付2 */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 2, baseUses: 1, targets: [mk(5, 2, 3)] }), 2);
	/* 无武器距离4、攻击范围1、目标2血、体力4 → 支付3（可达且可承受） */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 2, baseUses: 1, targets: [mk(4, 2, 1)] }), 3);
});
check('奇谋OL：不可承受的候选绝不截断（P1 回归）', () => {
	const mk = (distance, hp) => ({ effect: 1, canUseIgnoringDistance: true, distance, attackRange: 1, hp });
	/* 审查复现：体力3、3杀、距离4、攻击范围1、目标2血 → 需付3，但只允许hp-1=2 */
	assert.equal(reqimouOptimalX({ hp: 3, shaCount: 3, baseUses: 1, targets: [mk(4, 2)] }), null);
	/* 体力3、距离5、范围1 → 需付4，更不可承受 */
	assert.equal(reqimouOptimalX({ hp: 3, shaCount: 3, baseUses: 1, targets: [mk(5, 2)] }), null);
	/* 存在一个可承受目标时，仍选择可承受的最小档位 */
	assert.equal(reqimouOptimalX({
		hp: 3, shaCount: 3, baseUses: 1,
		targets: [mk(4, 2), { effect: 1, canUseIgnoringDistance: true, distance: 2, attackRange: 1, hp: 2 }],
	}), 1);
});
check('奇谋OL：手杀可击杀判定用于 gate 分级', () => {
	const target = (hp, extra = {}) => ({ effect: 1, canUseIgnoringDistance: true, distance: 4, attackRange: 1, hp, ...extra });
	assert.equal(reqimouKillableByHand(3, [target(2)]), true);
	assert.equal(reqimouKillableByHand(2, [target(3)]), false);
	assert.equal(reqimouKillableByHand(0, [target(2)]), false);
	assert.equal(reqimouKillableByHand(3, [target(2, { canUseIgnoringDistance: false })]), false);
	assert.equal(reqimouKillableByHand(3, [target(2, { effect: 0 })]), false);
});
check('奇谋OL：手杀不足以击杀时保留原生行为', () => {
	assert.equal(reqimouOptimalX({
		hp: 4, shaCount: 2, baseUses: 1,
		targets: [{ effect: 1, canUseIgnoringDistance: true, distance: 4, attackRange: 1, hp: 4 }],
	}), null);
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 2, baseUses: 1, targets: [] }), null);
});
check('奇谋OL：支付不超过 hp-1 且低体力一律回退原生', () => {
	/* 体力3、距离5、范围1 → 达距需4 > hp-1=2：不可承受，返回 null 而不是截断为 2 */
	assert.equal(reqimouOptimalX({
		hp: 3, shaCount: 5, baseUses: 1,
		targets: [{ effect: 1, canUseIgnoringDistance: true, distance: 5, attackRange: 1, hp: 3 }],
	}), null);
	assert.equal(reqimouOptimalX({
		hp: 1, shaCount: 5, baseUses: 1,
		targets: [{ effect: 1, canUseIgnoringDistance: true, distance: 1, attackRange: 1, hp: 1 }],
	}), null, '1血支付会致死，回退原生');
	assert.equal(reqimouOptimalX({ hp: 0, shaCount: 5, baseUses: 1, targets: [] }), null);
});

/* ===== 2026-11-01 审查补修：自救上限 / 收益档位 / 无限杀次数 ===== */
const mk = (distance, hp, range = 1) => ({ effect: 1, canUseIgnoringDistance: true, distance, attackRange: range, hp });

check('补修P1：有自救牌时允许支付全部体力兑现击杀（审查复现正向）', () => {
	/* 审查场景 reqimou-blocked-far5-hp4-3sha-tao-hp2-horse：
	 * 体力4、3杀、1桃、目标距离5(+1马)、攻击范围1、2血。
	 * 原生：付4 → 濒死 → 桃自救回1 → 距离5-4=1 → 3杀击杀2血。 */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: 1, saveCount: 1, targets: [mk(5, 2)] }), 4);
	/* 体力3、距离4、3杀、1桃 → 付3（2026-10-31 证据中 gate 曾误拦，AI 仅靠先吃桃绕过） */
	assert.equal(reqimouOptimalX({ hp: 3, shaCount: 3, baseUses: 1, saveCount: 1, targets: [mk(4, 2)] }), 3);
});
check('补修P1：没有自救牌时绝不支付全部体力（审查复现反向）', () => {
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: 1, saveCount: 0, targets: [mk(5, 2)] }), null, '无桃付4=必死，保持阻止');
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: 1, targets: [mk(5, 2)] }), null, '未传自救牌按0处理');
});
check('补修P1：自救牌只在更小档位兑现不了时才用满（不因有桃就付满）', () => {
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: 1, saveCount: 1, targets: [mk(2, 2)] }), 1, '付1即可兑现，不付满');
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: 1, saveCount: 2, targets: [mk(2, 2)] }), 1, '多张自救牌也不加价');
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: 1, saveCount: 2, targets: [mk(5, 2)] }), 4, '需要时付满，但不超过全部体力');
});
check('补修P1：自救收益档位吃掉击杀预算（付满换击杀而非平白掉血）', () => {
	/* 体力4、1桃、3杀、目标距离1、3血：距离在范围内，档位由次数决定
	 * （基础1次+付x ≥ 3次 → x=2），付满4不会带来更多击杀（目标只有1个）→ 最小档2。 */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: 1, saveCount: 1, targets: [mk(1, 3)] }), 2);
});
check('补修P1-2：档位与全回合收益绑定，收益不变时不加价', () => {
	/* A距离1血1（免费可杀）、B距离4血3、3杀：任意档位最多兑现1杀且A本就免费 → 净收益为0，不发动。 */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: 1, targets: [mk(1, 1), mk(4, 3)] }), null, 'A免费可杀，支付无净收益');
	/* 4杀时付3能兑现 A+B 两杀（1+3=4≤预算min(4,4)），净收益 2>1 → 档位3。 */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 4, baseUses: 1, targets: [mk(1, 1), mk(4, 3)] }), 3);
	/* 三目标：A(d1,1血免费) B(d3,2血) C(d3,2血)、4杀 → 付2兑现 A+B 两杀，净收益 2>1。 */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 4, baseUses: 1, targets: [mk(1, 1), mk(3, 2), mk(3, 2)] }), 2);
	/* A不免费（2血>1次）时：付1兑现A、B不可及 → 净收益1>0 → 最小档1。 */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: 1, targets: [mk(1, 2), mk(4, 3)] }), 1);
});
check('补修P1-2：预算不足时不宣称爆发收益（min(手杀,次数) 封顶）', () => {
	/* A(d1,1血) B(d4,3血)、3杀：付3后预算3 < 1+3=4 → 仍只1杀，与不发动等价 → 不发动。 */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: 1, targets: [mk(1, 1), mk(4, 3)] }), null);
	/* 次数约束：2杀、基础1次、目标A(d1,1血免费) B(d2,2血)：任意档位最多1杀 → 净收益0 → 不发动。 */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 2, baseUses: 1, targets: [mk(1, 1), mk(2, 2)] }), null);
	/* A不免费时（2血>1次）：不发动则0杀，付1后A/B均可及且预算2兑现1杀 → 净收益1 → 最小档1；
	 * 4杀时付3兑现A+B两杀（2+2=4≤预算4）。 */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 2, baseUses: 1, targets: [mk(1, 2), mk(2, 2)] }), 1);
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 4, baseUses: 1, targets: [mk(1, 2), mk(2, 2)] }), 3, '4杀时付3兑现A+B两杀');
});
check('补修P1-2：机会成本——免费可得的击杀不支付（含连弩无限次数）', () => {
	/* 连弩：贴脸1血目标免费可杀，远处目标付了也到不了 → 净收益0 → 不发动。 */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: Infinity, targets: [mk(1, 1), mk(4, 3)] }), null);
	/* 连弩：贴脸2血目标免费可杀（无限次数），远处不可及 → 不发动。 */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: Infinity, targets: [mk(1, 2), mk(4, 3)] }), null);
	/* 连弩：远处可杀目标是唯一收益来源 → 按达距所需支付。 */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: Infinity, targets: [mk(1, 5), mk(4, 2)] }), 3, '贴脸5血不可杀，付3兑现远处2血');
});
check('补修P1-2：击杀收益按预算贪心统计（升序消耗手杀）', () => {
	assert.equal(reqimouKillBenefit(4, 1, 2, [mk(1, 1), mk(3, 2), mk(3, 2)]), 2);
	assert.equal(reqimouKillBenefit(3, 1, 2, [mk(1, 1), mk(3, 2), mk(3, 2)]), 2, '1+2=3≤预算3');
	assert.equal(reqimouKillBenefit(2, 1, 2, [mk(1, 1), mk(3, 2), mk(3, 2)]), 1, '预算2只能杀1血目标');
	assert.equal(reqimouKillBenefit(4, 1, 2, [mk(5, 2)]), 0, '不可达不计入');
	assert.equal(reqimouKillBenefit(4, Infinity, 1, [mk(2, 2)]), 1, '无限次数预算=手杀数（距离2可达）');
	assert.equal(reqimouKillBenefit(4, Infinity, 1, [mk(5, 2)]), 0, '不可达不计入，与有限次数一致');
});
check('补修P2：出杀次数四态解释（Infinity/0/有限/异常）', () => {
	assert.equal(interpretBaseUses(Infinity), Infinity);
	assert.equal(interpretBaseUses(0), 0, '本回合已用完是真实值');
	assert.equal(interpretBaseUses(-1), 0, '负数按0处理');
	assert.equal(interpretBaseUses(2.9), 2);
	assert.equal(interpretBaseUses(NaN), 1, '异常回退原生静态口径');
	assert.equal(interpretBaseUses('abc'), 1);
	assert.equal(interpretBaseUses(undefined), 1);
});
check('补修P2：无限次数不构成支付理由，也不再按1次误判', () => {
	/* 连弩+范围内2血目标：次数已无限 → needsPayment=false → gate 跳过，不为加次数支付。 */
	assert.equal(reqimouNeedsPayment([{ effect: 1, canUseIgnoringDistance: true, currentlyInRange: true, hp: 2, baseUses: Infinity }]), false);
	/* 连弩+范围内3血目标且手杀3：次数足够 → 不需要为次数支付。 */
	assert.equal(reqimouNeedsPayment([{ effect: 1, canUseIgnoringDistance: true, currentlyInRange: true, hp: 3, baseUses: Infinity }]), false);
	/* 连弩但目标在射程外：支付只按距离需要 → 档位=达距所需，不叠加击杀次数需求。 */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: Infinity, targets: [mk(2, 3)] }), 1);
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: Infinity, saveCount: 1, targets: [mk(5, 2)] }), 4, '距离5需付4，有自救牌才可承受');
});
check('补修P2：0次与异常回退的行为', () => {
	/* 次数用完（0）：范围内1血目标，付1恢复1次出杀并击杀。 */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 2, baseUses: 0, targets: [mk(1, 1)] }), 1);
	assert.equal(reqimouNeedsPayment([{ effect: 1, canUseIgnoringDistance: true, currentlyInRange: true, hp: 1, baseUses: 0 }]), true, '0次时次数是支付理由');
	/* 异常值：按1次保守回退，档位判断与原生口径一致。 */
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 2, baseUses: 'bogus', targets: [mk(1, 2)] }), 1);
});
check('补修P2：无限次数不影响击杀档位上限与低血回退', () => {
	assert.equal(reqimouOptimalX({ hp: 3, shaCount: 5, baseUses: Infinity, targets: [mk(3, 3)] }), 2, 'hp-1=2 可承受且可达（距离3）');
	assert.equal(reqimouOptimalX({ hp: 1, shaCount: 5, baseUses: Infinity, targets: [mk(1, 1)] }), null, '低血仍回退');
});

check('狂骨：1血可回复时优先回复，其余沿用原生', () => {
	assert.equal(kuangguChoice({ hp: 1, isDamaged: true, recoverEffect: 1, nativeRecover: false }), 'recover_hp');
	assert.equal(kuangguChoice({ hp: 3, isDamaged: true, recoverEffect: 1, nativeRecover: false }), 'draw_card');
	assert.equal(kuangguChoice({ hp: 1, isDamaged: true, recoverEffect: 0, nativeRecover: false }), 'draw_card');
	assert.equal(kuangguChoice({ hp: 1, isDamaged: false, recoverEffect: 1, nativeRecover: false }), 'draw_card');
	assert.equal(kuangguChoice({ hp: 3, isDamaged: true, recoverEffect: 1, nativeRecover: true }), 'recover_hp');
});
check('乱击：仅1血空手无防具的队友触发否决', () => {
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 0, armor: false }), true);
	assert.equal(luanjiAllyLethal({ ally: false, hp: 1, hand: 0, armor: false }), false);
	assert.equal(luanjiAllyLethal({ ally: true, hp: 2, hand: 0, armor: false }), false);
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 1, armor: false }), false);
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 0, armor: true }), false);
});
console.log('ALL PASS (' + passed + ')');
