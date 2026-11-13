import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadSkill } from './native-p2-test-support.mjs';

const hostRoot = process.argv[2];
assert.ok(hostRoot, 'Pass the clean Noname 1.11.7 application directory');
const read = rel => readFile(resolve(hostRoot, rel), 'utf8');
const stockSource = await read('character/shenhua.js');
const hostContent = await read('noname/library/element/content.js');
const hostEvent = await read('noname/library/element/gameEvent.js');
assert.match(hostEvent, /childEvent\.pushHandler\(\.\.\.event\.getHandler\(type\)\)/);
assert.match(hostContent, /event\.processAI\(event\.list\)/);

const cards = [
	{ name: 'tao', suit: 'heart', number: 4 },
	{ name: 'sha', suit: 'spade', number: 7 },
	{ name: 'shan', suit: 'club', number: 2 },
];
const hiddenRead = () => { throw new Error('Read a private card or recipient-dependent value'); };
let relation = -4;
let judges = [{ name: 'lebu' }];
const next = {
	getCards(zone) {
		assert.equal(zone, 'j');
		return judges;
	},
	getUseValue: hiddenRead,
};
const actor = {
	next,
	hasHistory: () => false,
	isMinHandcard: () => true,
	getStat: () => 0,
};
const names = list => Array.from(list, row => Array.from(row, card => card.name));
const effects = {
	lebu: { ai: { basic: { value: 8 } } },
	bingliang: { ai: { basic: { value: 4 } } },
	tao: { ai: { basic: { value: [7, 5.1, 2] } } },
	sha: { ai: { basic: { value: [5, 3, 1] } } },
	shan: { ai: { basic: { value: [6, 4, 2] } } },
};
const get = {
	cards: () => cards.slice(),
	cnNumber: n => String(n),
	attitude: (from, to) => {
		assert.equal(from, actor);
		assert.equal(to, next);
		return relation;
	},
	suit: card => card.suit,
	number: card => card.number,
	judge: card => effects[card.name].judge,
	value: hiddenRead,
};
effects.lebu.judge = Function('get', 'return ({' + (await read('card/standard.js')).match(/lebu: \{[\s\S]+?(judge\(card\) \{[\s\S]+?\n      \})/)[1] + '}).judge')(get);
effects.bingliang.judge = Function('get', 'return ({' + (await read('card/extra.js')).match(/bingliang: \{[\s\S]+?(judge\(card\) \{[\s\S]+?\n      \})/)[1] + '}).judge')(get);
const callbacks = new Set();
let child;
const game = {
	cardsGotoOrdering: async () => {},
	globalEventHandlers: {
		pushHandler(name, key, fn) {
			assert.equal(name, 'xinfu_zuilun');
			assert.equal(key, 'onNextChooseToMove');
			callbacks.add(fn);
		},
		removeHandler(name, key, fn) {
			assert.equal(name, 'xinfu_zuilun');
			assert.equal(key, 'onNextChooseToMove');
			callbacks.delete(fn);
		},
	},
};
actor.chooseToMove = (prompt, forced) => {
	assert.equal(forced, true);
	child = {
		name: 'chooseToMove', forced, player: actor, getParent: () => parent,
		set(key, value) { this[key] = value; return this; },
		forResult() { throw stop; },
	};
	return child;
};
const parent = { name: 'xinfu_zuilun', player: actor, triggername: 'phaseJieshuBegin' };
const status = {};
const lib = { skill: {}, card: effects };
const stock = loadSkill(stockSource, 'xinfu_zuilun', { get, game, _status: status });
lib.skill.xinfu_zuilun = stock;
const stop = new Error('Stop before skill settlement');
await assert.rejects(stock.content(parent, null, actor), error => error === stop);
const original = child.processAI;
status.event = child;
const stockList = child.list.map(row => [row[0], row[1]]);
assert.deepEqual(names(original(stockList)), [['tao'], ['sha', 'shan']], 'Stock sorts the outer piles and leaves displayed cards in deck order');

const moduleUrl = source => 'data:text/javascript,' + encodeURIComponent(source);
const runtimeUrl = moduleUrl('export let lib, game, get; export function setup(runtime) { ({ lib, game, get } = runtime); }');
const { setup } = await import(runtimeUrl);
setup({ lib, game, get });
const rulesUrl = new URL('../score/decision/skills/rules/shenhuaLei.js', import.meta.url).href;
const source = (await readFile(new URL('../score/decision/skills/packs/shenhuaLei.js', import.meta.url), 'utf8'))
	.replace(/\.\.\/policyCore\.js\?[^']+/, runtimeUrl)
	.replace(/\.\.\/rules\/shenhuaLei\.js\?[^']+/, rulesUrl);
const { pack } = await import(moduleUrl(source));
const cleanups = [];
pack.install({ addCleanup: fn => cleanups.push(fn) }, {});
const run = (event, state = 'begin') => {
	for (const fn of callbacks) fn(event, { state });
};
const unaffected = { ...child, getParent: () => ({ ...parent, name: 'hongju' }) };
run(unaffected);
assert.equal(unaffected.processAI, original);
const foreign = { ...child, processAI: () => [['foreign']] };
run(foreign);
assert.deepEqual(foreign.processAI(), [['foreign']]);
const ended = { ...child };
run(ended, 'end');
assert.equal(ended.processAI, original);
run(child);
const changed = child.processAI;
run(child);
assert.equal(child.processAI, changed, 'Repeated begin cannot add another wrapper');
assert.deepEqual(names(child.processAI(child.list)), [['sha'], ['tao', 'shan']], 'Enemy 乐不思蜀 fails while the owner retains 桃');
relation = 6;
assert.deepEqual(names(child.processAI(child.list)), [['tao'], ['sha', 'shan']], 'Ally passes the same public judgment');
judges = [];
assert.deepEqual(names(child.processAI(child.list)), [['sha'], ['tao', 'shan']], 'Without judgments, retain high static values');
child.num = 2;
judges = [{ name: 'lebu' }, { name: 'bingliang' }];
assert.deepEqual(names(child.processAI(child.list)), [['tao', 'shan'], ['sha']], 'Multiple judgments are scored in the host order');
assert.deepEqual(names([child.list[0][1]]), [['tao', 'sha', 'shan']], 'The input card list is unchanged');
relation = NaN;
assert.deepEqual(names(child.processAI(child.list)), [['sha', 'shan'], ['tao']], 'Invalid attitude cannot reverse public scores');
relation = 6;

child.num = 3;
child.list = [['牌堆顶', cards]];
assert.deepEqual(names(child.processAI(child.list)), [['tao', 'shan', 'sha'], []]);
assert.equal(stock.content, lib.skill.xinfu_zuilun.content);
cleanups.forEach(fn => fn());
assert.equal(callbacks.size, 0);
child.num = 1;
child.list = stockList;
judges = [{ name: 'lebu' }];
assert.deepEqual(names(child.processAI(child.list)), names(original(child.list)), 'An already queued callback reverts to stock after uninstall');
console.log('PASS zuilun public judgments, legal partition, immutable inputs, event ownership and cleanup');
