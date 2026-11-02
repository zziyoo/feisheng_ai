/* 神话再临·火复核包：14 项登记技能均已在真实宿主取得结论。
 * 连环的已横置目标由宿主 get.effect 按敌我、体力和手牌评估；解除队友或自身横置
 * 在连锁属性伤害风险下是正向收益，重铸并非总是更优。复核后未保留任何 ai2 覆盖。
 * 本包保留空策略入口，仅用于分包注册、验收与安装回滚，不改变宿主原生出牌。 */
function install() {}

export const pack = {
	id: 'shenhua_huo',
	name: '神话再临·火',
	group: 'shenhua',
	skills: [],
	statsDefaults: {},
	install,
};
