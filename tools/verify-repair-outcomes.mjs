#!/usr/bin/env node
// 2026-11-01 审查补修验收：读取 skill-ai-hp-real-host.mjs 产出的 evidence JSON，
// 对 P1（自救支付）/ P1-2（收益档位绑定）/ P2（无限杀次数）逐场景断言。
// 期望值按变体区分：native = 原生行为对照；policy/extension = 策略层修复后行为。
// 支付后可攻击目标集合按 distance − paid ≤ attackRange 推导（与 reqimou2 的 globalFrom mod 一致）。
import assert from 'node:assert/strict';
import fs from 'node:fs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
const evidencePath = option('evidence');
const variant = option('variant');
assert(evidencePath && variant, 'usage: node verify-repair-outcomes.mjs --evidence <json> --variant <native|policy|extension>');
const POLICY = variant !== 'native';

const report = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const byScenario = Object.fromEntries(report.results.map(result => [result.scenario, result]));

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };

const result = name => {
	const r = byScenario[name];
	assert(r, 'missing scenario result: ' + name);
	assert(!r.error, 'scenario error [' + name + ']: ' + (r.error || ''));
	return r;
};
const deadIds = r => new Set(r.after.dead);
const enemySeatDead = (r, seat) => {
	const enemy = (r.after.enemies || []).find(e => e.seat === seat) || (r.before.enemies || []).find(e => e.seat === seat);
	assert(enemy, 'enemy seat ' + seat + ' not recorded');
	return [...deadIds(r)].some(tag => tag.startsWith(enemy.id + ':'));
};
const payments = r => r.reqimouPayments || [];
const paidOf = r => {
	const pays = payments(r).map(p => p.paid);
	assert(pays.length <= 1, 'unexpected multiple reqimou payments in ' + r.scenario);
	return pays.length ? pays[0] : null;
};
const stats = r => r.after.policyStats || {};
const reachedSeats = (r, paid) => {
	const range = r.before.attackRange || 1;
	return new Set((r.before.enemies || [])
		.filter(e => e.canUseIgnoringDistance && (e.distance - paid) <= range)
		.map(e => e.seat));
};
const shaUsesOnEnemy = (r, seat) => {
	const enemy = (r.before.enemies || []).find(e => e.seat === seat);
	if (!enemy) return 0;
	const name = enemy.name.split(':')[1];
	let count = 0;
	for (const op of (r.actorOps || [])) {
		if (op.op === 'useCard' && op.args[0] === 'sha' && op.args[2] === name) count++;
	}
	return count;
};

/* ===== P1：可自救的击杀不得被阻断 ===== */
check('P1 far5-tao：付满4濒死自救并击杀（审查复现场景转绿）', () => {
	const r = result('reqimou-blocked-far5-hp4-3sha-tao-hp2-horse');
	assert.equal(enemySeatDead(r, 4), true, '两个变体都必须击杀目标（基线 policy 版本曾存活）');
	assert.equal(paidOf(r), 4, '原生/策略都应支付全部体力并靠桃自救');
	assert.equal(r.after.actor.dead, false);
	if (POLICY) {
		assert((stats(r).reqimouSelfRescue || 0) >= 1, 'gate 评估必须走过自救路径');
		assert.equal(stats(r).reqimouInfeasible, 0, '可自救击杀不得计为不可兑现');
	}
});
check('P1 far5-jiu：酒自救同样放行（canSaveCard 口径）', () => {
	const r = result('reqimou-far5-hp4-3sha-jiu-hp2-horse');
	assert.equal(enemySeatDead(r, 4), true);
	assert.equal(paidOf(r), 4, '原生/策略都应支付全部体力并靠酒自救');
	assert.equal(r.after.actor.dead, false);
});
check('P1 反向 far5-wuxie：不可自救且无其他收益目标时不支付', () => {
	const r = result('reqimou-far5-hp4-3sha-wuxie-hp2-horse');
	assert.equal(paidOf(r), null, '无自救牌时不得支付（付4必死）');
	assert.equal(enemySeatDead(r, 4), false);
	assert.equal(r.after.actor.dead, false);
});
check('P1 far4-tao-clampsave：有自救但小档位足够时 clamp 原生付满', () => {
	const r = result('reqimou-far4-hp4-3sha-tao-hp3-clampsave');
	assert.equal(enemySeatDead(r, 4), true);
	if (POLICY) {
		assert.equal(paidOf(r), 3, '策略收紧为兑现击杀的最小档位3（付满4无额外收益）');
		assert.equal(stats(r).reqimouClamp, 1, '必须发生一次 clamp');
	} else {
		assert.equal(paidOf(r), 4, '原生有桃付满');
	}
});
check('P1 far4-hp3-tao（batch2 基线）：保持击杀', () => {
	const r = result('reqimou-blocked-far4-hp3-3sha-tao-hp2');
	assert.equal(enemySeatDead(r, 4), true);
});
check('P1 防御目标（batch2 回归）：支付只买距离/伤害，不承诺击杀', () => {
	const r = result('reqimou-far4-2sha-hp4-defense');
	assert.equal(enemySeatDead(r, 4), false, '4血八卦+闪目标不应死亡');
});

