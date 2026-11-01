#!/usr/bin/env node
// 汇总逐包验收 JSON 为矩阵（不替代原始证据）。
// 用法：node tools/build-pack-acceptance-matrix.mjs --dir <evidence> --out <matrix.json>
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const option = name => { const index = args.indexOf('--' + name); return index < 0 ? null : args[index + 1]; };
const DIR = path.resolve(option('dir') || 'C:/Users/32360/Desktop/repair-baseline/evidence');
const OUT = path.resolve(option('out') || path.join(DIR, 'pack-acceptance-matrix.json'));
const files = fs.readdirSync(DIR).filter(name => /^accept-.*\.json$/.test(name) && !name.includes('test') && name !== 'accept-all-summary.json').sort();
const rows = [];
for (const file of files) {
	const data = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
	const step = name => (data.steps || []).find(item => item.step === name) || null;
	const installed = (data.steps || []).find(item => item.step === 'host-load-installed');
	const rolled = (data.steps || []).find(item => item.step === 'host-load-rolledback');
	const installedPacks = installed && installed.policyStats && installed.policyStats.packs ? Object.keys(installed.policyStats.packs) : [];
	const rolledPacks = rolled && rolled.policyStats && rolled.policyStats.packs ? Object.keys(rolled.policyStats.packs) : [];
	const pack = (data.packs || [])[0] || {};
	rows.push({
		file,
		mode: data.mode,
		pass: !!data.pass,
		pack_id: data.mode === 'combined' ? 'combined' : (pack.id || null),
		delivery_stage: pack.delivery_stage || null,
		zip_sha256: data.mode === 'combined' ? 'multiple' : (pack.zip_sha256 || null),
		zip_size: pack.zip_size || null,
		package_tests: pack.package_tests_status === 0,
		verify_zip: pack.verify_zip_status === 0,
		verify_dir: pack.verify_dir_status === 0,
		verify_cross_platform: pack.verify_cross_platform_status === 0,
		install: step('apply')?.status === 'passed' || (data.steps || []).some(item => item.step === 'apply-coexist'),
		install_checks: step('install-check')?.status === 'passed' || (data.steps || []).some(item => item.step === 'apply-coexist'),
		host_load_installed: installed ? installed.status : 'missing',
		installed_packs: installedPacks,
		rollback: (data.steps || []).some(item => item.step === 'rollback' && item.status === 'passed') || (data.steps || []).some(item => item.step === 'rollback-coexist'),
		rollback_checks: step('rollback-check')?.status === 'passed' || (data.steps || []).some(item => item.step === 'rollback-coexist'),
		host_load_rolledback: rolled ? rolled.status : 'missing',
		rolledback_packs: rolledPacks,
		contract_passed: (data.steps || []).some(item => item.step === 'install-check' && item.status === 'passed'),
		error: data.error || null,
	});
}
const matrix = {
	schema_version: '1.0',
	generated_at: new Date().toISOString(),
	scope: '实际分包 ZIP 的逐包/共存独立验收；原始 JSON 保留在同目录。',
	rows,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(matrix, null, 2) + '\n');
const lines = ['# 分包独立验收矩阵', '', `- 生成时间：${matrix.generated_at}`, `- 文件数：${rows.length}`, '', '| 包 | 模式 | 结果 | ZIP SHA256（前12） | 包内测试 | ZIP校验 | 单包安装 | 安装检查 | 装载 | 卸载 | 回滚检查 | 卸载后装载 | 已注册包 | 回滚后注册包 |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
for (const row of rows) {
	lines.push(`| ${row.pack_id || row.file} | ${row.mode} | ${row.pass ? 'PASS' : 'FAIL'} | ${(row.zip_sha256 || '').slice(0, 12)} | ${row.package_tests ? 'PASS' : 'FAIL'} | ${row.verify_zip && row.verify_dir && row.verify_cross_platform ? 'PASS' : 'FAIL'} | ${row.install ? 'PASS' : 'FAIL'} | ${row.install_checks ? 'PASS' : 'FAIL'} | ${row.host_load_installed} | ${row.rollback ? 'PASS' : 'FAIL'} | ${row.rollback_checks ? 'PASS' : 'FAIL'} | ${row.host_load_rolledback} | ${row.installed_packs.join('、') || '-'} | ${row.rolledback_packs.join('、') || '-'} |`);
}
fs.writeFileSync(OUT.replace(/\.json$/, '.md'), lines.join('\n') + '\n');
console.log(JSON.stringify({ out: OUT, rows: rows.length, pass: rows.filter(row => row.pass).length }, null, 2));
