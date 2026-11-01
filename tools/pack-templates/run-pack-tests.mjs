import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const run = script => {
	const output = execFileSync(process.execPath, [path.join(HERE, script)], { cwd: path.dirname(HERE), encoding: 'utf8' });
	process.stdout.write(output);
	const last = output.trim().split('\n').pop() || '';
	if (!/^ALL PASS \(\d+\)$/.test(last)) throw new Error('unexpected test summary: ' + last);
	return Number((last.match(/\((\d+)\)/) || [])[1] || 0);
};

const total = run('test-pack-rules.mjs') + run('test-pack-architecture.mjs');
console.log('ALL PACK TESTS PASS (' + total + ')');
