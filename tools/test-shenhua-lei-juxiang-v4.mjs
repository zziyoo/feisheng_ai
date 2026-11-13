import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadSkill } from './native-p2-test-support.mjs';

const hostRoot = process.argv[2];
assert.ok(hostRoot, 'Pass the clean Noname 1.11.7 application directory');
const hostSource = await readFile(resolve(hostRoot, 'character/tw.js'), 'utf8');
const standard = await readFile(resolve(hostRoot, 'card/standard.js'), 'utf8');
const armors = Object.fromEntries(['bagua', 'renwang'].map(name => {
	const value = Number(standard.match(new RegExp('^    '+name+': \\{[\\s\\S]*?equipValue: ([\\d.]+)', 'm'))?.[1]);
	assert.ok(value > 0);
	return [name, value];
}));

const armor = { name: 'bagua' };
const otherArmor = { name: 'renwang' };
const virtualArmor = { name: 'bagua', isViewAsCard: true };
const handArmor = { name: 'bagua' };
const info = Object.fromEntries(Object.entries(armors).map(([name, equipValue]) => [name, {
	subtype: 'equip2', ai: { basic: { equipValue } },
}]));
info.zhuge = { subtype: 'equip1', ai: { equipValue() { throw new Error('Recipient hidden card access'); } } };
const lord = {
	hp: 3, attitude: 6, allowed: true, open: true, disabled: false, equipLegal: true,
	hasZhuSkill(skill, from) { return this.allowed && skill === 'twjuxiang' && from === donor; },
	hasEmptySlot(slot) { return slot === 'equip2' && this.open; },
	hasDisabledSlot(slot) { return slot === 'equip2' && this.disabled; },
	canEquip(card) { return this.equipLegal && this.open && card === armor; },
	isMin() { return false; },
	getCards() { throw new Error('Must never inspect recipient cards'); },
};
const donor = {
	group: 'qun', hp: 1, hujia: 0, cards: [armor], hand: 0, tags: new Set(),
	countCards(zone) { assert.equal(zone, 'h'); return this.hand; },
	getVEquips(slot) { return slot === 'equip2' ? this.cards.filter(card => info[card.name].subtype === slot).map(card => ({ name: card.name, cards: [card] })) : []; },
	hasSkillTag(tag) { return this.tags.has(tag); },
};
const enemy = { attitude: -4, canThreaten: true, allowed: false, inRange(from) { return from === donor && this.canThreaten; }, hasZhuSkill() { return false; } };
const event = { name: 'chooseToUse', type: 'phase', skill: 'twjuxiang_global', player: donor };
const game = {
	players: [donor, lord, enemy],
	filterPlayer(check) { return this.players.filter(check); },
	hasPlayer(check) { return this.players.some(check); },
};
const get = {
	event: () => event,
	info: card => info[card.name],
	value: card => armors[card.name] || 8,
	subtypes: card => [info[card.name].subtype],
	equipValueNumber: card => armors[card.name] ?? 0,
	name: card => card.name,
	attitude: (_, target) => target.attitude,
};
const stock = loadSkill(hostSource, 'twjuxiang', { get }).subSkill.global;
const original = stock.check;
const lib = { skill: { twjuxiang_global: stock } };
const moduleUrl = source => 'data:text/javascript,'+encodeURIComponent(source);
const runtimeUrl = moduleUrl('export let lib, game, get; export function setup(values) { ({lib, game, get} = values); }');
(await import(runtimeUrl)).setup({ lib, game, get });
const rulesUrl = new URL('../score/decision/skills/rules/shenhuaLei.js', import.meta.url).href;
const packUrl = new URL('../score/decision/skills/packs/shenhuaLei.js', import.meta.url);
const packSource = (await readFile(packUrl, 'utf8'))
	.replace(/\.\.\/policyCore\.js\?[^']+/, runtimeUrl)
	.replace(/\.\.\/rules\/shenhuaLei\.js\?[^']+/, rulesUrl);
const { pack } = await import(moduleUrl(packSource));
const undo = [];
const wrapperHost = {
	wrap(object, name, tag, build) {
		assert.equal(tag, 'twjuxiang:check');
		const old = object[name], wrapped = build(old);
		object[name] = wrapped;
		undo.push(() => { if (object[name] === wrapped) object[name] = old; });
	},
};
assert.equal(original(armor), 7.5, 'Stock AI pays positive value for the equipped armor');
pack.install(wrapperHost, {});
assert.equal(stock.check(armor), 0, 'Keep sole Bagua when a 1 HP donor is in enemy range and recipient is healthy');
assert.equal(stock.check(handArmor), 7.5, 'A hand or detached card is outside this equipped armor adjustment');
donor.cards = [virtualArmor];
assert.equal(stock.check(virtualArmor), 7.5, 'Virtual equipment keeps stock behavior');
donor.cards = [armor];
donor.cards.push(otherArmor);
assert.equal(stock.check(armor), 7.5, 'Alternative equipped armor keeps stock behavior');
donor.cards.pop();
donor.tags.add('noe');
assert.equal(stock.check(armor), 7.5, 'Losing an equip can benefit the donor');
donor.tags.clear();
donor.hujia = 1;
assert.equal(stock.check(armor), 7.5, 'Donor has additional armor');
donor.hujia = 0;
donor.hp = 2;
assert.equal(stock.check(armor), 7.5, 'Donor has more than one HP');
donor.hp = 1;
donor.hand = 1;
assert.equal(stock.check(armor), 7.5, 'With hand cards the donor may still have a response');
donor.hand = 0;
lord.hp = 1;
assert.equal(stock.check(armor), 7.5, 'Donor can still support a critically wounded lord');
lord.hp = 3;
lord.open = false;
lord.disabled = true;
assert.equal(stock.check(armor), 7.5, 'Disabled slot recovery remains independent of direct equip policy');
lord.open = true;
lord.equipLegal = false;
assert.equal(stock.check(armor), 7.5, 'Host rejected direct equip is outside this survival estimator');
lord.equipLegal = true;
lord.attitude = -4;
assert.equal(stock.check(armor), 7.5, 'No new rule overrides stock target scoring for a hostile recipient');
lord.attitude = 6;
enemy.canThreaten = false;
assert.equal(stock.check(armor), 7.5, 'Without a hostile attack in range, leave stock choice');
enemy.canThreaten = true;
event.skill = 'other';
assert.equal(stock.check(armor), 7.5, 'Outside the actual skill selection event use stock');
event.skill = 'twjuxiang_global';
game.players.push({ ...lord });
assert.equal(stock.check(armor), 7.5, 'Multiple legal recipients preserve stock choice');
game.players.pop();
assert.equal(stock.check({ name: 'zhuge' }), 8, 'Dynamic offensive equipment keeps stock choice');
pack.install(wrapperHost, {});
assert.equal(undo.length, 1, 'Repeated installation does not wrap twice');
undo.pop()();
assert.equal(stock.check, original, 'Uninstall restores original callback');
pack.install(wrapperHost, {});
const foreign = () => 11;
stock.check = foreign;
undo.pop()();
pack.install(wrapperHost, {});
assert.equal(stock.check, foreign, 'Preserve a third-party check');
console.log('PASS twjuxiang stock scoring, survival veto, branch and scope controls, lifecycle');
