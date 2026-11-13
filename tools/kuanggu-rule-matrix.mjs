#!/usr/bin/env node
// 狂骨规则边界矩阵：measured-real-host 行来自真实宿主探针；synthetic 行只覆盖宿主默认收益无法构造的边界。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kuangguChoice } from '../score/decision/skills/rules/shenhuaFeng.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const option = name => { const i = process.argv.indexOf('--' + name); return i < 0 ? null : process.argv[i + 1]; };
const OUT = path.resolve(option('out') || path.join(ROOT, 'evidence/kuanggu-rule-matrix.json'));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');

/* 封版扩展规则（旧）：原文见 C 配置安装根 rules/shenhuaFeng.js。 */
function oldKuangguChoice(input) {
	const { hp, isDamaged, recoverEffect, shaReady, shaUsable } = input || {};
	if (!isDamaged || !(Number(recoverEffect) > 0)) return 'draw_card';
	const life = Number(hp);
	if (Number.isFinite(life) && life <= 1) return 'recover_hp';
	const ready = Number(shaReady);
	const usable = Number(shaUsable);
	if (Number.isFinite(usable) && usable > 0 && Number.isFinite(ready) && ready >= usable) return 'recover_hp';
	return 'draw_card';
}

/* 正式双风原生补丁公式：character/shenhua.js xinkuanggu.cost。 */
function nativePatchChoice(input) {
	const { hp, isDamaged, recoverEffect, drawEffect, shaReady, shaUsable } = input || {};
	if (!isDamaged || !(Number(recoverEffect) > 0)) return 'draw_card';
	const life = Number(hp);
	if (Number.isFinite(life) && life <= 1) return 'recover_hp';
	if (Number(shaUsable) > 0 && Number(shaReady) >= Number(shaUsable)) return 'recover_hp';
	if (typeof drawEffect === 'number' && Number.isFinite(drawEffect) && Number(recoverEffect) > drawEffect) return 'recover_hp';
	return 'draw_card';
}

