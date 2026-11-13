import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('Pass the clean Noname 1.11.7 application directory');
const [skills, basic] = await Promise.all([
	readFile(resolve(root, 'character/shenhua.js'), 'utf8'),
	readFile(resolve(root, 'noname/ai/basic.js'), 'utf8'),
]);
const skillSource = skills.match(/\n  qiangxix: (\{[\s\S]+?\n  \}),\n  qiangxi:/)?.[1];
const chooseCardSource = basic.match(/\n  (chooseCard\(check\) \{[\s\S]+?\n  \})\n  \/\*\*/)?.[1];
assert.ok(skillSource && chooseCardSource, 'Expected stock qiangxix and Basic.chooseCard');

const zhuge = { name: 'zhuge', subtype: 'equip1', classList: { add() {} } };
const zhangba = { ...zhuge, name: 'zhangba' };
const sha = { name: 'sha' };
const selected = [];
selected.add = selected.push;
const ui = { selected: { cards: selected }, click: { skill() { event.skill = 'qiangxix'; } } };
const target = {
	hp: 4, hujia: 0, attitude: -5, hand: 0, hasArmor: false, canRespond: false,
	countCards() { return this.hand; },
	getVEquips() { return this.hasArmor ? [{}] : []; },
	hasSkillTag() { return this.canRespond; },
	async damage(kind) { assert.equal(kind, 'nocard'); this.hp--; },
};
const player = {
	hp: 4, maxHp: 4, weapon: zhuge, used: 0, quotaWithout: 1, extraZhuge: false, stat: {},
	cards: [sha, { ...sha }, { ...sha }], canAttack: true,
	getStat() { return this.stat; },
	getCards(zone, filter) {
		const cards = zone === 'e' ? [this.weapon] : this.cards;
		return filter ? cards.filter(filter) : cards;
	},
	getCardUsable() { return this.weapon === zhuge ? Infinity : this.quotaWithout - this.used; },
	getModableSkills: () => ['qiangxix', 'zhuge_skill'],
	countUsed() { return this.used; },
	hasSkill() { return this.extraZhuge; },
	canUse() { return this.canAttack; },
	isPhaseUsing: () => true,
	async loseHp() { this.hp--; },
};
const event = { player, name: 'chooseToUse', type: 'phase', filterCard: () => true, selectCard: () => skill.selectCard() };
const _status = { event, currentPhase: player };
const get = {
	subtype: card => card.subtype, name: card => card.name, autoViewAs: card => card,
	info: subject => typeof subject === 'string' ? lib.skill[subject] : { usable: 1 },
	select: getter => typeof getter === 'function' ? getter() : getter,
	get skills() { return () => event.skill ? [] : ['qiangxix']; },
	selectableCards: () => event.skill ? [player.weapon] : [],
	unuseful2: () => player.weapon === zhuge ? 1 : 4,
	attitude: (_player, current) => current.attitude,
	effect: (_target, card) => card.name === 'losehp' ? -6 : 5,
	effect_use: () => 4,
};
const game = {
	check() {},
	hasPlayer: fn => fn(target),
	checkMod(card, actor, num, kind, mods) {
		assert.equal(card.name, 'sha');
		assert.equal(actor, player);
		if (mods === 'cardUsableTarget') {
			assert.equal(num, target);
			assert.equal(kind, false);
			return false;
		}
		assert.equal(num, 1);
		assert.equal(kind, 'cardUsable');
		assert(!mods.includes('zhuge_skill'));
		return player.quotaWithout;
	},
};
const skill = Function('lib', 'game', 'get', 'ui', '_status', `return (${skillSource})`)({}, game, get, ui, _status);
const lib = { skill: { qiangxix: skill, olqiangxi: { check: () => 11 } } };
const CacheContext = class { static setCacheContext() {} static setInCacheEnvironment() {} static removeCacheContext() {} };
const selector = Function('lib', 'game', 'get', 'ui', '_status', 'CacheContext', `return ({${chooseCardSource}})`)(lib, game, get, ui, _status, CacheContext);
function payment() {
	event.skill = null;
	selected.length = 0;
	assert.equal(selector.chooseCard(() => 8), true, 'Real optional-material selection still completes');
	return selected[0]?.name || 'hp';
}
assert.equal(payment(), 'zhuge', 'Stock selects the equipped crossbow in this position');

