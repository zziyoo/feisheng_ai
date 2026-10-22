// Child process for the historical sample startup path; all storage is a Map.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {register} from 'node:module';
const key='djsc_training_samples_v1',raw=fs.readFileSync(0,'utf8'),memory=new Map([[key,raw]]);
let wrote;const saved=new Promise(resolve=>{wrote=resolve;});
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{memory.set(k,String(v));if(k===key)wrote();},removeItem:k=>memory.delete(k)};
globalThis.__NONAME_STUB={lib:{config:{}},game:{},get:{mode:()=> 'doudizhu'},_status:{}};
register('./noname-stub-loader.mjs',import.meta.url);
const training=await import('../score/model/train/trainExport.js?v=41a');
let timer;try{await Promise.race([saved,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('startup persistence timeout')),5000);})]);}finally{clearTimeout(timer);}
const rows=training.getSamples(),stored=JSON.parse(memory.get(key));
assert.equal(rows.length,1);assert.equal(rows[0].f.length,134);assert.equal(rows[0]._dimAdapted,true);
assert.deepEqual(rows[0]._missingFeatureIndices,[130,131,132,133]);
assert.equal(stored.length,1);assert.equal(stored[0]._originalDim,130);assert.equal(stored[0].f.length,134);
console.log('Cold startup historical adaptation persisted without fabricating identity');process.exit(0);
