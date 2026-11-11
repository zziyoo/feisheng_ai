#!/usr/bin/env node
/*
 * 汇总四份真实宿主报告并做严格对比：
 *   A 无补丁宿主、无技能策略
 *   B 无补丁宿主、试验技能策略
 *   C 原生候选宿主、无技能策略
 *   D 原生候选宿主、试验技能策略
 * 期望值全部由宿主 sync 的真实即时变化推导，不硬编码具体分数。
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = process.argv[2] || 'C:/Users/32360/AppData/Local/Temp/zhengu-experiment';
const files = {
	A: 'unpatched-baseline.json',
	B: 'unpatched-policy.json',
	C: 'patched-native.json',
	D: 'patched-policy.json',
};
const resolveReport = (key, file) => {
	const candidates = [path.join(dir, key + '-' + file), path.join(dir, file)];
	for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
	throw new Error('缺少报告：' + candidates.join(' 或 '));
};
const reports = {};
for (const [key, file] of Object.entries(files)) {
	reports[key] = JSON.parse(fs.readFileSync(resolveReport(key, file), 'utf8'));
}

const fixedDelta = (own, target) => (own < target ? own - target : Math.min(5, own) - Math.min(5, target));
const oldEstimate = (own, target) => Math.min(5, own) - target;
const sceneOf = (report, name) => {
	const scene = report.scenes.find(item => item.name === name);
	assert.ok(scene, report.config.patchedHost + '/' + report.config.policyInstalled + ' 缺少场景 ' + name);
	return scene;
};
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const matrixNames = ['710e', '608e', '301e', '305e', '710a', '608a', '301a', '305a'];
const matrixRows = [];

for (const [key, report] of Object.entries(reports)) {
	check(report.status === 'passed', key + ' 运行状态不是 passed');
	check(Array.isArray(report.errors) && report.errors.length === 0, key + ' 存在页面错误');
	check(report.installState.hasSkill === true, key + ' 宿主没有 drlt_zhengu');
	const expected = {
		A: { patched: false, policy: false, hook: false },
		B: { patched: false, policy: true, hook: true },
		C: { patched: true, policy: false, hook: false },
		D: { patched: true, policy: true, hook: false },
	}[key];
	check(report.config.patchedHost === expected.patched, key + ' patchedHost 不符');
	check(report.config.policyInstalled === expected.policy, key + ' policyInstalled 不符');
	check(report.installState.onChooseTarget === expected.hook, key + ' onChooseTarget 存在性与预期不符');
	if (key === 'C' || key === 'D') check(report.installState.costHasNativeFormula === true, key + ' 未检测到原生候选公式');
	else check(report.installState.costHasOldFormula === true, key + ' 未检测到宿主旧式公式');
	if (key === 'D') {
		check(report.installState.stats?.packs?.shenhua_lei?.zhenguCompatible === false, 'D 应因原生候选跳过扩展接线');
	}
	if (key === 'B') {
		check(report.installState.stats?.packs?.shenhua_lei?.zhenguCompatible === true, 'B 应识别旧式评分并接线');
		check(report.installState.stats?.packs?.shenhua_lei?.zhenguEngineHook === true, 'B 应检测到宿主 onChooseTarget 引擎钩子');
		for (const packId of ['out_of_scope', 'refresh_standard', 'shenhua_lei', 'shenhua_feng', 'shenhua_huo']) {
			check(!!report.installState.stats?.packs?.[packId], 'B 缺少分包 ' + packId);
		}
	}

	for (const name of matrixNames) {
		const scene = sceneOf(report, name);
		const useOld = key === 'A';
		const predicted = (useOld ? oldEstimate(scene.own, scene.target) : fixedDelta(scene.own, scene.target)) * scene.attitude;
		check(Math.abs(scene.targetScore - predicted) < 1e-9, key + '/' + name + ' 评分 ' + scene.targetScore + ' != ' + predicted);
		check(scene.choice?.bool === (predicted > 0), key + '/' + name + ' 发动决策与评分符号不一致');
		check(scene.markAfterCost === scene.choice?.bool, key + '/' + name + ' 标记与发动决策不一致');
		const expectedDelta = scene.choice?.bool ? fixedDelta(scene.own, scene.target) : 0;
		check(scene.firstDelta === expectedDelta, key + '/' + name + ' 实际手牌变化 ' + scene.firstDelta + ' != ' + expectedDelta);
		check(scene.costEvents === 1, key + '/' + name + ' 镇骨 cost 内 chooseTarget 次数不是1');
		check(scene.costSnapshot?.selectTarget?.[0] === 1 && scene.costSnapshot?.selectTarget?.[1] === 1, key + '/' + name + ' selectTarget 被改动');
		check(scene.costSnapshot?.forced === false, key + '/' + name + ' forced 被改动');
		check(scene.costSnapshot?.filterTargetType === 'function', key + '/' + name + ' filterTarget 被改动');
		check(typeof scene.costSnapshot?.prompt === 'string' && scene.costSnapshot.prompt.includes('镇骨'), key + '/' + name + ' prompt 被改动');
		check(scene.aiThrew == null, key + '/' + name + ' AI 回调抛错');
		matrixRows.push({
			config: key,
			scene: name,
			own: scene.own,
			target: scene.target,
			attitude: scene.attitude,
			score: scene.targetScore,
			activated: !!scene.choice?.bool,
			delta: scene.firstDelta,
			formula: useOld ? 'host-old' : 'sync-fixed',
		});
	}

	const mixed = sceneOf(report, '710-mixed');
	const positive = mixed.scores.filter(item => item.score > 0);
	if (key === 'A') {
		check(mixed.choice?.bool === true, 'A/710-mixed 宿主旧式应错误发动');
		check(positive.length === 1, 'A/710-mixed 应只有一个正收益候选');
		check(Math.abs(positive[0].score - oldEstimate(7, 6) * mixed.attitudeEnemy) < 1e-9, 'A/710-mixed 敌方候选分数不符');
	} else {
		check(mixed.choice?.bool === false, key + '/710-mixed 修正后不应发动');
		check(positive.length === 0, key + '/710-mixed 修正后不应有正收益候选');
	}

	const two = sceneOf(report, 'two-users');
	if (key === 'A') {
		check(two.actorChoice?.bool === true && two.allyChoice?.bool === true, 'A/two-users 两个镇骨都应被旧评分误发动');
		check(two.actorMark.length === 1 && two.allyMark.length === 1, 'A/two-users 标记数不符');
	} else {
		check(two.actorChoice?.bool === false && two.allyChoice?.bool === false, key + '/two-users 修正后都不应发动');
		check(two.actorMark.length === 0 && two.allyMark.length === 0, key + '/two-users 不应留下标记');
	}

	const retry = sceneOf(report, 'cancel-retry');
	check(retry.firstChoice?.bool === false, key + '/cancel-retry 7/6友方不应发动');
	check(retry.firstMark === false, key + '/cancel-retry 取消后不应留下标记');
	check(JSON.stringify(retry.firstHandsAfterEnd) === JSON.stringify(retry.firstHands), key + '/cancel-retry 取消后 phaseEnd 不应结算');
	check(retry.secondChoice?.bool === true, key + '/cancel-retry 取消后再次触发应正常发动');
	check(retry.secondDelta === 2 && retry.secondMark === true, key + '/cancel-retry 再次触发结算不符');

	const second = sceneOf(report, 'second-sync');
	check(second.choice?.bool === true, key + '/second-sync 3/1 友方应发动');
	check(second.handsAfterFirst[second.targetId] === 3, key + '/second-sync 首次同步应摸至3');
	check(second.handsBeforeSecond[second.actorId] === 5, key + '/second-sync 第二次同步前自己应为5');
	check(second.handsAfterSecond[second.choice.targets[0].split(':')[0]] === 5, key + '/second-sync 第二次同步应摸至5');
	check(second.markAfterSecond === false && second.markSkillAfterSecond === false, key + '/second-sync 第二次同步后标记应移除');
	check(JSON.stringify(second.handsAfterThird) === JSON.stringify(second.handsAfterSecond), key + '/second-sync 第三次结束不应再变化');

	const foreign = sceneOf(report, 'foreign-choice-target');
	check(foreign.events === 1, key + '/foreign 应只观察到1个外部选择');
	check(foreign.scores.length > 0 && foreign.scores.every(item => item.score === 0.125), key + '/foreign 外部技能评分被改动');
	check(foreign.choice?.bool === true, key + '/foreign 外部选择不应被取消');

	const multi = sceneOf(report, 'same-event-multi-choice');
	check(multi.events === 2, key + '/multi 应观察到2次选择');
	if (key === 'B') {
		check(multi.scores.every(item => !item.scores.every(score => score.score === 0.25 || score.score === 0.5)), 'B/multi 两次选择都未被镇骨接管');
	} else {
		check(multi.scores[0].scores.every(item => item.score === 0.25), key + '/multi 第一次选择被意外改动');
		check(multi.scores[1].scores.every(item => item.score === 0.5), key + '/multi 第二次选择被意外改动');
	}

	const external = sceneOf(report, 'external-chooseTarget-wrapper');
	check(external.externalHits === 1 && external.externalMarker === true, key + '/external 外部 chooseTarget 包装未保留');
	if (key === 'A') check(external.choice?.bool === true, 'A/external 旧评分应发动');
	else check(external.choice?.bool === false, key + '/external 修正后不应发动');

	if (report.config.policyInstalled) {
	const lifecycle = sceneOf(report, 'lifecycle');
	if (key === 'B') {
		check(lifecycle.error == null, 'B/lifecycle 抛错');
		check(lifecycle.hookAfterInstall === 'function', 'B/lifecycle 安装后缺少钩子');
		check(lifecycle.hookAfterPackUninstall === 'undefined', 'B/lifecycle 卸载分包后仍有钩子');
		check(lifecycle.hookAfterPackReinstall === 'function', 'B/lifecycle 重装分包后缺少钩子');
		check(lifecycle.externalKeptOnUninstall === true, 'B/lifecycle 卸载覆盖了外部钩子');
		check(lifecycle.hookAfterFullUninstall === 'undefined', 'B/lifecycle 全量卸载后仍有钩子');
		check(lifecycle.olkongshengAfterFullUninstall === false, 'B/lifecycle 箜声包装未恢复');
		check(lifecycle.hookAfterFullReinstall === 'function', 'B/lifecycle 全量重装后缺少钩子');
		check(lifecycle.olkongshengAfterFullReinstall === 'olkongsheng:cost', 'B/lifecycle 箜声包装未重装');
		check(lifecycle.fuyinAfterFullReinstall === 'xinfu_fuyin:effect', 'B/lifecycle 父荫包装未重装');
		check(lifecycle.qianjieAfterFullReinstall === 'drlt_qianjie:effect', 'B/lifecycle 谦节包装未重装');
		check(lifecycle.installedRun.choice?.bool === false, 'B/lifecycle 安装态应取消7/6敌方');
		check(lifecycle.uninstalledRun.choice?.bool === true, 'B/lifecycle 卸载后应回落到宿主旧行为');
		check(lifecycle.reinstalledRun.choice?.bool === false, 'B/lifecycle 分包重装后应取消7/6敌方');
		check(lifecycle.fullReinstalledRun.choice?.bool === false, 'B/lifecycle 全量重装后应取消7/6敌方');
		check(lifecycle.statsAfterFullReinstall?.installation?.state === 'installed', 'B/lifecycle 全量重装未安装');
	} else if (key === 'D') {
		check(lifecycle.error == null, 'D/lifecycle 抛错');
		check(lifecycle.hookAfterInstall === 'undefined', 'D/lifecycle 原生补丁下不应安装钩子');
		check(lifecycle.externalKeptOnUninstall === true, 'D/lifecycle 卸载覆盖了外部钩子');
	}
	if (report.config.policyInstalled) {
		const exception = sceneOf(report, 'ai-callback-exception');
		if (key === 'B') {
			check(exception.hookType === 'function', 'B/exception 缺少钩子');
			check(exception.originalCalls === 1 && exception.value === 7 && exception.thrown === null, 'B/exception 未回退到宿主回调');
		} else {
			check(exception.skipped === 'no-hook', 'D/exception 应跳过（无钩子）');
		}
		/* 第三方钩子冲突：安装前被占用 / 安装后被替换 */
		const pre = report.scenes.find(item => item.name === 'hook-conflict-preinstall');
		const post = report.scenes.find(item => item.name === 'hook-conflict-postinstall');
		if (key === 'B') {
			check(pre && !pre.error, 'B/conflict 缺少或失败的安装前冲突场景');
			check(post && !post.error, 'B/conflict 缺少或失败的安装后冲突场景');
			if (pre) {
				check(pre.hookIsExternal === true, 'B/conflict 安装前外部钩子应被保留');
				check(pre.conflictCounter === 1, 'B/conflict 应记录钩子冲突计数 1，实际 ' + pre.conflictCounter);
				check(pre.externalKeptOnUninstall === true, 'B/conflict 卸载不得删除外部钩子');
				check(pre.hookStillExternal === false, 'B/conflict 移除外部钩子后重装应换回本包钩子');
				check(pre.restored === 'function', 'B/conflict 恢复安装后应重新装上本包钩子');
				check(pre.run?.choice?.bool === true, 'B/conflict 被占用时应安全回落宿主旧行为');
				check(pre.run?.scores?.some(item => item.score === 4), 'B/conflict 被占用时应使用宿主旧评分（7/6敌方=4）');
			}
			if (post) {
				check(post.hookIsExternal === true, 'B/conflict 安装后外部钩子应保留');
				check(post.externalKeptOnUninstall === true, 'B/conflict 卸载时身份已变化不得删除外部钩子');
				check(post.hookIsExtension === true, 'B/conflict 恢复安装后应重新装上本包钩子');
				check(post.run?.choice?.bool === true, 'B/conflict 钩子被替换后应回落宿主旧行为');
				check(post.run?.scores?.some(item => item.score === 4), 'B/conflict 钩子被替换后应使用宿主旧评分');
			}
		}
	}
	}
}

