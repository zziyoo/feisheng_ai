import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const evidenceDir = path.join(repo, 'docs/remaining-ten-packs-acceptance/host/evidence');
const clean = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'edge-clean.json'), 'utf8'));
const patched = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'edge-patched.json'), 'utf8'));
const scene = (doc, name) => doc.scenes.find(item => item.name === name);
const pick = (doc, name, keys) => Object.fromEntries(keys.map(key => [key, scene(doc, name)?.[key]]));

const hostRoots = {
  clean: 'C:/Users/32360/AppData/Local/Temp/shv-accept/host-a',
  patched: 'C:/Users/32360/AppData/Local/Temp/remaining-ten-accept/host-ten',
};
const files = ['character/standard.js', 'character/shenhua.js', 'character/refresh.js', 'character/sp.js', 'character/tw.js'];
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hostHashes = Object.fromEntries(Object.entries(hostRoots).map(([label, root]) => [label, Object.fromEntries(files.map(file => [file, sha256(path.join(root, file))]))]));

const dimengCleanLegal = pick(clean, 'edge-dimeng-legal-event', ['ok', 'result', 'settlementOk', 'settlement']);
const dimengPatchedLegal = pick(patched, 'edge-dimeng-legal-event', ['ok', 'result', 'settlementOk', 'settlement']);
const tuntianClean = pick(clean, 'edge-tuntian-hidden', ['caseShaTao', 'caseShaSha', 'caseShanTao']);
const tuntianPatched = pick(patched, 'edge-tuntian-hidden', ['caseShaTao', 'caseShaSha', 'caseShanTao']);
const olhaoshiGiveClean = pick(clean, 'edge-olhaoshi-give', ['ai1', 'chosenTarget', 'chosenCards']);
const olhaoshiGivePatched = pick(patched, 'edge-olhaoshi-give', ['ai1', 'chosenTarget', 'chosenCards']);
const olhaoshiHelpClean = pick(clean, 'edge-olhaoshi-help', ['aiShan', 'aiTao', 'result', 'afterActorHand']);
const olhaoshiHelpPatched = pick(patched, 'edge-olhaoshi-help', ['aiShan', 'aiTao', 'result', 'afterActorHand']);
const rehuashenClean = pick(clean, 'edge-rehuashen-legal', ['ok', 'cycles', 'rawVsMap', 'ranks']);
const rehuashenPatched = pick(patched, 'edge-rehuashen-legal', ['ok', 'cycles', 'rawVsMap', 'ranks']);
const rehuashenEmptyClean = pick(clean, 'edge-rehuashen-empty', ['legalCharacterCount', 'legalFilter', 'emptyFilter', 'result']);
const rehuashenEmptyPatched = pick(patched, 'edge-rehuashen-empty', ['legalCharacterCount', 'legalFilter', 'emptyFilter', 'result']);
const qizhiMixedClean = pick(clean, 'edge-qizhi-mixed', ['beforeTarget', 'discardable', 'nonDiscardable', 'costResult', 'afterTarget']);
const qizhiMixedPatched = pick(patched, 'edge-qizhi-mixed', ['beforeTarget', 'discardable', 'nonDiscardable', 'costResult', 'afterTarget']);
const qizhiProtectedClean = pick(clean, 'edge-qizhi-protected-only', ['beforeTarget', 'discardable', 'costResult', 'afterTarget']);
const qizhiProtectedPatched = pick(patched, 'edge-qizhi-protected-only', ['beforeTarget', 'discardable', 'costResult', 'afterTarget']);
const reqiaobianClean = pick(clean, 'edge-reqiaobian-context', ['cases']);
const reqiaobianPatched = pick(patched, 'edge-reqiaobian-context', ['cases']);
const feijunPostpayClean = pick(clean, 'edge-feijun-postpay', ['aiBefore', 'filterBefore', 'afterActorHand', 'afterEnemyHand', 'storage', 'binglveMarker']);
const feijunPostpayPatched = pick(patched, 'edge-feijun-postpay', ['aiBefore', 'filterBefore', 'afterActorHand', 'afterEnemyHand', 'storage', 'binglveMarker']);
const feijunNoTargetClean = pick(clean, 'edge-feijun-no-target', ['filter', 'afterActorHand', 'storage']);
const feijunNoTargetPatched = pick(patched, 'edge-feijun-no-target', ['filter', 'afterActorHand', 'storage']);

