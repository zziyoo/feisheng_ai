#!/usr/bin/env node
// 汇总本轮真实宿主证据：六包签名对照、十包原生场景对照、边界场景对照。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const temp = 'C:/Users/32360/AppData/Local/Temp/sixteen-pack-acceptance';
const sixBaseline = 'C:/Users/32360/.codex/worktrees/six-pack-final-integration-v2/evidence/accept-six-new-feng.json';
const sixCombined = path.join(temp, 'phase3-six-on-ten/final/accept-six-on-ten.json');
const nativePatched = path.join(temp, 'phase3-native-under-extension/native-ten-pack-scenes-patched.json');
const nativeExtension = path.join(temp, 'phase3-native-under-extension/native-ten-pack-scenes-extension.json');
const edgePatched = path.join(repo, 'docs/remaining-ten-packs-acceptance/host/evidence/edge-patched.json');
const edgeExtension = path.join(temp, 'phase3-native-under-extension/native-edge-extension.json');

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const names = (targets) => (targets || []).map(item => String(item).split(':')[1] || String(item));

const baseline = read(sixBaseline);
const combined = read(sixCombined);
const sixRows = Object.keys(baseline.skillChecks || {}).map(pack => {
  const expected = baseline.skillChecks[pack]?.signature;
  const actual = combined.skillChecks?.[pack]?.signature;
  return { pack, same: JSON.stringify(expected) === JSON.stringify(actual), baseline: expected, combined: actual };
});
const sixCompare = {
  generatedAt: new Date().toISOString(),
  baseline: sixBaseline,
  combined: sixCombined,
  allMatch: sixRows.every(row => row.same),
  rows: sixRows,
};
fs.writeFileSync(path.join(here, 'six-pack-signature-compare.json'), JSON.stringify(sixCompare, null, 2) + '\n');

const a = read(nativePatched);
const b = read(nativeExtension);
const scene = (report, name) => (report.scenes || []).find(item => item.name === name);
const deterministic = [
  ['dimeng-friendly', s => s.result],
  ['luanwu-no-zhu', s => s.result],
  ['tieji-roulin-tags', s => [s.tieji?.directHit_ai, s.tieji?.skillTagFilter, s.roulin?.directHit_ai, s.roulin?.skillTagFilter, s.roulin?.halfneg]],
  ['oljieming-maxhp', s => s.result],
  ['shenzhi-check', s => [s.full, s.damaged]],
  ['xinfu-jiyuan-check', s => [s.recover, s.dying, s.tag]],
  ['oldimeng-public', s => s.result],
  ['zhiba-hidden', s => [s.olzhiba2, s.zhibaGlobal, s.known, s.targetHand]],
  ['retongji-hidden', s => s.check],
  ['yiji-nogain', s => (s.choices || []).map(choice => names(choice.targets))],
  ['xinfu-jijie-nogain', s => (s.choices || []).map(choice => names(choice.targets))],
  ['stdshushen-nogain', s => s.result],
  ['stdxiaoguo-eff', s => s.eff],
  ['kuizhu-target', s => names(s.chosen)],
  ['mingren-samecolor', s => s.chosen],
  ['ui-identity', s => [s.realUi, s.windowUiExists, s.libUiSame, s.beforeLen, s.afterLen]],
];
const nativeRows = deterministic.map(([name, pick]) => {
  const left = scene(a, name), right = scene(b, name);
  const expected = left ? pick(left) : 'MISSING';
  const actual = right ? pick(right) : 'MISSING';
  return { name, same: JSON.stringify(expected) === JSON.stringify(actual), patched: expected, extension: actual };
});
const tuntianLeft = scene(a, 'tuntian-viewer'), tuntianRight = scene(b, 'tuntian-viewer');
const nativeCompare = {
  generatedAt: new Date().toISOString(),
  patched: nativePatched,
  extension: nativeExtension,
  allDeterministicMatch: nativeRows.every(row => row.same),
  rows: nativeRows,
  stochastic: [{
    name: 'tuntian-viewer',
    patched: [tuntianLeft?.mayActor, tuntianLeft?.mayAlly, tuntianLeft?.score],
    extension: [tuntianRight?.mayActor, tuntianRight?.mayAlly, tuntianRight?.score],
    note: '该场景的 mayHaveShan 为宿主随机估计；扩展引擎改变 RNG 消耗后估计翻转，不代表读取隐藏牌面。受控隐藏牌场景 edge-tuntian-hidden 两边一致。',
  }],
};
fs.writeFileSync(path.join(here, 'native-scene-compare.json'), JSON.stringify(nativeCompare, null, 2) + '\n');

