#!/usr/bin/env node
// 只读检查 client_policy_model_v2.js 的可达性：设置、降级、动态导入、业务 import、打包排除。
// 默认检查 release-444 工作区；传 --root 指向安装目录可复核“安装包缺失”版本。
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
const root = path.resolve(option('root') || fileURLToPath(new URL('../', import.meta.url)));
const expected = option('expect') || null;
const runtimeDirs = ['score', 'js', 'shadow', 'model', 'assets', 'css'];
const skipDirs = new Set(['.git', 'node_modules', 'dist', 'docs', 'artifacts', 'backend', 'tests', 'tools', 'logs', 'data', 'model']);
const runtimeFiles = ['extension.js', 'info.json'];

async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
async function listFiles(dir) {
	const result = [];
	const walk = async current => {
		for (const entry of await fs.readdir(current, { withFileTypes: true }).catch(() => [])) {
			if (entry.isDirectory()) { if (!skipDirs.has(entry.name)) await walk(path.join(current, entry.name)); }
			else if (/\.(m?js|json)$/.test(entry.name)) result.push(path.join(current, entry.name));
		}
	};
	await walk(dir);
	return result;
}
const files = [];
for (const file of runtimeFiles) if (await exists(path.join(root, file))) files.push(path.join(root, file));
for (const dir of runtimeDirs) if (await exists(path.join(root, dir))) files.push(...await listFiles(path.join(root, dir)));

const relative = file => path.relative(root, file).replaceAll('\\', '/');
const references = [];
const settingReferences = [];
for (const file of files) {
	const text = await fs.readFile(file, 'utf8').catch(() => '');
	const rel = relative(file);
	for (const [index, line] of text.split(/\r?\n/).entries()) {
		if (/policyModelV2|client_policy_model_v2/.test(line)) references.push({ file: rel, line: index + 1, text: line.trim().slice(0, 220) });
		if (/policyModelV2Mode|policyModelV2Shadow/.test(line)) settingReferences.push({ file: rel, line: index + 1, text: line.trim().slice(0, 220) });
	}
}
const runtimeReferences = references.filter(item => !item.file.endsWith('policyModelV2.js') && !item.text.startsWith('*') && !item.text.startsWith('//'));
const configSpec = path.join(root, 'score/foundation/config/configSpec.js');
const configText = await fs.readFile(configSpec, 'utf8').catch(() => '');
const configHasV2Mode = /policyModelV2Mode|policyModelV2Shadow/.test(configText);
const packageWorkflow = await fs.readFile(path.join(root, '.github/workflows/manual-package.yml'), 'utf8').catch(() => '');
const packageExcludesV2 = /client_policy_model_v2\.js/.test(packageWorkflow);
const docsBuilder = await fs.readFile(path.join(root, 'docs/performance/build-delivery.py'), 'utf8').catch(() => '');
const builderExcludesV2 = /client_policy_model_v2\.js/.test(docsBuilder);
const v2Weights = await exists(path.join(root, 'score/model/net/client_policy_model_v2.js'));
const v2Adapter = await exists(path.join(root, 'score/model/net/policyModelV2.js'));
const v3Weights = await exists(path.join(root, 'score/model/net/client_policy_model_v3.js'));
const v3Adapter = await exists(path.join(root, 'score/model/net/policyModelV3.js'));
const extensionText = await fs.readFile(path.join(root, 'extension.js'), 'utf8').catch(() => '');
const extensionImportsV2 = /policyModelV2|client_policy_model_v2/.test(extensionText);
const extensionImportsV3 = /policyModelV3/.test(extensionText);
const adapterText = await fs.readFile(path.join(root, 'score/model/net/policyModelV2.js'), 'utf8').catch(() => '');
const adapterDynamicTarget = (adapterText.match(/import\(['"]([^'"]*client_policy_model_v2[^'"]*)['"]\)/) || [])[1] || null;
const reachable = (v2Weights && v2Adapter && (runtimeReferences.length > 0 || extensionImportsV2));

const report = {
	checkedAt: new Date().toISOString(),
	root,
	expected,
	filesChecked: files.length,
	v2Weights,
	v2Adapter,
	v3Weights,
	v3Adapter,
	adapterDynamicTarget,
	extensionImportsV2,
	extensionImportsV3,
	runtimeReferences,
	settingReferences,
	configHasV2Mode,
	packageExcludesV2,
	builderExcludesV2,
	reachable,
	reason: reachable
		? 'v2 适配器被运行时引用且权重存在'
		: (v2Weights
			? 'v2 权重存在，但业务运行时无任何 import/require；只有 policyModelV2.js 内部的懒加载动态 import，未接线'
			: 'v2 权重文件缺失；即使安装 policyModelV2.js 适配层，其动态 import 也会失败；业务运行时无任何调用者'),
};
if (expected === 'absent') {
	if (v2Weights) report.warning = '期望缺失但权重存在';
}
if (expected === 'unreachable') {
	if (reachable) report.warning = '期望不可达但检测到运行时引用';
}
console.log(JSON.stringify(report, null, 2));
if (option('output')) await fs.writeFile(option('output'), JSON.stringify(report, null, 2) + '\n');
if (expected === 'absent' && v2Weights) process.exitCode = 1;
if (expected === 'unreachable' && reachable) process.exitCode = 1;
