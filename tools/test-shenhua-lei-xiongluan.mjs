import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const hostRoot = process.argv[2];
if (!hostRoot) throw new Error('Pass the clean Noname 1.11.7 application directory');
const hostSource = await readFile(resolve(hostRoot, 'character/shenhua.js'), 'utf8');
const skillStart = hostSource.indexOf('\n  drlt_xiongluan: {');
assert.notEqual(skillStart, -1);
const callback = hostSource.slice(skillStart).match(/target: (\(player, target\) => \{[\s\S]+?\n        \})\s*\n      \}/)?.[1];
assert.ok(callback, 'Expected the stock xiongluan target callback');

const sha = { name: 'sha', damage: true, effect: 1 };
const trick = { name: 'juedou', damage: true, effect: 1 };
const deadDamage = { ...sha, effect: 0 };
const player = {
	cards: [sha],
	getCards() { return this.cards; },
	countCards(position, predicate) { return this.getCards(position).filter(predicate).length; },
};
const target = { hp: 1, hujia: 0, equip: 'bagua', getEquip(name) { return this.equip === name; } };
const get = { name: card => card.name, tag: card => card.damage, effect: (_, card) => card.effect, attitude: (current, other) => current === player ? other.attitude : current.attitude };
const game = { others: [], countPlayer(fn) { return this.others.reduce((sum, current) => sum + fn(current), 0); } };
const stock = Function('get', 'game', `return (${callback})`)(get, game);
const result = { target: stock };
const lib = { skill: { drlt_xiongluan: { ai: { result } } } };
const moduleUrl = source => `data:text/javascript,${encodeURIComponent(source)}`;
const runtimeUrl = moduleUrl('export let lib, game, get; export function setup(runtime) { ({ lib, game, get } = runtime); }');
const rulesUrl = new URL('../score/decision/skills/rules/shenhuaLei.js', import.meta.url).href;
const packUrl = new URL('../score/decision/skills/packs/shenhuaLei.js', import.meta.url);
const packSource = (await readFile(packUrl, 'utf8'))
	.replace(/\.\.\/policyCore\.js\?[^']+/, runtimeUrl)
	.replace(/\.\.\/rules\/shenhuaLei\.js\?[^']+/, rulesUrl);
const { setup } = await import(runtimeUrl);
setup({ lib, game, get });
const { pack } = await import(moduleUrl(packSource));
const cleanups = [];
const wrapperHost = {
	wrap(owner, key, tag, factory) {
		assert.equal(tag, 'drlt_xiongluan:target');
		const original = owner[key];
		const wrapped = factory(original);
		owner[key] = wrapped;
		cleanups.push(() => { if (owner[key] === wrapped) owner[key] = original; });
		return { wrapped };
	},
	addCleanup(cleanup) { cleanups.push(cleanup); },
};

assert.equal(stock(player, target), -1, 'Stock counts the fractional score as a whole card');
pack.install(wrapperHost, {});
const fixed = result.target;
assert.equal(fixed(player, target), 0, 'One half-weight sha cannot reach 1 HP');
player.cards = [sha, sha];
assert.equal(fixed(player, target), -1, 'Two bagua-weighted sha still reach 1 HP');
target.equip = 'rewrite_bagua';
player.cards = [sha, sha, sha];
assert.equal(fixed(player, target), 0, 'Three quarter-weight sha stay below 1 HP');
player.cards.push(sha);
assert.equal(fixed(player, target), -1, 'Four quarter-weight sha reach 1 HP');
player.cards = [trick, deadDamage];
assert.equal(fixed(player, target), stock(player, target), 'Usable trick and nonpositive effect preserve stock decisions');
target.equip = '';
player.cards = [sha];
assert.equal(fixed(player, target), stock(player, target), 'Without a relevant armor the scores agree');
target.hujia = 1;
assert.equal(fixed(player, target), 0, 'Public armor raises the kill threshold');
target.hujia = 0;
game.others = [{ attitude: 1, countCards: position => position === 'hs' ? 1 : 0 }];
assert.equal(fixed(player, target), 0, 'Public rescue estimate remains in the threshold');
game.others = [];
const incompatiblePlayer = { countCards: () => 2 };
assert.equal(fixed(incompatiblePlayer, target), stock(incompatiblePlayer, target), 'Original callback is used when the wrapper cannot evaluate');

pack.install(wrapperHost, {});
assert.equal(cleanups.length, 2, 'Repeated installation cannot wrap its own callback again');
cleanups[1]();
cleanups[0]();
assert.equal(result.target, stock, 'Teardown restores the stock callback');
assert.equal('effect' in lib.skill.drlt_xiongluan.ai, false);
pack.install(wrapperHost, {});
const foreign = () => 13;
result.target = foreign;
cleanups[3]();
cleanups[2]();
pack.install(wrapperHost, {});
assert.equal(result.target, foreign, 'Teardown and installation preserve a third-party callback');
assert.equal(cleanups.length, 4);

// Use both real host aggregators with the old engine's player-side direction bonus.
const getSource = await readFile(resolve(hostRoot, 'noname/get/index.js'), 'utf8');
const hostEffects = Function('CacheContext', '_status', 'get', 'game', 'lib', `return ({
	${getSource.match(/^  effect_use\([\s\S]+?^  \}/m)[0]},
	${getSource.match(/^  effect\([\s\S]+?^  \}/m)[0]},
})`);
const engine = { ai: { effect: { player(card, actor, recipient) {
	if (card === 'drlt_xiongluan') return [1, recipient.attitude < 0 ? -12 : 1.5];
	return [1, 2];
} } } };
const readInfo = subject => lib.skill[subject] || { ai: { result: {} } };
lib.skill.global = ['_djsc_engine'];
lib.skill._djsc_engine = engine;
get.info = readInfo;
get.result = subject => readInfo(subject).ai.result || {};
game.expandSkills = () => {};
player.getSkills = () => ['drlt_xiongluan'];
target.getSkills = () => [];
player.attitude = 10;
get.attitude = (actor, recipient) => actor === recipient ? 10 : recipient.attitude ?? actor.attitude;
get.effect = (recipient, card) => recipient.attitude < 0 ? card.effect : -card.effect;
get.tag = (card, tag) => tag === 'damage' && Boolean(card.damage);
const cache = { get, delegate: obj => obj };
const effects = hostEffects({ requireCacheContext: () => cache }, { event: {} }, get, game, lib);
const evaluate = (fn, subject = 'drlt_xiongluan') => fn(target, subject, player, player);
result.target = stock;
target.equip = 'bagua';
target.attitude = -4;
player.cards = [sha];
assert.equal(evaluate(effects.effect), -116);
const beforeUnrelated = evaluate(effects.effect, 'other_skill');
pack.install(wrapperHost, {});
for (const effect of [effects.effect, effects.effect_use]) {
	assert.equal(evaluate(effect), 0, 'One half-weight Sha must remain neutral against an enemy');
	player.cards = [sha, sha];
	assert.equal(evaluate(effect), 4, 'Enemy benefit comes from the target result and negative attitude');
	target.attitude = 6;
	assert.equal(evaluate(effect), 0, 'An attack with nonpositive card utility must not promote an ally');
	player.cards = [sha];
	target.attitude = -4;
	assert.equal(evaluate(effect, 'other_skill'), beforeUnrelated, 'Other effects retain their player component');
}
const ai = lib.skill.drlt_xiongluan.ai;
const installedEffect = ai.effect;
assert.ok(installedEffect);
const installedTarget = result.target;
result.target = foreign;
assert.equal(installedEffect.player('drlt_xiongluan'), undefined, 'A replaced target callback disables the local effect');
result.target = installedTarget;
const foreignEffect = { player: () => 7 };
ai.effect = foreignEffect;
for (const cleanup of cleanups.slice(4).reverse()) cleanup();
assert.equal(ai.effect, foreignEffect, 'An effect replaced after install survives cleanup');
pack.install(wrapperHost, {});
assert.equal(ai.effect, foreignEffect, 'Existing third-party effect is preserved');
console.log('PASS xiongluan stock callback, weighted decisions, fallback, and hook identity');
