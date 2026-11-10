import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-feng-metadata-'));
try {
  for (const id of ['shenhua_feng', 'refresh_feng']) {
    const run = spawnSync(process.execPath, ['tools/build-skill-ai-pack.mjs', '--pack', id, '--out', root, '--worktree-source'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const stage = path.join(root, '.stage', id);
    for (const name of ['pack.json', 'checklist.json', 'manifest.json']) {
      const file = JSON.parse(fs.readFileSync(path.join(stage, name), 'utf8'));
      const meta = name === 'manifest.json' ? file.package : file;
      assert.equal(meta.baseline_acceptance.head, 'fcc9eb2581e9470e228dea112add930fa0be0e07');
      assert.equal(meta.baseline_acceptance.status, 'PASS');
      assert.equal(meta.delivery_status, '候选待验收');
      assert.equal(meta.external_integration_receipt, 'pending');
    }
    for (const name of ['README.md', 'checklist.md', 'ACCEPTANCE.md', 'COMMANDS.md']) {
      const text = fs.readFileSync(path.join(stage, name), 'utf8');
      assert(text.includes('fcc9eb2') && text.includes('候选待验收'), `${id}/${name}`);
    }
    console.log('PASS ' + id);
  }
} finally { fs.rmSync(root, { recursive: true, force: true }); }
