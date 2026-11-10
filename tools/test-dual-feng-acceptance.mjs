import assert from 'node:assert/strict';
import { evaluateDualAcceptance } from './dual-feng-acceptance.mjs';
const evidence = {baseline:{head:'fcc9eb2581e9470e228dea112add930fa0be0e07',status:'PASS'},runtime_equivalent:true,installer_sha256:'a'.repeat(64),installer_tests:{passed:18,failed:0},package_tests:{total:39,passed:39,failed:0},package_assertions:Array.from({length:39},()=>({pass:true})),archive_checks:'PASS'};
const inputs={installer_sha256:'a'.repeat(64),runtime_equivalent:true,clean_source:true};
assert.equal(evaluateDualAcceptance(evidence,inputs).can_mark_deliverable,true);
for (const changed of [{...evidence,package_tests:null},{...evidence,installer_tests:{passed:17,failed:1}},{...evidence,baseline:{...evidence.baseline,status:'FAIL'}}]) assert.equal(evaluateDualAcceptance(changed,inputs).can_mark_deliverable,false);
for (const changed of [{...inputs,runtime_equivalent:false},{...inputs,clean_source:false},{...inputs,installer_sha256:'b'.repeat(64)}]) assert.equal(evaluateDualAcceptance(evidence,changed).can_mark_deliverable,false);
const result=evaluateDualAcceptance(evidence,inputs); assert.equal(result.external_integration_receipt,'pending'); assert.equal(result.baseline_acceptance.status,'PASS'); assert.equal(result.publication_status,'未发布');
console.log('PASS: evidence gates, missing evidence, changed inputs, pending receipt');
