#!/usr/bin/env node
/*
 * 神话雷历史技能专项四配置严格对比与断言。
 *
 *   N 未打补丁宿主、无扩展        宿主旧行为基线
 *   P 未打补丁宿主 + 正式扩展      扩展部署
 *   C 原生候选宿主、无扩展         原生部署
 *   D 原生候选宿主 + 正式扩展      隔离用（验证指纹跳过与防重复修正）
 *
 * 期望值不硬编码具体分数：箜声与父荫的期望由宿主 sync/filter 语义推导；
 * 谦节的期望由“只阻止横置、允许解除”规则推导。
 *
 * 用法：node tools/lei-history-compare.mjs <报告目录> [输出目录]
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.resolve(process.argv[2] || 'C:/Users/32360/AppData/Local/Temp/lei-accept-20261111');
const files = { N: 'N-lei-history.json', P: 'P-lei-history.json', C: 'C-lei-history.json', D: 'D-lei-history.json' };
const reports = {};
for (const [key, file] of Object.entries(files)) {
	const full = path.join(dir, file);
	if (!fs.existsSync(full)) throw new Error('缺少报告：' + full);
	reports[key] = JSON.parse(fs.readFileSync(full, 'utf8'));
}
const sceneOf = (report, name) => {
	const scene = report.scenes.find(item => item.name === name);
	assert.ok(scene, report.config.patchedHost + '/' + report.config.policyInstalled + ' 缺少场景 ' + name);
	return scene;
};
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const pass = (name, detail) => ({ name, passed: true, detail });

/* 决策等价性比较：只看会改变行为的字段，忽略随机角色名/时间戳。
 * viewInstalled 是“实现机制标记”（扩展用临时视图，原生补丁直接改源码），
 * 不属于决策结果，等价性比较必须排除，否则会把机制差异误判为行为差异。 */
const behaviorOf = (report, name) => {
	const scene = sceneOf(report, name);
	switch (name) {
		case 'kongsheng-count-threshold':
			return { scoreSelectedOne: scene.scoreSelectedOne, scoreSelectedZero: scene.scoreSelectedZero, viewInstalled: scene.viewInstalled, viewRestored: scene.viewRestored };
		case 'kongsheng-cost-error':
			return { threw: scene.threw, viewRestored: scene.viewRestored };
		case 'qianjie-tiesuo':
			return { effectNotLinked: scene.effectNotLinked ?? null, effectLinked: scene.effectLinked ?? null, noLinkTag: scene.noLinkTag, noLinkTagAfter: scene.noLinkTagAfter };
		case 'fuyin-history':
			return { firstSha: scene.firstSha?.value ?? null, firstJuedou: scene.firstJuedou?.value ?? null, secondSha: scene.secondSha?.value ?? null, secondJuedou: scene.secondJuedou?.value ?? null };
		case 'fuyin-current-event':
			return { consulted: scene.consulted, historyLength: scene.historyLength, currentEventInHistory: scene.currentEventInHistory, fixedCheckWouldMatch: scene.fixedCheckWouldMatch, legacyCheckWouldMatch: scene.legacyCheckWouldMatch, result: scene.result ?? null };
		default:
			return scene;
	}
};
const decisionOf = (report, name) => {
	const value = behaviorOf(report, name);
	if (name === 'kongsheng-count-threshold') { const { viewInstalled, ...rest } = value; return rest; }
	return value;
};
const SCENES = ['kongsheng-count-threshold', 'kongsheng-cost-error', 'qianjie-tiesuo', 'fuyin-history', 'fuyin-current-event'];
const matrixRows = [];

