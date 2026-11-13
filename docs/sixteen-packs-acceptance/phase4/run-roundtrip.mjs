#!/usr/bin/env node
// 只读宿主副本上的十补丁累计应用/逆序撤销；验证字节恢复与扩展目录不被触碰。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const hostClean = 'C:/Users/32360/AppData/Local/Temp/shv-accept/host-a';
const extRoot = 'C:/Users/32360/AppData/Local/Temp/sixteen-pack-acceptance/phase3-native-under-extension/extension';
const work = 'C:/Users/32360/AppData/Local/Temp/sixteen-pack-acceptance/phase4-roundtrip-auto';
const patches = [
  'standard_2008', 'standard_2013', 'standard_2019', 'standard_2023',
  'shenhua_lin', 'shenhua_shan', 'shenhua_yin', 'refresh_huo', 'refresh_lin', 'refresh_shan',
].map(pack => ({ pack, file: path.join(repo, 'docs/remaining-ten-packs/native', pack + '.patch') }));
const hostFiles = ['standard.js', 'shenhua.js', 'refresh.js', 'sp.js', 'tw.js'];
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hashes = () => Object.fromEntries(hostFiles.map(file => [file, sha256(path.join(work, 'character', file))]));
const gitApply = args => execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: work, encoding: 'utf8' });
const treeHash = root => {
  const rows = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) rows.push(path.relative(root, full).replace(/\\/g, '/') + '\0' + sha256(full));
    }
  };
  walk(root);
  rows.sort();
  return crypto.createHash('sha256').update(rows.join('\n')).digest('hex');
};
const expectedClean = {
  'standard.js': '2b033c6e832fbfa72f477bf65739f63d5f9c986fe4b93c61c8d12b9a3b06bf63',
  'shenhua.js': '62f789e336a11a0613c68f3309ebc81640f53b4baf6c07cacde99992284e813e',
  'refresh.js': '25c573b2c86baad3d3dc75cbb535794d4c27b6b22b52055a914bca1f2ddbd0e0',
  'sp.js': 'f533db6e050937c406153b73deb51bd2b94ca5b1b868c3b0764956a0b66284ea',
  'tw.js': '356ab5d74342073f891981fce7014e76d1c59a3ebf2da35315a1f222baf3cb20',
};
const expectedPatched = {
  'standard.js': '614be8c1ee9bcf82e37477ab9a09f1e781dbe2f32c77aa9725446e1689bc9b48',
  'shenhua.js': '7b7bb42574cbe06283505e7417217af8e6691aee4f1d824ae61ca6cd28d3a3ed',
  'refresh.js': '73fd1f6c1ee90bb6a6e35591249415dd4f23f51fd38864c9d01c9471735e3e01',
  'sp.js': '8386e05b611762321acf1730e1387231bb947fae32884335acbd975c8a654e2f',
  'tw.js': '356ab5d74342073f891981fce7014e76d1c59a3ebf2da35315a1f222baf3cb20',
};

const result = { generatedAt: new Date().toISOString(), hostSource: hostClean, applied: [], reversed: [], checks: {} };
try {
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(path.join(work, 'character'), { recursive: true });
  for (const file of hostFiles) fs.copyFileSync(path.join(hostClean, 'character', file), path.join(work, 'character', file));
  result.cleanHashes = hashes();
  result.checks.cleanMatches = JSON.stringify(result.cleanHashes) === JSON.stringify(expectedClean);
  if (!result.checks.cleanMatches) throw new Error('干净副本哈希不符');
  result.extensionTreeBefore = treeHash(path.join(extRoot, 'score/decision/skills'));

  for (const item of patches) {
    gitApply(['apply', '--check', item.file]);
    gitApply(['apply', item.file]);
    result.applied.push(item.pack);
  }
  result.patchedHashes = hashes();
  result.checks.patchedMatches = JSON.stringify(result.patchedHashes) === JSON.stringify(expectedPatched);
  if (!result.checks.patchedMatches) throw new Error('累计补丁哈希不符');
  result.checks.syntax = Object.fromEntries(['standard.js', 'shenhua.js', 'refresh.js', 'sp.js'].map(file => {
    execFileSync(process.execPath, ['--check', path.join(work, 'character', file)], { stdio: 'pipe' });
    return [file, 'ok'];
  }));

  const beforeDuplicate = sha256(path.join(work, 'character', 'standard.js'));
  let duplicateRejected = false;
  try { gitApply(['apply', '--check', patches[0].file]); }
  catch { duplicateRejected = true; }
  result.checks.duplicateApplyRejected = duplicateRejected;
  result.checks.duplicateLeftFileUnchanged = sha256(path.join(work, 'character', 'standard.js')) === beforeDuplicate;
  if (!duplicateRejected || !result.checks.duplicateLeftFileUnchanged) throw new Error('重复应用未安全拒绝');

  for (const item of [...patches].reverse()) {
    gitApply(['apply', '-R', '--check', item.file]);
    gitApply(['apply', '-R', item.file]);
    result.reversed.push(item.pack);
  }
  result.restoredHashes = hashes();
  result.checks.restoredMatches = JSON.stringify(result.restoredHashes) === JSON.stringify(expectedClean);
  if (!result.checks.restoredMatches) throw new Error('逆序撤销未恢复原始字节');
  result.extensionTreeAfter = treeHash(path.join(extRoot, 'score/decision/skills'));
  result.checks.extensionUntouched = result.extensionTreeBefore === result.extensionTreeAfter;
  if (!result.checks.extensionUntouched) throw new Error('补丁撤销改动了扩展目录');
  result.status = 'passed';
} catch (error) {
  result.status = 'failed';
  result.error = String(error?.stack || error);
}
fs.writeFileSync(path.join(here, 'patch-roundtrip.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'passed') process.exit(1);
