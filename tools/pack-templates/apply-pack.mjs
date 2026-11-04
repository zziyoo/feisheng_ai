#!/usr/bin/env node
// 安全集成：预计算全部变更、备份将被修改的既有文件、失败时恢复到安装前状态。
// 用法：node integration/apply-pack.mjs --extension-root <无名AI根目录> [--dry-run]
// 测试注入：DJSC_PACK_TEST_FAIL_AFTER=<n> 在第 n 次成功写入后抛出异常。
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
const failAfter = Number(process.env.DJSC_PACK_TEST_FAIL_AFTER || 0);
const INSTALL_TEMP = '.djsc-pack-install.tmp';

class ApplyFailure extends Error {}
const fail = message => { throw new ApplyFailure(message); };
const isBlocked = file => {
	const resolved = path.resolve(file);
	return resolved !== targetRoot && !resolved.startsWith(targetRoot + path.sep);
};

function atomicWrite(target, content) {
	const temporary = target + '.tmp-' + process.pid;
	try {
		fs.writeFileSync(temporary, content);
		fs.renameSync(temporary, target);
	} finally {
		try { if (exists(temporary)) fs.rmSync(temporary, { force: true }); } catch (error) {}
	}
}

function backupFile(backupDir, targetRel, bytes) {
	const backupPath = path.join(backupDir, 'backup', ...targetRel.split('/'));
	fs.mkdirSync(path.dirname(backupPath), { recursive: true });
	fs.writeFileSync(backupPath, bytes);
	return path.relative(targetRoot, backupPath).split(path.sep).join('/');
}

function verifyRegistryImports(text, pendingModules) {
	const pattern = /import\s*\{\s*pack\s+as\s+([A-Za-z0-9_$]+)\s*\}\s*from\s*['"]\.\/packs\/([^'"?]+)\.js(?:\?[^'"]*)?['"]/g;
	const seen = new Set();
	let match;
	while ((match = pattern.exec(text))) {
		const moduleName = match[2];
		if (pendingModules.has(moduleName)) continue;
		const target = rel('score/decision/skills/packs/' + moduleName + '.js');
		if (!exists(target)) fail(`注册表引用了不存在的分包模块：score/decision/skills/packs/${moduleName}.js`);
		seen.add(moduleName);
	}
	return seen;
}

function plannedModules() {
	return new Set([pack.module]);
}

function buildPlan() {
	if (!pack.id || !pack.module) fail('pack.json 缺少 id/module');
	if (!exists(rel('score/index.js'))) fail('目标不是无名AI扩展根目录（缺少 score/index.js）：' + targetRoot);
	const index = read(rel('score/index.js')).toString('utf8');
	if (!index.includes('installSkillAIPolicies') || !index.includes('uninstallSkillAIPolicies')) {
		fail('目标 score/index.js 未接线策略层；请先应用包内 patches/score-index.diff，或手工加入 install/uninstall 调用');
	}
	for (const dependency of ['score/foundation/adapt/host.js', 'score/decision/safety/aiOverride.js']) {
		if (!exists(rel(dependency))) fail('缺少共享基础依赖：' + dependency);
	}

	const plan = { creates: [], updates: [], skips: [], registry: null };
	const pendingModules = plannedModules();
	const planCopy = (sourceRel, targetRel, expectedHash, kind) => {
		const sourcePath = path.join(BASE, ...sourceRel.split('/'));
		if (!exists(sourcePath)) fail('包内缺少源文件：' + sourceRel);
		const source = read(sourcePath);
		const actualSourceHash = sha(source);
		if (expectedHash && actualSourceHash !== expectedHash) {
			fail(`包内源文件哈希与 pack.json 不一致：${sourceRel}\n  pack.json=${expectedHash}\n  实际=${actualSourceHash}`);
		}
		const target = rel(targetRel);
		if (!exists(target)) {
			plan.creates.push({ targetRel, sourceRel, bytes: source, hash: actualSourceHash, kind });
			return;
		}
		const actual = sha(read(target));
		if (actual === actualSourceHash) {
			plan.skips.push({ targetRel, hash: actual, kind });
			return;
		}
		fail(`${kind} 文件已存在且与包内版本不同：${targetRel}\n  目标SHA256=${actual}\n  包内SHA256=${actualSourceHash}\n  为避免覆盖其他开发者修改，未写入；请使用包内 diff 合并或先回滚冲突文件。`);
	};

	for (const name of ['policyCore.js', 'skillAIPolicies.js', 'skillVetoRegistry.js']) {
		planCopy('source/score/decision/skills/' + name, 'score/decision/skills/' + name, pack.shared_files[name], '共享核心');
	}
	for (const file of [`packs/${pack.module}.js`, `rules/${pack.rules}.js`]) {
		const expectedHash = pack.pack_files && pack.pack_files[file];
		planCopy('source/score/decision/skills/' + file, 'score/decision/skills/' + file, expectedHash, '分包');
	}

	const registryRel = 'score/decision/skills/skillAIPolicyPacks.js';
	const registryPath = rel(registryRel);
	const importLine = `import { pack as ${pack.module} } from './packs/${pack.module}.js?v=41a';`;
	/* 条目插在 marker 行前；marker 行自带的缩进就是条目缩进，避免双 tab。 */
	const entryLine = `${pack.module},`;
	if (!exists(registryPath)) {
		const source = read(path.join(BASE, 'integration', 'pack-only', 'skillAIPolicyPacks.js')).toString('utf8');
		verifyRegistryImports(source, pendingModules);
		plan.registry = { mode: 'created', importLine, entryLine, before: null, after: Buffer.from(source), installedHash: sha(Buffer.from(source)) };
	} else {
		const before = read(registryPath);
		const text = before.toString('utf8');
		verifyRegistryImports(text, pendingModules);
		const hasImport = text.includes(importLine);
		const hasEntry = new RegExp('^\\s*' + pack.module + ',\\s*$', 'm').test(text);
		/* 注册表已声明本包但文件缺失属于不一致的预存状态：若补齐后回滚，注册行会指向已删除模块。
		   安装前拒绝，避免制造无法安全回滚的记录。 */
		const missingOwnFiles = plan.creates.filter(action => action.kind === '分包');
		if ((hasImport || hasEntry) && missingOwnFiles.length) {
			fail('注册表已包含本分包的导入/注册行，但分包文件缺失：' + missingOwnFiles.map(action => action.targetRel).join('、') + '\n  这是不一致的预存状态；拒绝安装。请先移除注册表中的本包行，或补齐相同版本的分包文件后重试。');
		}
		if (hasImport && hasEntry) {
			plan.registry = { mode: 'already', importLine, entryLine, before, after: before, installedHash: sha(before) };
		} else {
			const hasMarkers = text.includes('// @djsc-pack-imports-end') && text.includes('// @djsc-pack-registry-end');
			if (!hasMarkers) fail('目标注册表存在但没有 @djsc-pack-* marker；请用包内 patches/registry.diff 合并，不会覆盖现文件');
			let next = text;
			if (!hasImport) next = next.replace('// @djsc-pack-imports-end', importLine + '\n// @djsc-pack-imports-end');
			if (!hasEntry) next = next.replace('// @djsc-pack-registry-end', entryLine + '\n// @djsc-pack-registry-end');
			plan.registry = { mode: 'updated', importLine, entryLine, before, after: Buffer.from(next), installedHash: sha(Buffer.from(next)) };
		}
	}
	return plan;
}