for (const [key, report] of Object.entries(reports)) {
	check(report.status === 'passed', key + ' 运行状态不是 passed');
	check(Array.isArray(report.errors) && report.errors.length === 0, key + ' 存在页面错误');
	check(report.installState.hasSkill === true, key + ' 宿主没有 drlt_zhengu');
	for (const scene of report.scenes) {
		if (scene.name === 'kongsheng-cost-error') continue; /* 该场景的 error 是夹具故意抛出 */
		check(!scene.error, key + '/' + scene.name + ' 场景抛错：' + (scene.error || '').slice(0, 160));
	}

	/* ---- 箜声 ---- */
	const kong = sceneOf(report, 'kongsheng-count-threshold');
	const kongErr = sceneOf(report, 'kongsheng-cost-error');
	check(kong.expansionsBefore === 1, key + '/kongsheng 扩展牌数不是 1');
	check(kong.expansionsAfter === 1, key + '/kongsheng 扩展牌数在 cost 后被改动');
	check(kongErr.threw === true, key + '/kongsheng 异常退出未抛出');
	check(kongErr.viewRestored === true, key + '/kongsheng 异常退出后临时视图未恢复');
	if (key === 'N') {
		check(kong.viewInstalled === false, 'N/kongsheng 不应有扩展临时视图');
		check(kong.scoreSelectedOne === kong.scoreSelectedZero, 'N/kongsheng 旧式评分应忽略已选牌数量（良姻阈值失真）');
	} else {
		check(kong.scoreSelectedOne === 0, key + '/kongsheng 已选 1 张时良姻阈值应命中（评分应为 0），实际 ' + kong.scoreSelectedOne);
		check(kong.scoreSelectedZero !== 0, key + '/kongsheng 未选牌时不应命中阈值分支');
	}
	if (key === 'P') check(kong.viewInstalled === true, 'P/kongsheng 未安装扩展临时视图');
	if (key === 'C' || key === 'D') check(kong.viewInstalled === false, key + '/kongsheng 原生部署不应安装扩展临时视图');
	check(kong.viewRestored === true, key + '/kongsheng cost 返回后临时视图未恢复');

	/* ---- 谦节 ---- */
	const qian = sceneOf(report, 'qianjie-tiesuo');
	check(qian.effectNotLinked === 'zeroplayertarget', key + '/qianjie 未横置目标应被阻止');
	check(qian.noLinkTag === true && qian.noLinkTagAfter === true, key + '/qianjie noLink 标签被改动');
	if (key === 'N') {
		check(qian.effectLinked === 'zeroplayertarget', 'N/qianjie 旧宿主应错误地阻止解除横置');
	} else {
		check(qian.effectLinked !== 'zeroplayertarget', key + '/qianjie 已横置目标应允许铁索解除，实际 ' + JSON.stringify(qian.effectLinked));
	}

	/* ---- 父荫 ---- */
	const fuyin = sceneOf(report, 'fuyin-history');
	const fuyinEvent = sceneOf(report, 'fuyin-current-event');
	check(Array.isArray(fuyin.firstSha?.value), key + '/fuyin 首次成为目标应得到评分数组，实际 ' + JSON.stringify(fuyin.firstSha));
	check(Array.isArray(fuyin.firstJuedou?.value), key + '/fuyin 决斗首次成为目标应得到评分数组，实际 ' + JSON.stringify(fuyin.firstJuedou));
	check(fuyin.historyBefore === 0 && fuyin.historyAfter === 1, key + '/fuyin 历史注入未生效');
	check(fuyinEvent.consulted === true, key + '/fuyin 真实出牌路径未咨询父荫 AI 入口');
	check(fuyinEvent.currentEventInHistory === false, key + '/fuyin 当前事件不应计入 useCard 历史');
	check(fuyinEvent.fixedCheckWouldMatch === false, key + '/fuyin 首次指定时修正判据不应命中');
	if (key === 'N') {
		check(fuyin.secondSha?.value !== 1 && fuyin.secondJuedou?.value !== 1, 'N/fuyin 旧宿主应错误地再次排除已被指定的玩家');
	} else {
		check(fuyin.secondSha?.value === 1, key + '/fuyin 再次成为目标时应返回 1（不再排除），实际 ' + JSON.stringify(fuyin.secondSha?.value));
		check(fuyin.secondJuedou?.value === 1, key + '/fuyin 决斗再次成为目标时应返回 1，实际 ' + JSON.stringify(fuyin.secondJuedou?.value));
	}

	/* ---- 技能台账 ---- */
	const ledger = sceneOf(report, 'skill-ledger-smoke');
	const before = JSON.stringify(ledger.snapshotBefore);
	const after = JSON.stringify(ledger.snapshotAfter);
	check(before === after, key + '/skill-ledger 安装前后技能入口形态发生变化');
	for (const [skill, info] of Object.entries(ledger.snapshotAfter || {})) {
		check(info.exists === true, key + '/skill-ledger 技能缺失：' + skill);
	}

	/* ---- 多分包生命周期 ---- */
	if (key === 'P' || key === 'D') {
		const life = sceneOf(report, 'multi-pack-lifecycle');
		check(life.error == null, key + '/multi-pack 抛错：' + (life.error || '').slice(0, 160));
		const packs = ['out_of_scope', 'refresh_standard', 'shenhua_lei', 'shenhua_feng', 'shenhua_huo'];
		for (const pack of packs) check((life.packsBefore || []).includes(pack), key + '/multi-pack 缺少分包 ' + pack);
		check((life.otherPacksAfterUninstall || []).length === 4, key + '/multi-pack 卸载本包后其他分包数量不是 4');
		check(!(life.otherPacksAfterUninstall || []).includes('shenhua_lei'), key + '/multi-pack 卸载本包后本包仍在注册表');
		check(life.stateAfterFullUninstall === 'not-installed', key + '/multi-pack 全量卸载后状态不是 not-installed');
		check(life.stateAfterFullReinstall === 'installed', key + '/multi-pack 全量重装后状态不是 installed');
		check(life.qianjieAfterFullReinstall === 'drlt_qianjie:effect', key + '/multi-pack 全量重装后谦节包装未恢复');
		if (key === 'P') {
			/* 扩展部署：箜声与父荫包装应在本包重装后恢复 */
			check(life.fuyinAfterFullReinstall === 'xinfu_fuyin:effect', 'P/multi-pack 全量重装后父荫包装未恢复');
			check(life.kongshengAfterFullReinstall === 'olkongsheng:cost', 'P/multi-pack 全量重装后箜声包装未恢复');
		} else {
			/* 原生部署：原生补丁已改写宿主源码，扩展按指纹让位，不应再包装 */
			check(life.fuyinAfterFullReinstall === null, 'D/multi-pack 原生补丁下父荫包装应让位于原生');
			check(life.kongshengAfterFullReinstall === null, 'D/multi-pack 原生补丁下箜声包装应让位于原生');
		}
	}
	if (key === 'P') {
		check(life0(report, 'hookBefore') === 'function', 'P/multi-pack 安装后缺少镇骨钩子');
		check(life0(report, 'hookAfterUninstall') === 'undefined', 'P/multi-pack 卸载分包后镇骨钩子仍在');
		check(life0(report, 'hookAfterReinstall') === 'function', 'P/multi-pack 重装分包后镇骨钩子未恢复');
		check(life0(report, 'hookAfterFullUninstall') === 'undefined', 'P/multi-pack 全量卸载后镇骨钩子仍在');
		check(life0(report, 'hookAfterFullReinstall') === 'function', 'P/multi-pack 全量重装后镇骨钩子未恢复');
	}
	if (key === 'D') {
		check(life0(report, 'hookBefore') === 'undefined', 'D/multi-pack 原生补丁下不应安装镇骨钩子');
		check(life0(report, 'kongshengBefore') === null, 'D/multi-pack 原生补丁下不应安装箜声包装');
		check(life0(report, 'fuyinBefore') === null, 'D/multi-pack 原生补丁下不应安装父荫包装');
		check(life0(report, 'qianjieBefore') === 'drlt_qianjie:effect', 'D/multi-pack 谦节包装状态异常');
		check(report.installState.stats?.packs?.shenhua_lei?.zhenguCompatible === false, 'D 应因原生候选跳过镇骨接线');
		check(report.installState.stats?.packs?.shenhua_lei?.olkongshengCompatible === false, 'D 应因原生候选跳过箜声接线');
	}
	if (key === 'P') {
		check(report.installState.stats?.packs?.shenhua_lei?.zhenguCompatible === true, 'P 应识别旧式评分并接线镇骨');
		check(report.installState.stats?.packs?.shenhua_lei?.olkongshengCompatible === true, 'P 应识别旧式箜声并接线');
	}
	for (const scene of SCENES) {
		matrixRows.push({ config: key, scene, behavior: behaviorOf(report, scene) });
	}
}
function life0(report, key) {
	const life = report.scenes.find(item => item.name === 'multi-pack-lifecycle');
	return life ? life[key] : undefined;
}

