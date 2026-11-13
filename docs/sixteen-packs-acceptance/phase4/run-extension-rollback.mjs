#!/usr/bin/env node
// 六包扩展逆序回滚/按正式顺序重装；只读宿主哈希，验证扩展操作不触碰原生补丁文件。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const phase3 = 'C:/Users/32360/AppData/Local/Temp/sixteen-pack-acceptance/phase3-native-under-extension';
const host = 'C:/Users/32360/AppData/Local/Temp/remaining-ten-accept/host-ten';
const ext = path.join(phase3, 'extension');
const extract = path.join(phase3, 'extract');
const packs = [
  ['refresh_standard', 'feisheng-ai-refresh-standard'],
  ['refresh_feng', 'feisheng-ai-refresh-feng'],
  ['shenhua_feng', 'feisheng-ai-shenhua-feng'],
  ['shenhua_huo', 'feisheng-ai-shenhua-huo'],
  ['shenhua_lei', 'feisheng-ai-shenhua-lei'],
  ['out_of_scope', 'feisheng-ai-out-of-scope'],
];
const hostFiles = ['standard.js', 'shenhua.js', 'refresh.js', 'sp.js', 'tw.js'];
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hostHashes = () => Object.fromEntries(hostFiles.map(file => [file, sha256(path.join(host, 'character', file))]));
const registryFile = path.join(ext, 'score/decision/skills/skillAIPolicyPacks.js');
const registryImports = () => (fs.readFileSync(registryFile, 'utf8').match(/from '\.\/packs\//g) || []).length;
const coreHashes = () => Object.fromEntries(['policyCore.js', 'skillAIPolicies.js', 'skillVetoRegistry.js', 'skillPlanHints.js'].map(file => [file, sha256(path.join(ext, 'score/decision/skills', file))]));
const runInstaller = (dir, script, packDir) => {
  const output = execFileSync(process.execPath, [path.join(extract, packDir, 'integration', script), '--extension-root', ext], { encoding: 'utf8' });
  try { return JSON.parse(output); } catch { return { raw: output }; }
};
const expectedCore = {
  'policyCore.js': '545ee71d2b0affee2cbf561f16cd0ff30db07b170353ccc018db47e1fba49b19',
  'skillAIPolicies.js': '46b47ef904eaf7ae56a818816ecc042c351747b5a69594f1ce4b938af4aa42ad',
  'skillVetoRegistry.js': 'ed8f6022db879b133447077cf712bad9e955fae2ebdf27fd14d38680c997aac2',
  'skillPlanHints.js': 'b6a0db923a46da1d3d1b0c347db3f2fdbece9853035d2b5a0609b51ea9ac2d5e',
};

const result = { generatedAt: new Date().toISOString(), host, extension: ext, before: {}, rollback: [], reinstall: [], checks: {} };
try {
  result.before.hostHashes = hostHashes();
  result.before.registryImports = registryImports();
  result.before.coreHashes = coreHashes();
  result.checks.beforeSixImports = result.before.registryImports === 6;
  result.checks.beforeCoreMatches = JSON.stringify(result.before.coreHashes) === JSON.stringify(expectedCore);

  for (const [id, dir] of [...packs].reverse()) {
    const output = runInstaller(dir, 'rollback-pack.mjs', dir);
    result.rollback.push({ pack: id, status: output.status, registry: output.registry, files: output.files });
    result.checks['rollback_' + id] = output.status === 'rolled-back';
  }
  result.afterRollback = { hostHashes: hostHashes(), registryImports: registryImports(), coreHashes: coreHashes() };
  result.checks.rollbackHostUntouched = JSON.stringify(result.afterRollback.hostHashes) === JSON.stringify(result.before.hostHashes);
  result.checks.rollbackRegistryEmpty = result.afterRollback.registryImports === 0;
  result.checks.rollbackCoreRetained = JSON.stringify(result.afterRollback.coreHashes) === JSON.stringify(expectedCore);

  for (const [id, dir] of packs) {
    const output = runInstaller(dir, 'apply-pack.mjs', dir);
    result.reinstall.push({ pack: id, status: output.status, registry: output.registry });
    result.checks['reinstall_' + id] = output.status === 'applied';
  }
  result.afterReinstall = { hostHashes: hostHashes(), registryImports: registryImports(), coreHashes: coreHashes() };
  result.checks.reinstallHostUntouched = JSON.stringify(result.afterReinstall.hostHashes) === JSON.stringify(result.before.hostHashes);
  result.checks.reinstallSixImports = result.afterReinstall.registryImports === 6;
  result.checks.reinstallCoreMatches = JSON.stringify(result.afterReinstall.coreHashes) === JSON.stringify(expectedCore);

  result.status = Object.values(result.checks).every(Boolean) ? 'passed' : 'failed';
  if (result.status !== 'passed') throw new Error('存在未通过的检查：' + JSON.stringify(result.checks));
} catch (error) {
  result.status = 'failed';
  result.error = String(error?.stack || error);
}
fs.writeFileSync(path.join(here, 'extension-rollback-reinstall.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'passed') process.exit(1);
