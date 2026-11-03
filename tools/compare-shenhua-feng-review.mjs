#!/usr/bin/env node
// 从两份真实宿主报告生成神话再临·风/火逐场景原生/扩展对照。
// 用法：node tools/compare-shenhua-feng-review.mjs native.json extension.json compare.json
import fs from 'node:fs';
import path from 'node:path';
import { compareNativeExtension } from './shenhua-feng-review-semantics.mjs';

const [nativeFile, extensionFile, outFile] = process.argv.slice(2);
if (!nativeFile || !extensionFile || !outFile) {
	console.error('usage: node tools/compare-shenhua-feng-review.mjs <native.json> <extension.json> <compare.json>');
	process.exit(2);
}
const native = JSON.parse(fs.readFileSync(nativeFile, 'utf8'));
const extension = JSON.parse(fs.readFileSync(extensionFile, 'utf8'));
const scenes = (native.scenes || [])
	.filter(scene => scene && scene.name && (
		scene.name.startsWith('shenhua-') || scene.name.startsWith('quality-') ||
		scene.name.startsWith('hp-qimou') || scene.name.startsWith('qimou-') ||
		scene.name.startsWith('hp-qiangxix')
	))
	.map(scene => scene.name);
const comparison = compareNativeExtension(native, extension, scenes);
const result = {
	schema_version: '1.0',
	generated_at: new Date().toISOString(),
	scope: '神话再临·风/火固定局面：原生 vs 完整扩展的逐场景决策/结算对照；对称目标座位与随机摸牌单列为允许差异',
	sources: {
		native: path.basename(nativeFile),
		extension: path.basename(extensionFile),
	},
	...comparison,
};
fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(result, null, 2) + '\n');
console.log('wrote ' + outFile + ' rows=' + comparison.rows.length + ' semantic_all=' + comparison.semantic_all + ' exact_all=' + comparison.exact_all);
if (!comparison.semantic_all) process.exit(1);