/* 决策等价性：扩展（扩展 P）与原生（C）必须逐项一致；原生+扩展（D）必须与 C 一致 */
for (const scene of SCENES) {
	const p = JSON.stringify(decisionOf(reports.P, scene));
	const c = JSON.stringify(decisionOf(reports.C, scene));
	const d = JSON.stringify(decisionOf(reports.D, scene));
	const n = JSON.stringify(decisionOf(reports.N, scene));
	check(p === c, 'P/' + scene + ' 与 C/' + scene + ' 行为不一致：' + p + ' vs ' + c);
	check(d === c, 'D/' + scene + ' 与 C/' + scene + ' 行为不一致：' + d + ' vs ' + c);
	matrixRows.push({ config: 'P==C', scene, behavior: 'identical' });
	matrixRows.push({ config: 'D==C', scene, behavior: 'identical' });
	matrixRows.push({ config: 'N!=P', scene, behavior: p === n ? 'same' : 'differs' });
}

if (failures.length) {
	console.error('COMPARE_FAILED');
	for (const item of failures) console.error(' - ' + item);
	process.exit(1);
}

const summary = {
	checkedConfigs: Object.keys(reports),
	checkedAt: new Date().toISOString(),
	assertions: '全部通过',
	matrix: matrixRows,
	conclusions: {
		extensionEqualsNative: SCENES.every(scene => JSON.stringify(decisionOf(reports.P, scene)) === JSON.stringify(decisionOf(reports.C, scene))),
		nativePlusExtensionEqualsNative: SCENES.every(scene => JSON.stringify(decisionOf(reports.D, scene)) === JSON.stringify(decisionOf(reports.C, scene))),
		hostBaselineDiffers: SCENES.filter(scene => JSON.stringify(decisionOf(reports.N, scene)) !== JSON.stringify(decisionOf(reports.P, scene))),
	},
};
const outDir = path.resolve(process.argv[3] || '.');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'lei-history-summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
const lines = ['| 配置 | 场景 | 行为 |', '| --- | --- | --- |'];
for (const row of matrixRows) {
	const value = typeof row.behavior === 'string' ? row.behavior : JSON.stringify(row.behavior);
	lines.push('| ' + [row.config, row.scene, value].join(' | ') + ' |');
}
fs.writeFileSync(path.join(outDir, 'lei-history-matrix.md'), lines.join('\n') + '\n', 'utf8');
console.log('COMPARE_OK');
console.log('extensionEqualsNative=' + summary.conclusions.extensionEqualsNative);
console.log('nativePlusExtensionEqualsNative=' + summary.conclusions.nativePlusExtensionEqualsNative);
console.log('hostBaselineDiffers=' + JSON.stringify(summary.conclusions.hostBaselineDiffers));
