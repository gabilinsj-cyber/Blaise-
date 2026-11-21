/**
 * Executes solely against an explicitly started LOCAL Firebase emulator.
 * No production project credentials are required or used by this file.
 */
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc}
 from 'firebase/firestore';

if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8185')
 throw Error('local_firestore_emulator_required');
const rules=readFileSync('./active-firestore.rules','utf8');
const env=await initializeTestEnvironment({
 projectId:'demo-blaise-vc-firestore-rules',
 firestore:{host:'127.0.0.1',port:8185,rules}
});
const specs=[
 ['cache','blaise_rj_visual_crossing_free_private_weather_v1','3304557'],
 ['future_budget','blaise_rj_vc_free_92_future_budget_v1','day_2026-11-19'],
 ['trial_budget','blaise_rj_visual_crossing_free_trial_budget_v1','staging_one_rio_20261119']
];
const items=[];
try{
 for(const [name,col,id] of specs){
  for(const [actor,ctx] of [
   ['anonymous',env.unauthenticatedContext()],
   ['ordinary_user',env.authenticatedContext('client_test_not_admin',{email_verified:false})]
  ]){
   const client=ctx.firestore();
   const target=doc(client,col,id);
   await env.withSecurityRulesDisabled(async c=>
    setDoc(doc(c.firestore(),col,id),{privateTestMarker:true}));
   const checks=[
    ['get',()=>getDoc(target)],
    ['list',()=>getDocs(collection(client,col))],
    ['create',()=>setDoc(doc(client,col,'__probe_'+actor),{privateTestMarker:true})],
    ['update',()=>updateDoc(target,{privateTestMarker:false})],
    ['delete',()=>deleteDoc(target)]
   ];
   for(const [op,work] of checks){
    let verdict='ALLOWED';
    try{await work()}
    catch(e){
     verdict=e?.code==='permission-denied'||e?.code==='firestore/permission-denied'
      ?'DENIED':'ERROR';
    }
    items.push({collection:name,actor,operation:op,result:verdict});
   }
  }
 }
 const unexpected=items.filter(x=>x.result!=='DENIED');
 console.log('BLAISE_VC_LOCAL_SECURITY_RESULTS='+JSON.stringify({
  state:unexpected.length===0?'SIMULATED_CLIENTS_DENIED':'ACCESS_RISK_OR_TEST_ERROR',
  testCases:items.length,denied:items.filter(x=>x.result==='DENIED').length,
  unexpected,productionChanged:false,productionDocumentsRead:false,
  cloudWeatherCalls:0,manualRulesAndIamReviewStillRequired:true
 }));
 if(unexpected.length)process.exitCode=3;
}finally{await env.cleanup();}
