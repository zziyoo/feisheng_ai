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
const get = { name: card => card.name, tag: card => card.damage, effect: (_, card) => card.effect, attitude: current => current.attitude };
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
	},
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
assert.equal(cleanups.length, 1, 'Repeated installation cannot wrap its own callback again');
cleanups[0]();
assert.equal(result.target, stock, 'Teardown restores the stock callback');
pack.install(wrapperHost, {});
const foreign = () => 13;
result.target = foreign;
cleanups[1]();
pack.install(wrapperHost, {});
assert.equal(result.target, foreign, 'Teardown and installation preserve a third-party callback');
assert.equal(cleanups.length, 2);
console.log('PASS xiongluan stock callback, weighted decisions, fallback, and hook identity');
