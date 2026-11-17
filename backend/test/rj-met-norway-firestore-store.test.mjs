import test from 'node:test';
import assert from 'node:assert/strict';
import {createRjMetNorwayFirestoreStore} from '../src/rj-met-norway-firestore-store.mjs';
import {MET_NORWAY_MIN_CACHE_MS} from '../src/rj-met-norway-locationforecast.mjs';

const NOW=Date.parse('2026-11-17T15:00:00Z');
function fakeDatabase(){
  const state=new Map();let transactionQueue=Promise.resolve();
  const doc=(name,key)=>{
    const id=name+'/'+key;
    return {id,async get(){return {exists:state.has(id),data:()=>structuredClone(state.get(id))};}};
  };
  return {
    collection(name){return {doc:(id)=>doc(name,id)};},
    async runTransaction(fn){
      const transaction=async()=>{
        const updates=[];
        const tx={
          async get(ref){return ref.get();},
          set(ref,data){updates.push([ref.id,structuredClone(data)]);}
        };
        const result=await fn(tx);
        for(const [id,value] of updates)state.set(id,value);
        return result;
      };
      const result=transactionQueue.then(transaction,transaction);
      transactionQueue=result.then(()=>{},()=>{});
      return result;
    }
  };
}
const payload={
  type:'Feature',geometry:{coordinates:[-43.1729,-22.9068]},
  properties:{meta:{updated_at:new Date(NOW).toISOString()},timeseries:[
    {time:new Date(NOW).toISOString(),data:{instant:{details:{air_temperature:28}}}}
  ]}
};
test('one atomic reserve per city per 3h even across concurrent backend replicas',async()=>{
  const db=fakeDatabase();
  let now=NOW;
  const a=createRjMetNorwayFirestoreStore({db,clock:()=>now});
  const b=createRjMetNorwayFirestoreStore({db,clock:()=>now});
  const results=await Promise.all(Array.from({length:30},(_,i)=>
    (i%2?a:b).reserve('3304557',now,MET_NORWAY_MIN_CACHE_MS)));
  assert.equal(results.filter(Boolean).length,1);
  assert.equal(await a.reserve('3304557',now+MET_NORWAY_MIN_CACHE_MS-1,MET_NORWAY_MIN_CACHE_MS),false);
  now+=MET_NORWAY_MIN_CACHE_MS;
  assert.equal(await b.reserve('3304557',now,MET_NORWAY_MIN_CACHE_MS),true);
});
test('safe payload can be read by another replica; no client GPS or user data stored',async()=>{
  const db=fakeDatabase();const store=createRjMetNorwayFirestoreStore({db,clock:()=>NOW});
  assert.equal(await store.reserve('3304557',NOW,MET_NORWAY_MIN_CACHE_MS),true);
  await store.set('3304557',{payload,lastModified:'Tue, 17 Nov 2026 15:00:00 GMT',
    nextAllowedAtMs:NOW+MET_NORWAY_MIN_CACHE_MS});
  const other=createRjMetNorwayFirestoreStore({db,clock:()=>NOW});
  const record=await other.get('3304557');
  assert.equal(record.payload.properties.timeseries.length,1);
  assert.equal(record.nextAllowedAtMs,NOW+MET_NORWAY_MIN_CACHE_MS);
  assert.equal(store.persistentCoordinatesStored,false);
  assert.equal(store.automaticTtlDeletion,false);
});
test('invalid municipality, missing reserved transaction, corrupted input and short interval all fail closed',async()=>{
  const store=createRjMetNorwayFirestoreStore({db:fakeDatabase(),clock:()=>NOW});
  await assert.rejects(()=>store.reserve('0000000',NOW,MET_NORWAY_MIN_CACHE_MS));
  await assert.rejects(()=>store.reserve('3304557',NOW,60_000));
  await assert.rejects(()=>store.set('3304557',{
    payload,nextAllowedAtMs:NOW+MET_NORWAY_MIN_CACHE_MS}));
});