function summarize(plan) {
	return {
		pack: pack.id,
		root: targetRoot,
		actions: [
			...plan.creates.map(action => ({ type: 'create', target: action.targetRel, kind: action.kind })),
			...plan.updates.map(action => ({ type: 'update', target: action.targetRel, kind: action.kind })),
			{ type: plan.registry.mode === 'already' ? 'registry-already' : 'registry-' + plan.registry.mode, target: 'score/decision/skills/skillAIPolicyPacks.js' },
		],
		skips: plan.skips,
		registry: plan.registry.mode,
	};
}

function recoverIncomplete(backupDir) {
	const journalPath = path.join(backupDir, 'transaction.json');
	if (!exists(journalPath)) {
		fs.rmSync(backupDir, { recursive: true, force: true });
		return;
	}
	const journal = JSON.parse(read(journalPath).toString('utf8'));
	if (journal.status === 'committed') fail('安装已提交但缺少 record.json；请人工检查：' + path.relative(targetRoot, backupDir));
	const conflicts = [];
	for (const action of [...(journal.created || [])].reverse()) {
		const target = rel(action.target);
		if (!exists(target)) continue;
		if (sha(read(target)) === action.hash) fs.rmSync(target, { force: true });
		else conflicts.push(`新增文件已被他人修改，保留：${action.target}`);
	}
	for (const action of [...(journal.updated || [])].reverse()) {
		const target = rel(action.target);
		if (!exists(target)) continue;
		if (sha(read(target)) !== action.hash) {
			conflicts.push(`已修改文件在失败安装后被他人改动，保留：${action.target}`);
			continue;
		}
		const backup = (journal.backups || []).find(item => item.target === action.target);
		if (backup) {
			const backupPath = path.join(targetRoot, ...backup.path.split('/'));
			if (exists(backupPath)) atomicWrite(target, read(backupPath));
			else conflicts.push(`缺少恢复备份：${backup.path}`);
		} else {
			fs.rmSync(target, { force: true });
		}
	}
	if (conflicts.length) fail('检测到未完成安装且无法自动恢复：' + conflicts.join('；'));
	fs.rmSync(backupDir, { recursive: true, force: true });
}

