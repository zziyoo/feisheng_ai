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
	const imports = [];
	const modules = new Set(), aliases = new Set();
	for (const line of text.split(/\r?\n/)) {
		if (!/^\s*import\b/.test(line)) continue;
		if (!/\bfrom\s*['"]/.test(line)) fail('注册表含无法安全识别的导入结构，请先手工整理：' + line.trim());
		if (!line.includes('./packs/')) continue;
		const match = line.match(/^\s*import\s*\{\s*pack\s+as\s+([A-Za-z_$][\w$]*)\s*\}\s*from\s*(['"])\.\/packs\/([A-Za-z0-9_-]+)\.js(\?[^'"\s]*)?\2\s*;?\s*$/);
		if (!match) fail('无法安全识别注册表分包导入，请先手工整理：' + line.trim());
		const [, alias, , moduleName, query = ''] = match;
		if (modules.has(moduleName)) fail('注册表重复导入分包模块：' + moduleName);
		if (aliases.has(alias)) fail('注册表重复声明导入别名：' + alias);
		modules.add(moduleName); aliases.add(alias);
		if (!pendingModules.has(moduleName) && !exists(rel('score/decision/skills/packs/' + moduleName + '.js'))) fail('注册表引用了不存在的分包模块：' + moduleName);
		imports.push({ alias, moduleName, query, line: line.trim() });
	}
	return imports;
}

function plannedModules() {
	return new Set([pack.module]);
}

function requestedImport(imports) {
	const sameModule = imports.find(item => item.moduleName === pack.module);
	const sameAlias = imports.find(item => item.alias === pack.module);
	if (sameModule && sameModule.query !== '?v=41a') fail(`分包模块 ${pack.module} 导入版本冲突：已有 ${sameModule.query || '无查询参数'}，待安装 ?v=41a；请先安全迁移或调整现有注册配置。`);
	if (sameModule && sameModule.alias !== pack.module) fail(`分包模块 ${pack.module} 已使用别名 ${sameModule.alias}，请先手工协调注册配置。`);
	if (sameAlias && sameAlias.moduleName !== pack.module) fail(`导入别名 ${pack.module} 已用于模块 ${sameAlias.moduleName}，拒绝重复声明。`);
	return sameModule;
}

function buildPlan() {
	if (!pack.id || !pack.module) fail('pack.json 缺少 id/module');
	if (!/^[A-Za-z_$][\w$]*$/.test(pack.module)) fail('分包模块标识符无效');
	if (!exists(rel('score/index.js'))) fail('目标不是无名AI扩展根目录（缺少 score/index.js）：' + targetRoot);
	const index = read(rel('score/index.js')).toString('utf8');
	if (!index.includes('installSkillAIPolicies') || !index.includes('uninstallSkillAIPolicies')) {
		fail('目标 score/index.js 未接线策略层；请先应用包内 patches/score-index.diff，或手工加入 install/uninstall 调用');
	}
	for (const dependency of ['score/foundation/adapt/host.js', 'score/decision/safety/aiOverride.js']) {
		if (!exists(rel(dependency))) fail('缺少共享基础依赖：' + dependency);
	}

	const plan = { creates: [], updates: [], skips: [], registry: null };
	const enginePath = rel('score/decision/engine/engine.js');
	const engineSource = exists(enginePath) ? read(enginePath).toString('utf8') : '';
	plan.fullEngineHintWired = /import\s*\{[^}]*\bapplySkillPlanHints\b[^}]*\}\s*from\s*['"][^'"]*skillPlanHints\.js/.test(engineSource) && /\bapplySkillPlanHints\s*\(\s*me\s*,\s*acts\s*\)/.test(engineSource);
	if (pack.id === 'refresh_standard') {
		for (const file of ['skillPlanHints.js', 'rules/boundedSkillUtility.js', 'rules/refreshStandardPlans.js']) {
			if (!pack.pack_files?.[file]) fail('标准包依赖清单缺少文件或哈希：' + file);
		}
	}
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
	for (const file of Object.keys(pack.pack_files || { [`packs/${pack.module}.js`]: null, [`rules/${pack.rules}.js`]: null })) {
		if (!/^(?:packs|rules)\/[A-Za-z0-9_-]+\.js$/.test(file) && file !== 'skillPlanHints.js') fail('非法分包依赖路径：' + file);
		if (file === 'skillPlanHints.js') {
			const pipeline = rel('score/decision/utility/utilityPipeline.js');
			if (!exists(pipeline) || !exists(rel('score/decision/utility/utilityVector.js'))) fail('缺少共享基础依赖：utilityPipeline.js 或 utilityVector.js；请先迁移完整引擎');
			if (!/export\s+function\s+applyOwnedUtility\s*\(/.test(read(pipeline).toString('utf8'))) fail('共享 utilityPipeline.js 未提供 applyOwnedUtility；请先迁移兼容的完整引擎');
		}
		const expectedHash = pack.pack_files && pack.pack_files[file];
		planCopy('source/score/decision/skills/' + file, 'score/decision/skills/' + file, expectedHash, file === 'skillPlanHints.js' ? '共享核心' : '分包');
	}
	const hintTarget = 'score/decision/skills/skillPlanHints.js';
	if (engineSource.includes('skillPlanHints.js') && !exists(rel(hintTarget)) && !plan.creates.some(item => item.targetRel === hintTarget)) fail('完整引擎依赖 skillPlanHints.js，但目标和本次安装计划均未提供该文件');

	const registryRel = 'score/decision/skills/skillAIPolicyPacks.js';
	const registryPath = rel(registryRel);
	const conflictingModule = pack.id === 'refresh_feng' ? 'shenhuaFeng' : (pack.id === 'shenhua_feng' ? 'refreshFeng' : null);
	if (conflictingModule && exists(registryPath)) {
		const existingRegistry = read(registryPath).toString('utf8');
		const otherImport = new RegExp(String.raw`import\s*\{\s*pack\s+as\s+[\w$]+\s*\}\s*from\s*['"]\./packs/${conflictingModule}\.js(?:\?[^'"]*)?['"]`);
		if (otherImport.test(existingRegistry)) {
			const capability = pack.wind_compatibility;
			const peerPath = rel('score/decision/skills/packs/' + conflictingModule + '.js');
			if (!capability || capability.protocol !== 'dual-feng-shared-entry-v1' || capability.peer_module !== conflictingModule || !/^[a-f0-9]{64}$/.test(capability.peer_sha256 || '') || !exists(peerPath) || sha(read(peerPath)) !== capability.peer_sha256) {
				fail('双风版本或对包源码不匹配；请先回滚旧风包并迁移到同一兼容候选，不会覆盖现有文件。');
			}
		}
	}
	const importLine = `import { pack as ${pack.module} } from './packs/${pack.module}.js?v=41a';`;
	/* 条目插在 marker 行前；marker 行自带的缩进就是条目缩进，避免双 tab。 */
	const entryLine = `${pack.module},`;
	if (!exists(registryPath)) {
		const source = read(path.join(BASE, 'integration', 'pack-only', 'skillAIPolicyPacks.js')).toString('utf8');
		const templateImports = verifyRegistryImports(source, pendingModules);
		if (!requestedImport(templateImports) || (source.match(new RegExp('^[\\t ]*' + pack.module + ',[\\t ]*$', 'gm')) || []).length !== 1) fail('包内注册表模板缺少唯一的本分包导入或条目');
		plan.registry = { mode: 'created', importLine, entryLine, before: null, after: Buffer.from(source), installedHash: sha(Buffer.from(source)) };
	} else {
		const before = read(registryPath);
		const text = before.toString('utf8');
		const imports = verifyRegistryImports(text, pendingModules);
		const sameModule = requestedImport(imports);
		for (const line of text.split(/\r?\n/)) {
			if (/^\s*import\b/.test(line) && !line.includes('./packs/') && new RegExp('\\b' + pack.module + '\\b').test(line)) fail('其他导入可能占用本分包别名，请先手工检查：' + pack.module);
		}
		const hasImport = !!sameModule;
		const registryArray = text.match(/export\s+const\s+SKILL_AI_PACKS\s*=\s*\[([\s\S]*?)\]\s*;/);
		if (!registryArray) fail('无法安全识别 SKILL_AI_PACKS 注册数组，请先手工整理。');
		const entries = registryArray[1].match(new RegExp('^[\\t ]*' + pack.module + ',[\\t ]*$', 'gm')) || [];
		if (entries.length > 1) fail('注册表存在重复分包条目：' + pack.module);
		const hasEntry = entries.length === 1;
		if (hasEntry && !hasImport) fail('注册表已有本分包条目但缺少匹配导入，请先手工修复：' + pack.module);
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
			plan.registry = { mode: 'updated', importLine: hasImport ? '' : importLine, entryLine: hasEntry ? '' : entryLine, before, after: Buffer.from(next), installedHash: sha(Buffer.from(next)) };
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
		fullEngineHintWired: plan.fullEngineHintWired,
		hintNotice: pack.id === 'refresh_standard' && !plan.fullEngineHintWired ? '未确认完整引擎软建议接线；宿主策略可独立使用，完整引擎需另行迁移接线。' : null,
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
	/* Preflight first: never delete installed modules while the registry has a conflict. */
	for (const action of journal.updated || []) {
		const target = rel(action.target);
		if (!exists(target)) {
			if (action.beforeHash) conflicts.push(`原文件已消失，保留事务：${action.target}`);
			continue;
		}
		const current = sha(read(target));
		if (current !== action.hash && current !== action.beforeHash) conflicts.push(`已修改文件在失败安装后被他人改动，保留：${action.target}`);
		if (current === action.hash && action.beforeHash) {
			const backup = (journal.backups || []).find(item => item.target === action.target);
			if (!backup || !exists(path.join(targetRoot, ...backup.path.split('/')))) conflicts.push(`缺少恢复备份：${action.target}`);
		}
	}
	for (const action of journal.created || []) {
		const target = rel(action.target);
		if (exists(target) && sha(read(target)) !== action.hash) conflicts.push(`新增文件已被他人修改，保留：${action.target}`);
	}
	if (conflicts.length) fail('检测到未完成安装且无法自动恢复：' + conflicts.join('；'));
	for (const action of [...(journal.updated || [])].reverse()) {
		const target = rel(action.target);
		if (!exists(target) || sha(read(target)) !== action.hash) continue;
		const backup = (journal.backups || []).find(item => item.target === action.target);
		if (backup) atomicWrite(target, read(path.join(targetRoot, ...backup.path.split('/'))));
		else fs.rmSync(target, { force: true });
	}
	for (const action of [...(journal.created || [])].reverse()) {
		const target = rel(action.target);
		if (exists(target)) fs.rmSync(target, { force: true });
	}
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
	try {
		for (const action of plan.creates) {
			const target = rel(action.targetRel);
			if (isBlocked(target)) fail('越界写入：' + action.targetRel);
			if (exists(target)) fail('写入前目标已出现，停止：' + action.targetRel);
			fs.mkdirSync(path.dirname(target), { recursive: true });
			journal.created.push({ target: action.targetRel, hash: action.hash, kind: action.kind });
			writeJournal();
			atomicWrite(target, action.bytes);
			tick();
		}
		if (plan.registry.mode === 'updated' || plan.registry.mode === 'created') {
			const target = rel('score/decision/skills/skillAIPolicyPacks.js');
			if (isBlocked(target)) fail('越界写入：score/decision/skills/skillAIPolicyPacks.js');
			fs.mkdirSync(path.dirname(target), { recursive: true });
			if (plan.registry.before ? (!exists(target) || sha(read(target)) !== sha(plan.registry.before)) : exists(target)) {
				fail('注册表在安装预检后发生变化，拒绝覆盖');
			}
			if (plan.registry.before) {
				journal.backups.push({ target: 'score/decision/skills/skillAIPolicyPacks.js', path: backupFile(backupDir, 'score/decision/skills/skillAIPolicyPacks.js', plan.registry.before) });
			}
			journal.updated.push({ target: 'score/decision/skills/skillAIPolicyPacks.js', hash: plan.registry.installedHash, beforeHash: plan.registry.before ? sha(plan.registry.before) : null, kind: '注册表' });
			writeJournal();
			if (process.env.DJSC_PACK_TEST_FAIL_REGISTRY === '1') throw new Error('DJSC_PACK_TEST_FAIL_REGISTRY injected failure before registry write');
			atomicWrite(target, plan.registry.after);
			tick();
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
		try { recoverIncomplete(backupDir); }
		catch (restoreError) { throw new Error((error.message || String(error)) + '\n恢复未完成，事务记录已保留：' + (restoreError.message || restoreError)); }
		throw error;
	}
}

try {
	const pending = path.join(targetRoot, '.djsc-pack-backups', pack.id);
	if (!dryRun && exists(pending) && !exists(path.join(pending, 'record.json'))) recoverIncomplete(pending);
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
