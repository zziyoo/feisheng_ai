// Only replace the expensive optimizer used by this synthetic lifecycle test.
// Storage, dataset selection, report construction, inference and activation stay real.
import {resolve as hostResolve} from './noname-stub-loader.mjs';
const factory='export const createIsolatedModelSession=(...args)=>globalThis.__LIFECYCLE_SESSION_FACTORY(...args);';
export async function resolve(specifier,context,next){
 if(context.parentURL?.includes('/model/train/modeTraining.js')&&specifier.includes('/weights/weights.js'))
  return {url:'data:text/javascript;base64,'+Buffer.from(factory).toString('base64'),shortCircuit:true};
 return hostResolve(specifier,context,next);
}
