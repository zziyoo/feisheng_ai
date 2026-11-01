import { DEFENSE_RULES, retentionAdjustment, shouldSkipExchange, fairButtonScore, reqimouNeedsPayment, reqimouOptimalX } from '../score/decision/skills/skillAIPolicyRules.js';

const rule = DEFENSE_RULES.rezhiheng;
const mk = (distance, hp, range = 1) => ({ effect: 1, canUseIgnoringDistance: true, distance, attackRange: range, hp });
const reqimouTargets = [mk(1, 1), mk(3, 2), mk(5, 2)];
const samples = [];
const reqimouSamples = [];
const iterations = 200000;
for (let i = 0; i < iterations; i++) {
	const start = process.hrtime.bigint();
	retentionAdjustment(i % 2 ? 'tao' : 'shan', 3, 'h', 1, rule);
	shouldSkipExchange(3, i % 3 ? ['tao', 'sha'] : ['tao', 'shan'], rule);
	fairButtonScore('player-' + (i % 8), i % 5);
	const ns = Number(process.hrtime.bigint() - start);
	samples.push(ns / 1000);

	const start2 = process.hrtime.bigint();
	reqimouNeedsPayment(reqimouTargets.map(t => ({ ...t, currentlyInRange: (i % 2) === 0, baseUses: i % 4 === 3 ? Infinity : 1 })));
	reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: 1, saveCount: i % 2, targets: reqimouTargets });
	reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: Infinity, saveCount: 0, targets: reqimouTargets });
	reqimouSamples.push(Number(process.hrtime.bigint() - start2) / 1000);
}
samples.sort((a, b) => a - b);
reqimouSamples.sort((a, b) => a - b);
const pct = (sorted, p) => {
	const k = (sorted.length - 1) * p / 100;
	const f = Math.floor(k), c = Math.min(f + 1, sorted.length - 1);
	return sorted[f] + (sorted[c] - sorted[f]) * (k - f);
};
console.log(JSON.stringify({
	iterations,
	unit: 'microseconds per 3-rule batch',
	min: +samples[0].toFixed(3),
	p50: +pct(samples, 50).toFixed(3),
	p95: +pct(samples, 95).toFixed(3),
	p99: +pct(samples, 99).toFixed(3),
	max: +samples[samples.length - 1].toFixed(3),
	reqimou: {
		unit: 'microseconds per reqimou payment evaluation (needsPayment + 2x optimalX, 3 targets)',
		min: +reqimouSamples[0].toFixed(3),
		p50: +pct(reqimouSamples, 50).toFixed(3),
		p95: +pct(reqimouSamples, 95).toFixed(3),
		p99: +pct(reqimouSamples, 99).toFixed(3),
		max: +reqimouSamples[reqimouSamples.length - 1].toFixed(3),
	},
}, null, 2));