if (failures.length) {
	console.error('COMPARE_FAILED');
	for (const item of failures) console.error(' - ' + item);
	process.exit(1);
}

const summary = {
	checkedConfigs: Object.keys(reports),
	checkedAt: new Date().toISOString(),
	matrix: matrixRows,
	conclusions: {
		hostOldScores: reports.A.scenes.filter(s => matrixNames.includes(s.name)).map(s => ({ scene: s.name, score: s.targetScore, activated: !!s.choice?.bool, delta: s.firstDelta })),
		fixedScores: reports.C.scenes.filter(s => matrixNames.includes(s.name)).map(s => ({ scene: s.name, score: s.targetScore, activated: !!s.choice?.bool, delta: s.firstDelta })),
		unpatchedExtensionEqualsNative:
			JSON.stringify(reports.B.scenes.filter(s => matrixNames.includes(s.name)).map(s => [s.name, s.targetScore, !!s.choice?.bool, s.firstDelta])) ===
			JSON.stringify(reports.C.scenes.filter(s => matrixNames.includes(s.name)).map(s => [s.name, s.targetScore, !!s.choice?.bool, s.firstDelta])),
		patchedExtensionSkips:
			reports.D.installState.onChooseTarget === false &&
			reports.D.installState.stats?.packs?.shenhua_lei?.zhenguCompatible === false &&
			JSON.stringify(reports.D.scenes.filter(s => matrixNames.includes(s.name)).map(s => [s.name, s.targetScore, !!s.choice?.bool, s.firstDelta])) ===
			JSON.stringify(reports.C.scenes.filter(s => matrixNames.includes(s.name)).map(s => [s.name, s.targetScore, !!s.choice?.bool, s.firstDelta])),
	},
};
const outDir = path.resolve(process.argv[3] || '.');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
const header = '| 配置 | 场景 | 自己/目标 | 态度 | 有效评分 | 发动 | 目标即时变化 | 公式 |\n| --- | --- | --- | --- | --- | --- | --- | --- |';
const lines = matrixRows.map(row => '| ' + [row.config, row.scene, row.own + '/' + row.target, row.attitude, row.score, row.activated, row.delta, row.formula].join(' | ') + ' |');
fs.writeFileSync(path.join(outDir, 'matrix.md'), [header, ...lines].join('\n') + '\n', 'utf8');
console.log('COMPARE_OK');
console.log('unpatchedExtensionEqualsNative=' + summary.conclusions.unpatchedExtensionEqualsNative);
console.log('patchedExtensionSkips=' + summary.conclusions.patchedExtensionSkips);
