// Real Chromium IndexedDB + browser restarts. Synthetic models only, temporary
// profile, intercepted local-source requests; no game/user profile/server access.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const args=process.argv.slice(2),option=k=>{const i=args.indexOf('--'+k);return i<0?null:args[i+1];};
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url),{chromium}=require(option('playwright')||'playwright');
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'wuming-lifecycle-'));
const origin='http://lifecycle.invalid';let browser,unexpectedRequests=0;
const stub=`export const lib={config:{}};export const game={};export const get={mode:()=> 'doudizhu'};export const _status={};export const ai={};export const ui={};`;
async function start(){
 browser=await chromium.launchPersistentContext(profile,{headless:true,...(option('browser')?{executablePath:option('browser')}:{})});
 await browser.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==origin){unexpectedRequests++;return route.abort();}
  if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated model lifecycle</title>'});
  if(url.pathname.endsWith('/noname.js'))return route.fulfill({contentType:'text/javascript',body:stub});
  const filename=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!filename.startsWith(path.resolve(root)+path.sep))return route.abort();
  try{return await route.fulfill({contentType:'text/javascript',body:await fs.readFile(filename)});}catch{return route.fulfill({status:404,body:'missing test source'});}
 });
 const page=await browser.newPage();await page.goto(origin+'/');
 await page.evaluate(async()=>{
  window.w=await import('/score/model/weights/weights.js?v=41a');
  window.s=await import('/score/model/weights/modeModelStore.js?v=41a');await s.modeModelsReady;
  window.readRows=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('djsc_mode_models_v1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('models','readonly'),q=tx.objectStore('models').getAll();tx.oncomplete=()=>{db.close();resolve(q.result);};tx.onerror=()=>reject(tx.error);};});
 });return page;
}
const results=[];
try{
 let page=await start();
 results.push(await page.evaluate(async()=>{
  const before=JSON.stringify(w.__snapshotModel()),snapshot=w.createIsolatedModelSession(null,{floatTraining:true,useResidual:false}).snapshot();
  const record=id=>({id,createdAt:1,snapshot,networkProfile:{useResidual:false},ruleKeys:['audit-rule'],report:{holdoutSessions:['synthetic-holdout'],splitMetadata:{holdoutSessions:['synthetic-holdout'],seed:20261019,holdoutRatio:.2}}});
  const a=await s.saveClassicCandidateDurable(record('browser-v1'));if(!a.ok)throw Error(a.err);
  const p1=await s.promoteClassicCandidateDurable();if(!p1.ok)throw Error(p1.err);
  const b=await s.saveClassicCandidateDurable(record('browser-v2'));if(!b.ok)throw Error(b.err);
  const p2=await s.promoteClassicCandidateDurable();if(!p2.ok)throw Error(p2.err);
  if(JSON.stringify(w.__snapshotModel())!==before)throw Error('public model changed');
  return {step:'save-two-versions',storage:s.classicModelStorageStatus().backend,active:s.classicActiveInfo(),rows:(await readRows()).length};
 }));
 assert.equal(results[0].storage,'IndexedDB');await browser.close();browser=null;
 page=await start();
 results.push(await page.evaluate(async()=>{
  if(s.classicCandidateInfo()?.id!=='browser-v2'||s.classicActiveInfo()?.previousId!=='browser-v1')throw Error('restart lost versions');
  const metadata=s.loadClassicCandidate().report.splitMetadata;if(metadata.holdoutSessions[0]!=='synthetic-holdout')throw Error('restart lost metadata');
  const rollback=await s.rollbackClassicActiveDurable();if(!rollback.ok)throw Error(rollback.err);
  const bad=structuredClone(s.loadClassicCandidate());bad.id='rejected';bad.snapshot.W1=bad.snapshot.W1.slice(0,16640);
  const rejected=await s.saveClassicCandidateDurable(bad);if(rejected.ok||!rejected.err.includes('17152')||!rejected.err.includes('16640'))throw Error('bad model accepted or diagnostic missing');
  const before=JSON.stringify(await readRows()),original=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(name,mode,...rest){if(mode==='readwrite')throw Error('synthetic IDB write failure');return original.call(this,name,mode,...rest);};
  let failed;try{failed=await s.saveClassicCandidateDurable({...s.loadClassicCandidate(),id:'failed-write'});}finally{IDBDatabase.prototype.transaction=original;}
  if(failed.ok||JSON.stringify(await readRows())!==before)throw Error('failed write changed stored data');
  return {step:'restart-and-rollback',active:s.classicActiveInfo().id,candidate:s.classicCandidateInfo().id,metadata,rejected:rejected.err,failedWritePreservedRows:true};
 }));
 // Seed one invalid *test-owned* row to inspect cold restore rejection, without
 // modifying the valid active/previous row.
 await page.evaluate(async()=>{
  const record=structuredClone(s.loadClassicCandidate());record.snapshot.W1=record.snapshot.W1.slice(0,16640);
  await new Promise((resolve,reject)=>{const r=indexedDB.open('djsc_mode_models_v1',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('models','readwrite');tx.objectStore('models').put({key:'candidate',value:record});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};r.onerror=()=>reject(r.error);});
 });await browser.close();browser=null;
 page=await start();
 results.push(await page.evaluate(async()=>({step:'corrupt-candidate-cold-restore',candidate:s.classicCandidateInfo(),active:s.classicActiveInfo()?.id,status:s.classicModelStorageStatus(),storedCandidateW1:(await readRows()).find(r=>r.key==='candidate').value.snapshot.W1.length})));
 const restored=results[2];assert.equal(restored.candidate,null);assert.equal(restored.active,'browser-v1');assert.deepEqual(restored.status.invalidKeys,['candidate']);assert.match(restored.status.error,/W1.*17152.*16640/);assert.equal(restored.storedCandidateW1,16640);
 assert.equal(unexpectedRequests,0);
 console.log(JSON.stringify({status:'passed',scope:'real browser IndexedDB and browser process restart; synthetic models; not full game acceptance',browserVersion:browser.browser()?.version()||'persistent Chromium',unexpectedRequests,results},null,2));
}finally{
 if(browser)await browser.close();
 const resolved=path.resolve(profile);
 if(path.dirname(resolved)!==path.resolve(os.tmpdir())||!path.basename(resolved).startsWith('wuming-lifecycle-'))throw Error('unexpected temporary profile');
 await fs.rm(resolved,{recursive:true,force:true});
}
