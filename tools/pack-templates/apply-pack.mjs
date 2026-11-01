#!/usr/bin/env node
// 安全集成：只新增本分包文件；共享核心版本不一致时拒绝覆盖。
// 用法：node integration/apply-pack.mjs --extension-root <无名AI根目录> [--dry-run]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
const root = option('extension-root');
const dryRun = args.includes('--dry-run');
if (!root) {
	console.error('usage: node integration/apply-pack.mjs --extension-root <dir> [--dry-run]');
	process.exit(2);
}
const targetRoot = path.resolve(root);
const pack = JSON.parse(fs.readFileSync(path.join(BASE, 'pack.json'), 'utf8'));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const read = file => fs.readFileSync(file);
const exists = file => fs.existsSync(file);
const rel = file => path.join(targetRoot, ...file.split('/'));
const actions = [];

function fail(message) {
	console.error('APPLY FAIL: ' + message);
	process.exit(1);
}

if (!exists(rel('score/index.js'))) fail('目标不是无名AI扩展根目录（缺少 score/index.js）：' + targetRoot);
const index = read(rel('score/index.js')).toString('utf8');
if (!index.includes('installSkillAIPolicies') || !index.includes('uninstallSkillAIPolicies')) {
	fail('目标 score/index.js 未接线策略层；请先应用包内 patches/score-index.diff，或手工加入 install/uninstall 调用');
}
for (const dependency of ['score/foundation/adapt/host.js', 'score/decision/safety/aiOverride.js']) {
	if (!exists(rel(dependency))) fail('缺少共享基础依赖：' + dependency);
}

function planCopy(sourceRel, targetRel, expectedHash, kind) {
	const target = rel(targetRel);
	if (!exists(target)) {
		actions.push({ type: 'create', source: sourceRel, target: targetRel, hash: expectedHash, kind });
		return;
	}
	const actual = sha(read(target));
	if (actual === expectedHash) return;
	fail(`${kind} 文件已存在且与包内版本不同：${targetRel}\n  目标SHA256=${actual}\n  包内SHA256=${expectedHash}\n  为避免覆盖其他开发者修改，未写入；请使用包内 diff 合并或先回滚冲突文件。`);
}

for (const name of ['policyCore.js', 'skillAIPolicies.js']) {
	const sourceRel = 'source/score/decision/skills/' + name;
	planCopy(sourceRel, 'score/decision/skills/' + name, pack.shared_files[name], '共享核心');
}
for (const file of [`packs/${pack.module}.js`, `rules/${pack.rules}.js`]) {
	const sourceRel = 'source/score/decision/skills/' + file;
	const expectedHash = pack.pack_files[file] || sha(read(path.join(BASE, sourceRel)));
	planCopy(sourceRel, 'score/decision/skills/' + file, expectedHash, '分包');
}

// 注册表：不存在则用 pack-only 版本；存在则只在 marker 内追加，绝不整文件替换。
const registryRel = 'score/decision/skills/skillAIPolicyPacks.js';
const registryPath = rel(registryRel);
const importLine = `import { pack as ${pack.module} } from './packs/${pack.module}.js?v=41a';`;
const entryLine = `\t${pack.module},`;
let registry = null;
if (!exists(registryPath)) {
	const source = read(path.join(BASE, 'integration', 'pack-only', 'skillAIPolicyPacks.js'));
	actions.push({ type: 'create-registry', target: registryRel, content: source.toString('utf8'), kind: '注册表' });
	registry = { mode: 'created', importLine, entryLine, installedHash: sha(source) };
} else {
	const text = read(registryPath).toString('utf8');
	if (text.includes(importLine) && new RegExp('^\\s*' + pack.module + ',\\s*$', 'm').test(text)) {
		registry = { mode: 'already', importLine, entryLine, installedHash: sha(Buffer.from(text)) };
	} else {
		const hasMarkers = text.includes('// @djsc-pack-imports-end') && text.includes('// @djsc-pack-registry-end');
		if (!hasMarkers) fail('目标注册表存在但没有 @djsc-pack-* marker；请用包内 patches/registry.diff 合并，不会覆盖现文件');
		let next = text;
		if (!next.includes(importLine)) next = next.replace('// @djsc-pack-imports-end', importLine + '\n// @djsc-pack-imports-end');
		if (!new RegExp('^\\s*' + pack.module + ',\\s*$', 'm').test(next)) next = next.replace('// @djsc-pack-registry-end', entryLine + '\n// @djsc-pack-registry-end');
		actions.push({ type: 'update-registry', target: registryRel, content: next, kind: '注册表' });
		registry = { mode: 'inserted', importLine, entryLine, installedHash: sha(Buffer.from(next)) };
	}
}

if (dryRun) {
	console.log(JSON.stringify({ pack: pack.id, root: targetRoot, actions: actions.map(a => ({ type: a.type, target: a.target })), registry: registry.mode }, null, 2));
	process.exit(0);
}

const backupDir = path.join(targetRoot, '.djsc-pack-backups', pack.id);
fs.mkdirSync(backupDir, { recursive: true });
const record = {
	pack_id: pack.id,
	pack_name: pack.name,
	package_stage: pack.delivery_stage,
	installed_at: new Date().toISOString(),
	target_root: targetRoot,
	actions: [],
	registry,
};
try {
	for (const action of actions) {
		if (action.type === 'create') {
			const source = read(path.join(BASE, action.source));
			const target = rel(action.target);
			fs.mkdirSync(path.dirname(target), { recursive: true });
			if (exists(target)) fail('写入前目标已出现，停止：' + action.target);
			fs.writeFileSync(target, source);
			record.actions.push({ type: 'create', target: action.target, hash: sha(source), kind: action.kind });
		} else if (action.type === 'create-registry' || action.type === 'update-registry') {
			const target = rel(action.target);
			const content = Buffer.from(action.content);
			fs.mkdirSync(path.dirname(target), { recursive: true });
			fs.writeFileSync(target, content);
			record.actions.push({ type: action.type, target: action.target, hash: sha(content), kind: action.kind });
		}
	}
	fs.writeFileSync(path.join(backupDir, 'record.json'), JSON.stringify(record, null, 2) + '\n');
	console.log(JSON.stringify({ status: 'applied', pack: pack.id, actions: record.actions.length, registry: registry.mode, backup: path.relative(targetRoot, backupDir) }, null, 2));
} catch (error) {
	console.error('APPLY ERROR: ' + (error && error.stack || error));
	fs.writeFileSync(path.join(backupDir, 'failed-record.json'), JSON.stringify(record, null, 2) + '\n');
	process.exit(1);
}