function applyPlan(plan) {
	const backupDir = path.join(targetRoot, '.djsc-pack-backups', pack.id);
	if (exists(backupDir)) {
		const existingRecord = path.join(backupDir, 'record.json');
		if (exists(existingRecord)) {
			fail('已存在安装记录；请先运行 rollback-pack.mjs，或确认目标状态后手工处理：' + path.relative(targetRoot, backupDir));
		}
		recoverIncomplete(backupDir);
	}
	fs.mkdirSync(backupDir, { recursive: true });
	const journal = {
		pack_id: pack.id,
		started_at: new Date().toISOString(),
		status: 'pending',
		target_root: targetRoot,
		created: [],
		updated: [],
		backups: [],
	};
	const journalPath = path.join(backupDir, 'transaction.json');
	const writeJournal = () => atomicWrite(journalPath, JSON.stringify(journal, null, 2) + '\n');
	writeJournal();
	let writes = 0;
	const tick = () => {
		writes++;
		if (failAfter && writes >= failAfter) throw new Error('DJSC_PACK_TEST_FAIL_AFTER injected failure after ' + writes + ' write(s)');
	};
	const restore = [];
	try {
		for (const action of plan.creates) {
			const target = rel(action.targetRel);
			if (isBlocked(target)) fail('越界写入：' + action.targetRel);
			if (exists(target)) fail('写入前目标已出现，停止：' + action.targetRel);
			fs.mkdirSync(path.dirname(target), { recursive: true });
			atomicWrite(target, action.bytes);
			journal.created.push({ target: action.targetRel, hash: action.hash, kind: action.kind });
			writeJournal();
			tick();
			restore.push(() => {
				if (!exists(target)) return;
				if (sha(read(target)) === action.hash) fs.rmSync(target, { force: true });
			});
		}
		if (plan.registry.mode === 'updated' || plan.registry.mode === 'created') {
			const target = rel('score/decision/skills/skillAIPolicyPacks.js');
			if (isBlocked(target)) fail('越界写入：score/decision/skills/skillAIPolicyPacks.js');
			fs.mkdirSync(path.dirname(target), { recursive: true });
			if (plan.registry.before) {
				journal.backups.push({ target: 'score/decision/skills/skillAIPolicyPacks.js', path: backupFile(backupDir, 'score/decision/skills/skillAIPolicyPacks.js', plan.registry.before) });
			}
			atomicWrite(target, plan.registry.after);
			journal.updated.push({ target: 'score/decision/skills/skillAIPolicyPacks.js', hash: plan.registry.installedHash, kind: '注册表' });
			writeJournal();
			tick();
			restore.push(() => {
				if (!exists(target)) return;
				if (sha(read(target)) !== plan.registry.installedHash) return;
				if (plan.registry.before) atomicWrite(target, plan.registry.before);
				else fs.rmSync(target, { force: true });
			});
		}
		const record = {
			pack_id: pack.id,
			pack_name: pack.name,
			package_stage: pack.delivery_stage,
			installed_at: new Date().toISOString(),
			target_root: targetRoot,
			created: journal.created,
			skips: plan.skips,
			registry: {
				mode: plan.registry.mode,
				importLine: plan.registry.importLine,
				entryLine: plan.registry.entryLine,
				installedHash: plan.registry.installedHash,
				beforeHash: plan.registry.before ? sha(plan.registry.before) : null,
				before: plan.registry.before ? plan.registry.before.toString('utf8') : null,
				backup: journal.backups.find(item => item.target === 'score/decision/skills/skillAIPolicyPacks.js')?.path || null,
			},
		};
		atomicWrite(path.join(backupDir, 'record.json'), JSON.stringify(record, null, 2) + '\n');
		journal.status = 'committed';
		writeJournal();
		return { status: journal.created.length || plan.registry.mode !== 'already' ? 'applied' : 'already-installed', record, backup: path.relative(targetRoot, backupDir) };
	} catch (error) {
		const restored = [];
		const conflicts = [];
		for (const action of restore.reverse()) {
			try { action(); restored.push(action); } catch (restoreError) { conflicts.push(String(restoreError)); }
		}
		journal.status = 'failed-rolled-back';
		journal.failure = String(error && error.stack || error);
		journal.restore_conflicts = conflicts;
		try { writeJournal(); } catch (journalError) {}
		throw Object.assign(new Error((error && error.message || String(error)) + (conflicts.length ? '\n恢复冲突：' + conflicts.join('; ') : '')), { restored: restored.length, journal });
	}
}

try {
	const plan = buildPlan();
	const summary = summarize(plan);
	if (dryRun) {
		console.log(JSON.stringify({ ...summary, status: 'planned' }, null, 2));
		process.exit(0);
	}
	if (plan.registry.mode === 'already' && !plan.creates.length) {
		console.log(JSON.stringify({ ...summary, status: 'already-installed' }, null, 2));
		process.exit(0);
	}
	const outcome = applyPlan(plan);
	console.log(JSON.stringify({ ...summary, status: outcome.status, backup: outcome.backup }, null, 2));
} catch (error) {
	console.error('APPLY FAIL: ' + (error && error.message || error));
	process.exit(1);
}