const p = read(edgePatched);
const e = read(edgeExtension);
const edgeFields = [
  ['edge-dimeng-direct-empty', s => [s.result, s.emptyBranchResult, s.emptyBranchOk]],
  ['edge-dimeng-event-empty', s => [s.result?.bool, s.result?.targets?.length, s.ok]],
  ['edge-dimeng-legal-event', s => [s.result?.bool, names(s.result?.targets), s.ok]],
  ['edge-tuntian-hidden', s => [s.caseShaTao?.juedou, s.caseShaSha?.juedou, s.caseShanTao?.juedou, s.caseShaTao?.knownByActor, s.caseShaTao?.knownByViewer, s.caseShaSha?.knownByActor, s.caseShaSha?.knownByViewer]],
  ['edge-olhaoshi-give', s => [s.ai1, s.ai1Card, names(s.chosenTarget), s.chosenCards]],
  ['edge-olhaoshi-help', s => [s.aiShan, s.aiTao, s.result?.bool]],
  ['edge-rehuashen-legal', s => (s.cycles || []).map(cycle => [cycle.triggername, cycle.costResult?.cost_data, (cycle.controls || []).map(control => control.cond)])],
  ['edge-rehuashen-empty', s => [s.result?.bool, s.result?.cost_data, s.ok]],
  ['edge-qizhi-protected-only', s => [s.costResult?.bool, s.afterTarget?.hand?.length, s.ok]],
  ['edge-reqiaobian-context', s => s.cases],
  ['edge-feijun-postpay', s => [s.storage, s.binglveMarker, s.afterActorHand, s.afterEnemyHand]],
  ['edge-feijun-no-target', s => [s.filter, s.storage, s.afterActorHand]],
];
const edgeRows = edgeFields.map(([name, pick]) => {
  const left = scene(p, name), right = scene(e, name);
  const expected = left ? pick(left) : 'MISSING';
  const actual = right ? pick(right) : 'MISSING';
  return { name, same: JSON.stringify(expected) === JSON.stringify(actual), patched: expected, extension: actual };
});
const edgeCompare = {
  generatedAt: new Date().toISOString(),
  patched: edgePatched,
  extension: edgeExtension,
  allMatch: edgeRows.every(row => row.same),
  rows: edgeRows,
  stochastic: [{
    name: 'edge-tuntian-hidden',
    patchedRaw: [scene(p, 'edge-tuntian-hidden')?.caseShaTao?.sha, scene(p, 'edge-tuntian-hidden')?.caseShaSha?.sha, scene(p, 'edge-tuntian-hidden')?.caseShanTao?.sha],
    extensionRaw: [scene(e, 'edge-tuntian-hidden')?.caseShaTao?.sha, scene(e, 'edge-tuntian-hidden')?.caseShaSha?.sha, scene(e, 'edge-tuntian-hidden')?.caseShanTao?.sha],
    note: 'juedou 目标收益在隐藏牌置换下稳定，known 计数为 0；sha 使用评分含宿主 mayHaveShan 随机估计，跨进程 RNG 状态不同会变化，不构成隐藏牌面读取。',
  }],
};
fs.writeFileSync(path.join(here, 'edge-scene-compare.json'), JSON.stringify(edgeCompare, null, 2) + '\n');

console.log(JSON.stringify({
  sixPackAllMatch: sixCompare.allMatch,
  nativeDeterministicAllMatch: nativeCompare.allDeterministicMatch,
  nativeRows: nativeCompare.rows.map(row => [row.name, row.same]),
  edgeAllMatch: edgeCompare.allMatch,
  edgeRows: edgeCompare.rows.map(row => [row.name, row.same]),
}, null, 2));