const rows = [
	{ name: 'real-original', source: 'measured-real-host', host: 'A/B/C/D: hp3 2sha chitu; after first sha', input: { hp: 3, isDamaged: true, recoverEffect: 19.5, drawEffect: 13, shaReady: 1, shaUsable: 0 }, real: { A: 'recover_hp', B: 'recover_hp', C: 'draw_card', D: 'recover_hp' } },
	{ name: 'real-draw-zhuge', source: 'measured-real-host', host: 'A/B/C/D: hp3 zhuge 1sha; after sha, shaUsable=Infinity', input: { hp: 3, isDamaged: true, recoverEffect: 22.5, drawEffect: 15, shaReady: 0, shaUsable: Infinity }, real: { A: 'draw_card', B: 'recover_hp', C: 'draw_card', D: 'recover_hp' } },
	{ name: 'real-fullhp', source: 'measured-real-host', host: 'A/B/C/D: hp4/4 2sha; after sha', input: { hp: 4, isDamaged: false, recoverEffect: 0, drawEffect: 11.7, shaReady: 1, shaUsable: 0 }, real: { A: 'draw_card', B: 'draw_card', C: 'draw_card', D: 'draw_card' } },
	{ name: 'real-lowhp', source: 'measured-real-host', host: 'A/B/C/D: hp1/4 2sha; after sha', input: { hp: 1, isDamaged: true, recoverEffect: 58.5, drawEffect: 39, shaReady: 1, shaUsable: 0 }, real: { A: 'recover_hp', B: 'recover_hp', C: 'recover_hp', D: 'recover_hp' } },
	{ name: 'real-nosha', source: 'measured-real-host', host: 'A/B/C/D: hp3 1sha; after sha, ready=0 usable=0', input: { hp: 3, isDamaged: true, recoverEffect: 22.5, drawEffect: 15, shaReady: 0, shaUsable: 0 }, real: { A: 'recover_hp', B: 'recover_hp', C: 'draw_card', D: 'recover_hp' } },
	{ name: 'real-midhp-direct', source: 'measured-real-host', host: 'A/B/C/D: hp3 no hand; direct damage, ready=0 usable=1', input: { hp: 3, isDamaged: true, recoverEffect: 22.5, drawEffect: 15, shaReady: 0, shaUsable: 1 }, real: { A: 'draw_card', B: 'recover_hp', C: 'draw_card', D: 'recover_hp' } },
	{ name: 'real-multihit-1', source: 'measured-real-host', host: 'A/B/C/D: hp2 no hand; first direct damage', input: { hp: 2, isDamaged: true, recoverEffect: 40.5, drawEffect: 27, shaReady: 0, shaUsable: 1 }, real: { A: 'draw_card', B: 'recover_hp', C: 'draw_card', D: 'recover_hp' } },
	{ name: 'real-multihit-2', source: 'measured-real-host', host: 'A/B/C/D: hp3 after first recovery; second direct damage', input: { hp: 3, isDamaged: true, recoverEffect: 22.5, drawEffect: 15, shaReady: 0, shaUsable: 1 }, real: { A: 'draw_card', B: 'recover_hp', C: 'draw_card', D: 'recover_hp' } },
	{ name: 'synthetic-recover-1-draw-0.5', source: 'synthetic-rule-input', input: { hp: 3, isDamaged: true, recoverEffect: 1, drawEffect: 0.5, shaReady: 0, shaUsable: 1 } },
	{ name: 'synthetic-recover-1-draw-1', source: 'synthetic-rule-input', input: { hp: 3, isDamaged: true, recoverEffect: 1, drawEffect: 1, shaReady: 0, shaUsable: 1 } },
	{ name: 'synthetic-recover-1-draw-1.5', source: 'synthetic-rule-input', input: { hp: 3, isDamaged: true, recoverEffect: 1, drawEffect: 1.5, shaReady: 0, shaUsable: 1 } },
	{ name: 'synthetic-recover-0-draw-1', source: 'synthetic-rule-input', input: { hp: 3, isDamaged: true, recoverEffect: 0, drawEffect: 1, shaReady: 0, shaUsable: 1 } },
	{ name: 'synthetic-recover-1-draw-0', source: 'synthetic-rule-input', input: { hp: 3, isDamaged: true, recoverEffect: 1, drawEffect: 0, shaReady: 0, shaUsable: 1 } },
	{ name: 'synthetic-recover-1-draw-neg1', source: 'synthetic-rule-input', input: { hp: 3, isDamaged: true, recoverEffect: 1, drawEffect: -1, shaReady: 0, shaUsable: 1 } },
	{ name: 'synthetic-draw-nan', source: 'synthetic-rule-input', input: { hp: 3, isDamaged: true, recoverEffect: 1, drawEffect: NaN, shaReady: 0, shaUsable: 1 } },
	{ name: 'synthetic-draw-infinity', source: 'synthetic-rule-input', input: { hp: 3, isDamaged: true, recoverEffect: 1, drawEffect: Infinity, shaReady: 0, shaUsable: 1 } },
	{ name: 'synthetic-lowhp-recover0', source: 'synthetic-rule-input', input: { hp: 1, isDamaged: true, recoverEffect: 0, drawEffect: 1, shaReady: 0, shaUsable: 1 } },
	{ name: 'synthetic-sha-sufficient', source: 'synthetic-rule-input', input: { hp: 3, isDamaged: true, recoverEffect: 1, drawEffect: 2, shaReady: 2, shaUsable: 2 } },
	{ name: 'synthetic-not-damaged', source: 'synthetic-rule-input', input: { hp: 4, maxHp: 4, isDamaged: false, recoverEffect: 0, drawEffect: 1, shaReady: 0, shaUsable: 1 } },
];

const result = {
	tool: 'kuanggu-rule-matrix',
	rule_sha256: sha(fs.readFileSync(path.join(ROOT, 'score/decision/skills/rules/shenhuaFeng.js'))),
	measured_note: '仅 measured-real-host 行使用真实宿主探针输出的 get.recoverEffect/get.effect 值；synthetic 行不冒充宿主结果。',
	rows: [],
	verdict: {},
};
for (const row of rows) {
	const oldChoice = oldKuangguChoice(row.input);
	const newChoice = kuangguChoice(row.input);
	const nativeChoice = nativePatchChoice(row.input);
	result.rows.push({
		...row,
		old: oldChoice,
		new: newChoice,
		native_patch: nativeChoice,
		new_matches_native_patch: newChoice === nativeChoice,
	});
}
const measured = result.rows.filter(row => row.source === 'measured-real-host');
const synthetic = result.rows.filter(row => row.source === 'synthetic-rule-input');
result.verdict = {
	measured_rows: measured.length,
	synthetic_rows: synthetic.length,
	measured_D_matches_rule: measured.every(row => row.real.D === row.new),
	measured_new_matches_native_patch: measured.every(row => row.new === row.native_patch),
	all_new_matches_native_patch: result.rows.every(row => row.new_matches_native_patch),
	original_p1_reproduced_old_draw_new_recover: oldKuangguChoice(rows[0].input) === 'draw_card' && kuangguChoice(rows[0].input) === 'recover_hp',
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result.verdict));
for (const row of result.rows) {
	console.log([row.name, row.source, 'old=' + row.old, 'new=' + row.new, 'native=' + row.native_patch, 'real=' + (row.real ? JSON.stringify(row.real) : '-')].join(' | '));
}