const summary = {
  generatedAt: new Date().toISOString(),
  scope: '剩余十包第二阶段：四项未决技能（dimeng/tuntian/olhaoshi/rehuashen）与三个宿主边界（qizhi/reqiaobian/feijun）',
  devHead: '1598a41cb7fb1ca03607657da2e6550f72ebe0cb',
  acceptanceBaseHead: '075508dd36a484d812b607cea01da5369f71eb7b',
  hostHashes,
  scenes: {
    totalPerHost: clean.scenes.length,
    cleanPageErrors: clean.errors.length,
    patchedPageErrors: patched.errors.length,
    cleanExpectedCaughtErrors: clean.scenes.filter(item => item.ok === false || item.sceneOk === false).map(item => ({name: item.name, error: item.error || item.sceneError})),
  },
  mainSkills: {
    dimeng: {
      clean: {
        direct: pick(clean, 'edge-dimeng-direct-empty', ['ok', 'error', 'selectedAfter']),
        event: pick(clean, 'edge-dimeng-event-empty', ['ok', 'sceneOk', 'error', 'selectedAfter']),
        legal: dimengCleanLegal,
      },
      patched: {
        direct: pick(patched, 'edge-dimeng-direct-empty', ['ok', 'result', 'selectedAfter']),
        event: pick(patched, 'edge-dimeng-event-empty', ['ok', 'result', 'selectedAfter']),
        legal: dimengPatchedLegal,
      },
      evidenceLevel: 'A',
      verdict: 'PASS：空候选在真实 chooseTarget 事件中可触发并已被补丁消除；合法非空候选与交换结算不变。',
    },
    tuntian: {
      clean: tuntianClean,
      patched: tuntianPatched,
      evidenceLevel: 'A',
      verdict: 'PASS：公开信息相同、隐藏牌面不同时，原宿主 juedou 估值 1/2 随暗牌变化，补丁稳定为 0.9881；get.effect 同步稳定。',
    },
    olhaoshi: {
      clean: {give: olhaoshiGiveClean, help: olhaoshiHelpClean},
      patched: {give: olhaoshiGivePatched, help: olhaoshiHelpPatched},
      evidenceLevel: 'A',
      verdict: 'PASS：并列最低目标首位为敌方时，原宿主只检查首位而漏掉友方；补丁正确识别全部目标。援助回调原宿主不交闪，补丁交出闪。',
    },
    rehuashen: {
      clean: {legal: rehuashenClean, empty: rehuashenEmptyClean},
      patched: {legal: rehuashenPatched, empty: rehuashenEmptyPatched},
      evidenceLevel: 'A/B',
      verdict: 'PASS：合法化身池两轮 phaseBegin/phaseEnd 均完成，补丁使用 in/out 排名且只选合法地图技能；空池阶段过滤器为 false，人工空态下补丁安全 cancel2（本轮未验证角色池耗尽路径）。',
    },
  },
  boundaries: {
    attribution: {
      qizhi: '十份原生补丁均无 qizhi 命中；宿主原生 character/sp.js。',
      reqiaobian: '十份原生补丁均无 reqiaobian 命中；宿主原生 character/refresh.js。',
      feijun: '十份原生补丁均无 nzry_feijun 命中；shenhua_yin.patch 的 2557 行上下文属于 nzry_kuizhu，不是 feijun。',
    },
    qizhi: {
      clean: {mixed: qizhiMixedClean, protectedOnly: qizhiProtectedClean},
      patched: {mixed: qizhiMixedPatched, protectedOnly: qizhiProtectedPatched},
      conclusion: '宿主原生 P2：混合牌时只弃可弃牌并保留受保护装备；全部受保护时弃置 0 张但仍摸 1 张。补丁未修改。',
    },
    reqiaobian: {
      clean: reqiaobianClean,
      patched: reqiaobianPatched,
      conclusion: '宿主原生 P2：过滤器固定使用 reqiaobian_judge 上下文。draw 子技已复现：仅 draw 上下文可弃时过滤器 false，合法跳过机会被漏掉；仅 judge 可弃时过滤器通过但只提供取消，无非法跳过。use/discard 子技未逐项构造。',
    },
    feijun: {
      clean: {postpay: feijunPostpayClean, noTarget: feijunNoTargetClean},
      patched: {postpay: feijunPostpayPatched, noTarget: feijunNoTargetPatched},
      conclusion: '宿主原生 P2：支付前 1 手对 1 手时 AI 返回空、不会发动；支付后目标合法，实际取得一张并触发兵略摸二。无合法目标时安全结束。补丁未修改。',
    },
  },
  packStatus: {
    standard_2008: 'PASS',
    standard_2013: 'PASS',
    standard_2019: 'PASS',
    standard_2023: 'PASS',
    shenhua_lin: 'PASS',
    shenhua_shan: 'PASS',
    shenhua_yin: 'PASS（宿主原生 qizhi/feijun P2 保留）',
    refresh_huo: 'PASS',
    refresh_lin: 'PASS',
    refresh_shan: 'PASS（宿主原生 reqiaobian P2 保留）',
  },
  openP0P1: [],
  p2: [
    'qizhi：全部牌受保护时仍摸一张（宿主原生，未改）',
    'reqiaobian：filter 使用 reqiaobian_judge 上下文；draw 子技已复现漏触发，use/discard 未逐项构造（宿主原生，未改）',
    'feijun：AI 发动评分用支付前张数，支付后合法的目标被漏估（宿主原生，未改）',
    'rehuashen：空化身池本轮仅由人工破坏构造；正常 init 抽 3 成功；角色池耗尽未验证；阶段过滤器阻断，补丁为防御性 cancel2',
    '其他开发台账 P2 未在本轮逐项重审',
  ],
  combinationGate: {
    executed: false,
    canEnter: true,
    note: '十包原生补丁范围达到交付门禁；十包原生 + 旧六包扩展的受支持组合尚未执行，本轮不声明十六包兼容 PASS。',
  },
};

fs.writeFileSync(path.join(here, 'real-host-edge-summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({out: path.join(here, 'real-host-edge-summary.json'), packs: summary.packStatus, openP0P1: summary.openP0P1, p2: summary.p2.length}, null, 2));
