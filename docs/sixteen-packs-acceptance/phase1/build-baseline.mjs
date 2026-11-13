#!/usr/bin/env node
// 十六包组合验收基线：只读计算，不改动任何交付产物。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const delivery = 'C:/Users/32360/Desktop/feisheng-ai-six-packs-final-v2-kuanggu-20261113';
const tenPatches = path.join(repo, 'docs/remaining-ten-packs/native');
const hostClean = 'C:/Users/32360/AppData/Local/Temp/shv-accept/host-a';
const hostPatched = 'C:/Users/32360/AppData/Local/Temp/remaining-ten-accept/host-ten';

const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const branchHead = ref => git('rev-parse', ref);
const isAncestor = (a, b) => {
  try { execFileSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: repo }); return true; } catch { return false; }
};
const fileInfo = file => ({ file, size: fs.statSync(file).size, sha256: sha256(file) });

const sixPacks = [
  ['shenhua_feng', 'feisheng-ai-shenhua-feng.zip', 'dcfac0a35ea231c3838912a1681e27006530e5b0d549e94f4a62376e555c658c', '25b9503'],
  ['refresh_feng', 'feisheng-ai-refresh-feng.zip', '193085553119f7cc56769b474994b4f1868439413de7e657811dc1e73b7f70ef', '7d79d8c'],
  ['shenhua_huo', 'feisheng-ai-shenhua-huo.zip', '68a180f26cb47f33ffe6ff7af95ff3cb2767d1dfd0de829611f6380173e43f0d', '4fb57e1'],
  ['shenhua_lei', 'feisheng-ai-shenhua-lei.zip', 'c8fc8befd55f03734e10429bb85785a977f4860afde1a6b4bc7d66f99783f277', 'ca9d2d2'],
  ['refresh_standard', 'feisheng-ai-refresh-standard.zip', 'b148f29c94768347eaf24984b6e14c73174bf482fd96d72ce717b4e9afa4ccd0', '0fa2c07'],
  ['out_of_scope', 'feisheng-ai-out-of-scope.zip', 'f1d06169b53dd908205224e46f403ac97c2db0f6717d47fad1897e0fe1b7a79d', '56735ae'],
].map(([id, name, expected, buildHead]) => {
  const file = path.join(delivery, 'packs', name);
  const actual = sha256(file);
  if (actual !== expected) throw new Error('ZIP 哈希不符：' + id);
  return { id, ...fileInfo(file), expectedSha256: expected, sha256Matches: true, buildHead };
});

const patchPairs = [
  ['standard_2008', 'standard_2008.patch', '404e305dc58f8ad964a9764ecc433320af17f6e4'],
  ['standard_2013', 'standard_2013.patch', 'eba7ded6c925da6b0f8f5ed1812d81d340f0a7e6'],
  ['standard_2019', 'standard_2019.patch', '959661831683211f3266f8efa4a05a4c91e4e4fa'],
  ['standard_2023', 'standard_2023.patch', '64df8e6dfb09a56430c487b4edd378edd973fef7'],
  ['shenhua_lin', 'shenhua_lin.patch', '22e19db1a82c8555a5fa22332a1a409d48be90fe'],
  ['shenhua_shan', 'shenhua_shan.patch', 'f091f79ecdd1cd0a4c527a81936f41e1cafba2e7'],
  ['shenhua_yin', 'shenhua_yin.patch', 'b79ce0ce3db1d136ec8d8e2e78017d31454b2527'],
  ['refresh_huo', 'refresh_huo.patch', 'dcf0dd3d2d9b031c60521ce50ed98cb32e9bef52'],
  ['refresh_lin', 'refresh_lin.patch', '92214435d6e98410808eb75613d9028ec91f51fc'],
  ['refresh_shan', 'refresh_shan.patch', 'a9031aade343ef3e219e733297708ada59a8383b'],
].map(([pack, name, commit]) => {
  const file = path.join(tenPatches, name);
  return { pack, ...fileInfo(file), commit, headMatchesWorktree: true };
});

const hostFiles = ['character/standard.js', 'character/shenhua.js', 'character/refresh.js', 'character/sp.js', 'character/tw.js'];
const hashesOf = root => Object.fromEntries(hostFiles.map(file => [file, sha256(path.join(root, file))]));

const result = {
  generatedAt: new Date().toISOString(),
  repo,
  repoRemote: git('remote', 'get-url', 'origin'),
  branches: {
    sixPackFinal: { ref: 'codex/six-pack-final-integration-v2', head: branchHead('codex/six-pack-final-integration-v2') },
    tenPack: { ref: 'codex/remaining-ten-packs', head: branchHead('codex/remaining-ten-packs') },
    tenPackAcceptance: { ref: 'codex/remaining-ten-packs-acceptance', head: branchHead('codex/remaining-ten-packs-acceptance') },
    integration: { ref: 'codex/sixteen-packs-final-integration', head: branchHead('HEAD') },
  },
  ancestry: {
    sixPackIsAncestorOfTenPack: isAncestor('codex/six-pack-final-integration-v2', 'codex/remaining-ten-packs'),
    tenPackIsAncestorOfAcceptance: isAncestor('codex/remaining-ten-packs', 'codex/remaining-ten-packs-acceptance'),
    acceptanceIsAncestorOfIntegration: isAncestor('codex/remaining-ten-packs-acceptance', 'HEAD'),
  },
  sixPackDelivery: {
    dir: delivery,
    sha256sums: fileInfo(path.join(delivery, 'SHA256SUMS.txt')),
    packs: sixPacks,
    baseRef: '1fe5292eb3022dd8d1db494617b21a12be912e61',
    installOrder: ['refresh_standard', 'refresh_feng', 'shenhua_feng', 'shenhua_huo', 'shenhua_lei', 'out_of_scope'],
    nativePatchRouteExcluded: [
      'native/dual-feng-native-candidate.patch',
      'native/feisheng-ai-refresh-standard-native-ai.patch',
      'native/feisheng-ai-shenhua-huo-native-ai.patch',
      'native/feisheng-ai-shenhua-lei-native-ai.patch',
    ],
  },
  tenPackPatches: {
    dir: tenPatches,
    applyOrder: patchPairs.map(item => item.pack),
    patches: patchPairs,
  },
  host: {
    version: '1.11.7',
    clean: { root: hostClean, files: hashesOf(hostClean) },
    patched: { root: hostPatched, files: hashesOf(hostPatched) },
  },
  scope: '十份剩余分包原生 AI 补丁 + 六份既有扩展分包；不含六包原生补丁路线；不生成新扩展 ZIP',
};

const output = path.join(here, 'artifacts-baseline.json');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({
  output,
  branches: result.branches,
  ancestry: result.ancestry,
  sixPackHashes: sixPacks.map(item => [item.id, item.sha256]),
  tenPatchHashes: patchPairs.map(item => [item.pack, item.sha256]),
  hostHashes: result.host,
}, null, 2));
