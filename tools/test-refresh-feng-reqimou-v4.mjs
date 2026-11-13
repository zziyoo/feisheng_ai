import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadSkill } from './native-p2-test-support.mjs';

const hostRoot = process.argv[2];
assert.ok(hostRoot, 'Pass the clean Noname 1.11.7 application directory');
const nativeSource = await readFile(resolve(hostRoot, 'character/refresh.js'), 'utf8');
const sha = { name: 'sha' };
const enemy = {
	hp: 2, hujia: 0, distance: 5, effect: 1, attitude: -1, cards: 0, armor: null, shanSkill: false,
	countCards() { return this.cards; },
	getVEquip() { return this.armor; },
	hasSkill() { return false; },
	hasSkillTag(tag) { return tag === 'respondShan' && this.shanSkill; },
};
const player = {
	hp: 4, range: 3, uses: 1, cards: [sha, sha], next: null,
	getHp() { return this.hp; },
	getAttackRange() { return this.range; },
	getCardUsable() { return this.uses; },
	getCards(position, check) { return this.cards.filter(check); },
	hasSkill() { return false; },
	countCards(position, check) {
		return typeof check === 'function' ? this.cards.filter(check).length : 0;
	},
	canUse(card, target, distance) {
		return card.enabled !== false && target.enabled !== false && (distance === false || target.distance <= this.range);
	},
	canSaveCard() { return false; },
	awakenSkill() {},
	chooseNumbers() { return this.next; },
	async loseHp(number) { this.paid = number; },
	async draw(number) { this.drawn = number; },
	addTempSkill(id) { this.added = id; },
	storage: {},
};
const get = {
	distance: (_, target, method) => method === 'attack' ? target.attackDistance ?? target.distance : target.distance,
	effect: (target, card) => card.effect ?? target.effect,
	attitude: (_, target) => target.attitude,
	prompt: () => '',
};
const game = {
	hasPlayer(check) { return check(enemy); },
	checkMod(...args) {
		if (args.length === 6) return args[2].rangeMod ?? args[3];
		return args[1][args[3] + 'Mod'] ?? args[2];
	},
};
const stock = loadSkill(nativeSource, 'reqimou', { get, game });
const stockResult = stock.ai.result.player;
const lib = { skill: { reqimou: stock }, filter: { cardEnabled: card => card.enabled !== false } };
const moduleUrl = source => 'data:text/javascript,' + encodeURIComponent(source);
const runtimeUrl = moduleUrl('export let lib, game, get, _status; export function setup(runtime) { ({ lib, game, get, _status } = runtime); }');
const rulesUrl = new URL('../score/decision/skills/rules/refreshFeng.js', import.meta.url).href;
const packSource = (await readFile(new URL('../score/decision/skills/packs/refreshFeng.js', import.meta.url), 'utf8'))
	.replace(/\.\.\/policyCore\.js\?[^']+/, runtimeUrl)
	.replace(/\.\.\/rules\/refreshFeng\.js\?[^']+/, rulesUrl);
const { setup } = await import(runtimeUrl);
setup({ lib, game, get, _status: {} });
const { pack } = await import(moduleUrl(packSource));
const host = {
	wrap(owner, key, tag, factory) { owner[key] = factory(owner[key]); },
	aliveOthers() { return [enemy]; },
	cardName(card) { return card.name; },
};
const stats = { ...pack.statsDefaults };
const probe = () => stock.ai.result.player(player);

assert.equal(stockResult(player), 0, 'Stock ignores the equipped attack range');
pack.install(host, stats);
assert.equal(probe(), 1, 'Range 3 at distance 5 can gain two hits for two HP');
const chooseNumbers = player.chooseNumbers;
player.next = {
	isMine: () => false, isOnline: () => false,
	set() { return this; },
	async forResult() { return { bool: true, numbers: [3] }; },
};
await stock.content({ name: 'reqimou' }, null, player);
assert.equal(player.paid, 2);
assert.equal(player.drawn, 2);
assert.equal(player.storage.reqimou2, 2);
assert.equal(player.added, 'reqimou2');
assert.equal(player.chooseNumbers, chooseNumbers);

for (const [targetChanges, actorChanges] of [
	[{ hp: 3 }, {}],
	[{ hujia: 1 }, {}],
	[{ attitude: 1 }, {}],
	[{ cards: 1 }, {}],
	[{ armor: { name: 'bagua' } }, {}],
	[{ shanSkill: true }, {}],
	[{ effect: 0 }, {}],
	[{ enabled: false }, {}],
	[{ rangeMod: false }, {}],
	[{ inRangeMod: false }, {}],
	[{ inRangeOfMod: false }, {}],
	[{ attackDistance: 6 }, {}],
	[{}, { range: 1 }],
	[{}, { hp: 3 }],
	[{}, { uses: -1 }],
	[{}, { cards: [sha, { name: 'sha', enabled: false }] }],
	[{}, { cards: [sha, { name: 'sha', effect: 0 }] }],
]) {
	const beforeTarget = { ...enemy };
	const beforeActor = { ...player };
	Object.assign(enemy, targetChanges);
	Object.assign(player, actorChanges);
	assert.equal(probe(), 0, JSON.stringify({ targetChanges, actorChanges }));
	for (const key of Object.keys(targetChanges)) enemy[key] = beforeTarget[key];
	for (const key of Object.keys(actorChanges)) player[key] = beforeActor[key];
}

enemy.distance = 1;
assert.equal(probe(), 1, 'Stock-positive near case still uses the established planner');
enemy.hp = 3;
assert.equal(probe(), 0, 'Two hits on a 3 HP enemy remain a conservative decline');
enemy.hp = 2;
player.uses = Infinity;
assert.equal(probe(), 0, 'An already-available kill needs no payment');
player.uses = 1;
player.hp = 2;
assert.equal(probe(), false, 'Native low-HP floor is retained');
player.hp = 4;
enemy.distance = 5;

const foreign = { ai: { result: { player: () => 0 } } };
lib.skill.reqimou = foreign;
pack.install(host, stats);
assert.equal(foreign.ai.result.player(player), 0, 'A third-party opt-out is not promoted');
console.log('PASS reqimou long-range promotion, actual stock payment and conservative controls');
