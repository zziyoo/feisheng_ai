import { lib } from '../policyCore.js?v=41a';
import { lianhuanLinkedTargetSkip } from '../rules/shenhuaHuo.js?v=41a';

export const pack = {
	id: 'shenhua_huo',
	name: '神话再临·火',
	group: 'shenhua',
	skills: ['lianhuan'],
	statsDefaults: { lianhuanLinkedSkip: 0 },
	install,
};

/* 庞统【连环 lianhuan】：真实宿主复现时，所有目标均已横置，
 * AI 仍把♣牌当铁索连环指定已横置的友方，白白弃牌且不摸牌。
 * 只把“已横置”目标的评分压到不可选，让宿主走重铸分支；未横置目标仍用原生评分。 */
function install(host, stats) {
	const lianhuan = lib.skill && lib.skill.lianhuan;
	if (lianhuan && typeof lianhuan.ai2 === 'function') {
		host.wrap(lianhuan, 'ai2', 'lianhuan:ai2', original => function (target) {
			try {
				if (lianhuanLinkedTargetSkip(target)) {
					stats.lianhuanLinkedSkip++;
					return -100;
				}
			} catch (e) {}
			return original.apply(this, arguments);
		});
	}
}
