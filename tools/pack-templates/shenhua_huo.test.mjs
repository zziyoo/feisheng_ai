import assert from 'node:assert/strict';
import { pack } from '../source/score/decision/skills/packs/shenhuaHuo.js';
import { SHENHUA_HUO_POLICY_RULES } from '../source/score/decision/skills/rules/shenhuaHuo.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };

check('火包不注册任何连环覆盖', () => {
	assert.equal(pack.id, 'shenhua_huo');
	assert.deepEqual(pack.skills, []);
	assert.equal(typeof pack.install, 'function');
	assert.deepEqual(Object.keys(SHENHUA_HUO_POLICY_RULES), []);
});
check('空安装入口不接触宿主对象', () => {
	let touched = false;
	pack.install({ get wrap() { touched = true; } }, {});
	assert.equal(touched, false);
});
console.log('ALL PASS (' + passed + ')');