/* ===== P2：无限杀次数 ===== */
check('P2 crossbow-far4：连弩场景照常支付减距离并击杀', () => {
	const r = result('reqimou-crossbow-far4-3sha-hp2');
	assert.equal(enemySeatDead(r, 4), true);
	assert.equal(paidOf(r), 3, '距离4需付3');
	if (POLICY) assert((stats(r).reqimouInfiniteUses || 0) >= 1, '必须把连弩识别为无限次数');
});
check('P2 crossbow-near1：次数无限+距离可达时策略不支付（native 对照付3）', () => {
	const r = result('reqimou-crossbow-near1-2sha-hp2-idleskip');
	if (POLICY) {
		assert.equal(paidOf(r), null, '策略必须跳过：次数无限且距离可达，支付无收益');
		assert.equal(r.after.actor.hp, 4, 'actor 体力不得被reqimou消耗');
		assert((stats(r).reqimouGateSkip || 0) >= 1, 'gate 必须以“无需支付”跳过');
	} else {
		assert.equal(paidOf(r), 3, '原生对照：贴脸无限次数仍支付 hp-1（策略已修正该无意义支付）');
	}
	assert.equal(enemySeatDead(r, 1), true, '目标由连弩连杀正常击杀');
});

/* ===== 装备与距离回归（batch2 基线） ===== */
check('装备回归：zhangba/chitu/horse 组合击杀与档位', () => {
	const r1 = result('reqimou-far4-hp4-2sha-hp2-zhangba');
	assert.equal(enemySeatDead(r1, 4), true);
	if (POLICY) assert.equal(paidOf(r1), 1, '丈八范围3：距离4只需付1（与纯规则用例一致）');
	const r2 = result('reqimou-far3-hp4-2sha-hp2-chitu');
	assert.equal(enemySeatDead(r2, 4), true);
	const r3 = result('reqimou-far5-hp4-2sha-hp2-zhangba-horse');
	assert.equal(enemySeatDead(r3, 4), true);
	if (POLICY) assert.equal(paidOf(r3), 2, '距离5、范围3：付2');
	const r4 = result('reqimou-far4-hp4-2sha-hp2-noweapon');
	assert.equal(enemySeatDead(r4, 4), true);
	if (POLICY) assert.equal(paidOf(r4), 3, '距离4、范围1：付3');
});
check('batch2 回归：near1/near2 与 far4-2sha-hp3 击杀', () => {
	const r1 = result('reqimou-near1-2sha-hp2');
	if (POLICY) {
		// 策略档位1：只可达座位1，且必须击杀之；native 的目标顺序不受本策略约束
		assert.equal(paidOf(r1), 1, '贴脸2血目标：付1即可兑现');
		assert.equal(enemySeatDead(r1, 1), true, '座位1必须死亡');
	}
	const r2 = result('reqimou-near2-2sha-hp2');
	assert.equal(enemySeatDead(r2, 2), true);
	const r3 = result('reqimou-far4-2sha-hp3');
	assert.equal(enemySeatDead(r3, 4), true);
});
check('batch2 回归：贴脸无收益场景 gate 拦截不发动', () => {
	const r = result('reqimou-far4-hp4-2sha-hp2-kongcheng');
	assert.equal(enemySeatDead(r, 4), false, '空城目标不死于杀');
});

/* ===== P1-2：支付档位与回合收益绑定 ===== */
check('P1-2 双目标：付1兑现近目标，远目标该档位不可及（支付与收益一致）', () => {
	const r = result('reqimou-multi2-pay1-killa');
	if (POLICY) {
		assert.equal(paidOf(r), 1, '3杀下付3与付1收益相同（各1杀），必须取最小档1');
		const reach = reachedSeats(r, 1);
		assert(reach.has(1), '座位1（距离1）支付后可及');
		assert(!reach.has(4), '座位4（距离4）支付1后不可及——不存在“付1打B”的不一致');
		assert.equal(enemySeatDead(r, 1), true, '近目标必须被击杀');
		assert.equal(enemySeatDead(r, 4), false, '远目标该档位不可及且未被击杀');
		assert.equal(shaUsesOnEnemy(r, 4), 0, '不得对不可及目标出杀');
	} else {
		assert.equal(paidOf(r), 3, '原生对照付 hp-1=3');
	}
});
check('P1-2 三目标：付2为全回合最大确定收益（两杀），不按单目标最小值', () => {
	const r = result('reqimou-multi3-pay2-killab');
	if (POLICY) {
		assert.equal(paidOf(r), 2, '4杀下付2兑现 A(1)+B(2)=3≤预算min(4,3)，两杀收益高于付1的单杀');
		const kills = [1, 3, 5].filter(seat => enemySeatDead(r, seat)).length;
		assert.equal(enemySeatDead(r, 1), true, '座位1必须死亡');
		assert(kills >= 2, '至少兑现两杀（收益档位承诺），实际：' + [1, 3, 5].map(s => s + '=' + enemySeatDead(r, s)).join(','));
	} else {
		assert.equal(paidOf(r), 3, '原生对照付 hp-1=3');
	}
});

/* ===== qimou（界魏延）回归 ===== */
check('qimou 回归：三个场景无错误完成', () => {
	for (const name of ['qimou-far4-3sha-hp3', 'qimou-far3-2sha-hp2', 'qimou-far4-3sha-hp4']) {
		result(name);
	}
});

console.log('ALL PASS (' + passed + ') variant=' + variant);
