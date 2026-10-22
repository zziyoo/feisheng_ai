// Synthetic data + in-memory host storage. No user saves, network or formal training.
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const memory=new Map();let rejectWrites=false;
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(rejectWrites)throw Error('audit quota');memory.set(k,String(v));},removeItem:k=>memory.delete(k)};
const stub={lib:{config:{}},game:{},get:{mode:()=> 'doudizhu'},_status:{mode:'normal'},ui:{},ai:{}};
globalThis.__NONAME_STUB=stub;register('./model-lifecycle-test-loader.mjs',import.meta.url);
const weights=await import('../score/model/weights/weights.js?v=41a');
const store=await import('../score/model/weights/modeModelStore.js?v=41a');await store.modeModelsReady;
const adapter=await import('../score/model/features/dimensionAdapter.js?v=41a');
const dataset=await import('../score/model/train/modeDataset.js?v=41a');
const publicBefore=weights.__snapshotModel();
const snapshot=weights.createIsolatedModelSession(null,{useResidual:false,floatTraining:true}).snapshot();
const record=id=>({id,createdAt:1,snapshot,networkProfile:{useResidual:false},ruleKeys:['audit-rule']});
const context={schema:'mode-context-v1',captured:true,mode:'doudizhu',submode:'normal',group:'doudizhu-classic',collect:true,role:'farmer',ruleKey:'audit-rule',ruleVersion:1,featureVersion:130};
function sample(dim=134,session='audit-session',tx='audit-tx',role='farmer'){
 return {f:Array(dim).fill(1),r:36,value_target:.25,m:{modeContext:{...context,role,featureVersion:dim},player:'audit-hero',type:'card',id:'sha',actorId:'actor',sessionId:session,transactionId:tx,
  rewardSchema:'action-outcome-v1',executionState:'committed',rewardStatus:'observed',observedReward:3,
  actionOutcome:{normalization:12,attribution:'host-event-window',deltas:[{playerId:'actor',camp:1,hp:1,hand:0,equip:0,judging:0,alive:0,linked:0,turned:0,wine:0}]}}};
}
let pass=0,fail=0;
async function check(name,fn){try{await fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+'\n'+e.stack);}}
await check('134 float snapshot decodes with full moments',()=>{const s=store.decodeModeSnapshot(store.encodeModeSnapshot(snapshot));assert.equal(s.W1.length,17152);assert.equal(s.W_proj1.length,17152);assert(s.W1 instanceof Float32Array);});
await check('save, reload, activate two versions and rollback preserve model',async()=>{
 assert((await store.saveClassicCandidateDurable(record('v1'))).ok);assert((await store.promoteClassicCandidateDurable()).ok);
 assert((await store.saveClassicCandidateDurable(record('v2'))).ok);assert((await store.promoteClassicCandidateDurable()).ok);
 const restarted=await import('../score/model/weights/modeModelStore.js?lifecycle-restart');await restarted.modeModelsReady;
 assert.equal(restarted.classicCandidateInfo().id,'v2');assert.equal(restarted.classicActiveInfo().previousId,'v1');
 assert((await restarted.rollbackClassicActiveDurable()).ok);assert.equal(restarted.classicActiveInfo().id,'v1');
 assert.deepEqual(weights.__snapshotModel(),publicBefore);
});
await check('malformed 130 model reports field and sizes without replacing valid candidate',async()=>{
 assert((await store.saveClassicCandidateDurable(record('safe'))).ok);
 const broken=structuredClone(snapshot);broken.W1=broken.W1.slice(0,16640);
 const result=await store.saveClassicCandidateDurable({...record('bad'),snapshot:broken});
 assert.equal(result.ok,false);assert.match(result.err,/W1/);assert.match(result.err,/17152/);assert.match(result.err,/16640/);assert.equal(store.classicCandidateInfo().id,'safe');
 assert.equal(store.createClassicActiveSession({...record('bad'),schema:'classic-candidate-v1',featureDim:134,modelVersion:7,snapshot:store.encodeModeSnapshot(broken)}),null);
});
await check('corrupt moments and nonfinite parameters are rejected',async()=>{
 for(const [key,kind] of [['mW1','short'],['vB4','negative'],['W2','nan']]){
  const broken=structuredClone(snapshot);if(kind==='short')broken[key]=broken[key].slice(1);else broken[key][0]=kind==='nan'?NaN:-1;
  assert.equal(store.decodeModeSnapshot(store.encodeModeSnapshot(broken)),null);assert.equal((await store.saveClassicCandidateDurable({...record('bad'),snapshot:broken})).ok,false);
 }
 assert.deepEqual(weights.__snapshotModel(),publicBefore);
});
await check('failed storage write keeps active version and candidate unchanged',async()=>{
 const prior=store.classicCandidateInfo()?.id,active=store.classicActiveInfo()?.id;rejectWrites=true;
 try{assert.equal((await store.saveClassicCandidateDurable(record('quota'))).ok,false);}finally{rejectWrites=false;}
 assert.equal(store.classicCandidateInfo()?.id,prior);assert.equal(store.classicActiveInfo()?.id,active);assert.deepEqual(weights.__snapshotModel(),publicBefore);
});
await check('cold localStorage restore reports incompatible fields and retains raw records',async()=>{
 const key='djsc_classic_doudizhu_model_v1',before=memory.get(key),bad=JSON.parse(before);bad.snapshot.W1=bad.snapshot.W1.slice(0,16640);const raw=JSON.stringify(bad);memory.set(key,raw);
 try{const restored=await import('../score/model/weights/modeModelStore.js?bad-legacy-restore');await restored.modeModelsReady;
  assert.equal(restored.classicCandidateInfo(),null);assert.match(restored.classicModelStorageStatus().error,/W1.*17152.*16640/);assert.equal(memory.get(key),raw);
 }finally{memory.set(key,before);}
});
await check('damaged cached candidate cannot silently use public weights or replace stable',async()=>{
 assert((await store.saveClassicCandidateDurable(record('cache-safe'))).ok);const active=store.classicActiveInfo()?.id;
 store.loadClassicCandidate().snapshot.W1.pop();
 assert.equal(store.createClassicCandidateSession(),null);assert.equal((await store.promoteClassicCandidateDurable()).ok,false);assert.equal(store.classicActiveInfo()?.id,active);
 assert((await store.saveClassicCandidateDurable(record('safe'))).ok);
});
await check('130 Array/TypedArray preserve values and label missing identity features',()=>{
 for(const f of [Array(130).fill(1.5),new Float32Array(130).fill(1.5),new Int8Array(130).fill(1)]){
  const raw={f},r=adapter.adaptToCurrentDim(raw);assert.equal(r.error,undefined);assert.equal(r.sample.f.length,134);assert.equal(r.sample.f[0],f[0]);
  assert.equal(r.sample._dimAdapted,true);assert.equal(r.sample._originalDim,130);assert.deepEqual(r.sample._missingFeatureIndices,[130,131,132,133]);assert.deepEqual(Array.from(r.sample.f).slice(130),[0,0,0,0]);assert.equal(raw.f.length,130);
 }
});
await check('134 identity features survive, malformed and experimental vectors rejected',()=>{
 const raw=sample();raw.f[133]=127;assert.strictEqual(adapter.adaptToCurrentDim(raw).sample,raw);
 for(const f of [Array(142).fill(1),Array(129).fill(1),Array(130).fill(NaN),null])assert(adapter.adaptToCurrentDim({f}).error);
 assert.equal(adapter.adaptToCurrentDim({f:Array(142).fill(1),featureDim:134}).error,'unsupported-dim');
 assert.equal(adapter.adaptToCurrentDim({f:Array(134).fill(1),featureDim:142}).error,'unsupported-dim');
});
await check('strict dataset accepts compatible historical Array and TypedArray',()=>{
 for(const f of [Array(130).fill(1),new Int8Array(130).fill(1),new Float32Array(134).fill(1)]){
  const s=sample(f.length);s.f=f;const d=dataset.selectClassicDataset([s]);assert.equal(d.stats.accepted,1);assert.equal(d.samples[0].f.length,134);
 }
 const pending=sample(130);pending.m.rewardStatus='pending';assert.equal(dataset.selectClassicDataset([pending]).stats.accepted,0);
 assert.equal(dataset.selectClassicDataset([sample(142)]).stats.accepted,0);
});
const training=await import('../score/model/train/trainExport.js?v=41a');await new Promise(r=>setTimeout(r,0));
await check('normal import accepts 130 with durable adaptation markers and rejects 142',()=>{
 const r=training.importFromJson(JSON.stringify({samples:[sample(130,'legacy','legacy'),sample(134,'modern','modern'),sample(142,'experimental','experimental')]}));
 assert.equal(r.added,2);assert.equal(r.repairedReward,0);assert.equal(r.adaptedCount,1);const s=training.getSamples().find(s=>s.m.sessionId==='legacy');assert.equal(s.f.length,134);assert.equal(s._originalDim,130);assert.deepEqual(s._missingFeatureIndices,[130,131,132,133]);
 assert.equal(dataset.selectClassicDataset([s]).stats.dimAdaptedCount,1);
 const again=training.importFromJson(JSON.stringify({samples:[s]}));assert.equal(again.added,0);assert.equal(again.merged,1);assert.equal(training.getSamples().find(s=>s.m.sessionId==='legacy')._dimAdapted,true);
});
await check('cold startup adapts and persists historical samples through production loader',()=>{
 const p=spawnSync(process.execPath,[fileURLToPath(new URL('./model-lifecycle-test-cold-start.mjs',import.meta.url))],{input:JSON.stringify([sample(130)]),encoding:'utf8'});
 assert.equal(p.status,0,p.stdout+p.stderr);
});
// The real training orchestration is exercised, but its optimizer is a no-op on
// synthetic data. Real model inference, split, reports, storage and quality gates run.
globalThis.__LIFECYCLE_SESSION_FACTORY=(seed,profile)=>{const session=weights.createIsolatedModelSession(seed,profile);return {...session,trainBatch:rows=>rows.length};};
const mode=await import('../score/model/train/modeTraining.js?v=41a');
let trainedRecord;
await check('training report persists complete split metadata and validates after storage reload',async()=>{
 const rows=Array.from({length:4500},(_,i)=>sample(134,'session-'+Math.floor(i/30),'transaction-'+i,Math.floor(i/30)%2?'farmer':'landlord'));
 const imported=training.importFromJson(JSON.stringify({samples:rows}));assert.equal(imported.added,4500);
 const result=await mode.trainClassicCandidate();assert.equal(result.ok,true,result.err);const c=store.loadClassicCandidate();trainedRecord=structuredClone(c);
 assert(c.report.splitMetadata);assert.deepEqual(c.report.holdoutSessions,c.report.splitMetadata.holdoutSessions);assert.equal(c.report.validation,c.report.splitMetadata.validationSamples);
 const reloaded=await import('../score/model/weights/modeModelStore.js?report-restart');await reloaded.modeModelsReady;
 assert.deepEqual(reloaded.loadClassicCandidate().report.splitMetadata,c.report.splitMetadata);
 const validated=await mode.validateClassicCandidate();assert.equal(validated.ok,true,validated.err);assert.equal(validated.result.count,c.report.validation);
 assert.deepEqual(weights.__snapshotModel(),publicBefore);
});
await check('valid complete holdout activates without enabling unrelated model switches',async()=>{
 const result=await mode.activateClassicCandidate({enable:false});assert.equal(result.ok,true,result.err);assert.equal(store.classicActiveInfo().id,trainedRecord.id);assert.equal(stub.lib.config.extension_无名AI_classicModelEnabled,undefined);
});
await check('missing holdout session, partial row count or conflicting metadata cannot activate',async()=>{
 assert(trainedRecord,'training report required');const active=store.classicActiveInfo().id;
 for(const mutate of [c=>{delete c.report.holdoutSessions;delete c.report.splitMetadata;},c=>{c.report.holdoutSessions=[];},c=>{delete c.report.splitMetadata.holdoutSessions;},c=>{c.report.splitMetadata.holdoutSessions=null;},c=>{c.report.splitMetadata.holdoutSessions.push('missing-session');c.report.holdoutSessions.push('missing-session');},c=>{c.report.validation++;},c=>{c.report.splitMetadata.validationSamples++;}]){
  const candidate=structuredClone(trainedRecord);candidate.id='incomplete';mutate(candidate);assert((await store.saveClassicCandidateDurable(candidate)).ok);
  const checked=await mode.validateClassicCandidate();assert.equal(checked.ok,false,JSON.stringify(checked));const activated=await mode.activateClassicCandidate({enable:false});assert.equal(activated.ok,false);assert.equal(store.classicActiveInfo().id,active);
 }
 assert.deepEqual(weights.__snapshotModel(),publicBefore);
});
await check('new split metadata cannot substitute trained sessions for original holdout',()=>{
 assert(trainedRecord);const report=structuredClone(trainedRecord.report),original=new Set(report.holdoutSessions);
 const index=report.holdoutSessions.findIndex(id=>id.startsWith('session-'));
 const other=training.getSamples().find(s=>s.m.sessionId.startsWith('session-')&&!original.has(s.m.sessionId)).m.sessionId;
 report.holdoutSessions[index]=other;report.splitMetadata.holdoutSessions[index]=other;
 assert.equal(dataset.classicHoldoutDataset(dataset.selectClassicDataset(training.getSamples()).samples,report,['audit-rule']).ok,false);
});
await check('partial validation rows are refused and original top-level-only reports remain readable',async()=>{
 const report=structuredClone(trainedRecord.report),data=dataset.selectClassicDataset(training.getSamples()).samples;
 delete report.splitMetadata;assert.equal(dataset.classicHoldoutDataset(data,report,['audit-rule']).ok,true);
 const row=data.findIndex(s=>report.holdoutSessions.includes(s.m.sessionId));
 assert.equal(dataset.classicHoldoutDataset(data.filter((_,i)=>i!==row),report,['audit-rule']).ok,false);
 const missingSession=data.filter(s=>s.m.sessionId!==report.holdoutSessions[0]);
 assert.equal(dataset.classicHoldoutDataset(missingSession,report,['audit-rule']).ok,false);
});
console.log(`Model lifecycle: ${pass} passed, ${fail} failed`);process.exit(fail?1:0);
