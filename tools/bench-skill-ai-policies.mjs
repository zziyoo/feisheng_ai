import { DEFENSE_RULES, retentionAdjustment, shouldSkipExchange, fairButtonScore } from '../score/decision/skills/skillAIPolicyRules.js';

const rule = DEFENSE_RULES.rezhiheng;
const samples = [];
const iterations = 200000;
for (let i = 0; i < iterations; i++) {
	const start = process.hrtime.bigint();
	retentionAdjustment(i % 2 ? 'tao' : 'shan', 3, 'h', 1, rule);
	shouldSkipExchange(3, i % 3 ? ['tao', 'sha'] : ['tao', 'shan'], rule);
	fairButtonScore('player-' + (i % 8), i % 5);
	const ns = Number(process.hrtime.bigint() - start);
	samples.push(ns / 1000);
}
samples.sort((a, b) => a - b);
const pct = p => {
	const k = (samples.length - 1) * p / 100;
	const f = Math.floor(k), c = Math.min(f + 1, samples.length - 1);
	return samples[f] + (samples[c] - samples[f]) * (k - f);
};
console.log(JSON.stringify({
	iterations,
	unit: 'microseconds per 3-rule batch',
	min: +samples[0].toFixed(3),
	p50: +pct(50).toFixed(3),
	p95: +pct(95).toFixed(3),
	p99: +pct(99).toFixed(3),
	max: +samples[samples.length - 1].toFixed(3),
}, null, 2));