const url = source => `data:text/javascript,${encodeURIComponent(source)}`;
const coreUrl = url('export let lib, game, get, _status, ui; export function init(host) { ({ lib, game, get, _status, ui } = host); }');
const vetoUrl = url('export function registerSkillVeto() {}');
const rulesUrl = new URL('../score/decision/skills/rules/shenhuaHuo.js', import.meta.url).href;
const source = (await readFile(new URL('../score/decision/skills/packs/shenhuaHuo.js', import.meta.url), 'utf8'))
	.replace(/\.\.\/policyCore\.js\?[^']+/, coreUrl)
	.replace(/\.\.\/skillVetoRegistry\.js\?[^']+/, vetoUrl)
	.replace(/\.\.\/rules\/shenhuaHuo\.js\?[^']+/, rulesUrl);
(await import(coreUrl)).init({ lib, game, get, _status, ui });
const { pack } = await import(url(source));
const cleanup = [];
const host = { addCleanup(fn) { cleanup.push(fn); } };
const originalContent = skill.content;
pack.install(host, {});
assert.equal(payment(), 'hp', 'Keep the equipped crossbow when two additional attacks outweigh a safe HP payment');
assert.equal(skill.content, originalContent, 'Settlement callback is untouched');
await skill.content({ target, cards: [...selected] }, null, player);
assert.equal(player.hp, 3);
assert.equal(target.hp, 3);
assert.equal(player.weapon, zhuge);
assert.deepEqual(player.stat._qiangxix, [target]);
player.hp = target.hp = 4;
player.stat = {};
assert.equal(lib.skill.olqiangxi.check(), 11);

player.hp = 2;
assert.equal(payment(), 'zhuge', 'Low health preserves the stock weapon payment');
player.hp = 4;
player.weapon = zhangba;
assert.equal(payment(), 'zhangba', 'Other weapons keep their stock decisions');
player.weapon = zhuge;
player.quotaWithout = 3;
assert.equal(payment(), 'zhuge', 'An independent quota makes the crossbow redundant');
player.quotaWithout = 1;
player.extraZhuge = true;
assert.equal(payment(), 'zhuge', 'A non-equipment Zhuge skill makes the crossbow redundant');
player.extraZhuge = false;
target.hujia = 1;
assert.equal(payment(), 'zhuge');
target.hujia = 0;
target.hasArmor = true;
assert.equal(payment(), 'zhuge');
target.hasArmor = false;
target.canRespond = true;
assert.equal(payment(), 'zhuge');
target.canRespond = false;
target.hand = 1;
assert.equal(payment(), 'zhuge');
target.hand = 0;
target.hp = 3;
assert.equal(payment(), 'zhuge', 'After the skill damage there is only one extra useful attack');
target.hp = 4;
target.attitude = 5;
assert.equal(payment(), 'zhuge');
target.attitude = -5;
player.stat._qiangxix = [target];
assert.equal(payment(), 'zhuge', 'An already chosen enemy cannot justify the HP cost');
player.stat = {};
player.canAttack = false;
assert.equal(payment(), 'zhuge');
player.canAttack = true;
player.cards.pop();
assert.equal(payment(), 'zhuge', 'A lone extra attack leaves the stock choice intact');
player.used = 1;
assert.equal(payment(), 'hp', 'Both remaining attacks depend on the crossbow after a previous Sha');

const installed = skill.check;
pack.install(host, {});
assert.equal(skill.check, installed);
assert.equal(cleanup.length, 1);
cleanup[0]();
assert.equal(Object.hasOwn(skill, 'check'), false);
assert.equal(payment(), 'zhuge');
pack.install(host, {});
const foreign = () => 7;
skill.check = foreign;
cleanup[1]();
pack.install(host, {});
assert.equal(skill.check, foreign);
assert.equal(cleanup.length, 2);
console.log('PASS stock Basic.chooseCard, safe crossbow opportunity, preservation controls, and lifecycle');
