/* Blaise V6 RJ — isolated Firestore cap probe. No OpenWeather calls.
 * Cloud Run Job task mode: seed (897), race (2 tasks), verify (900).
 */
(async () => {
  const project = process.env.PROJECT_ID || '';
  const id = process.env.AG13_PROBE_ID || '';
  const mode = process.env.AG13_PROBE_MODE || '';
  const task = Number(process.env.CLOUD_RUN_TASK_INDEX || 0);
  const MAX = 900, INITIAL = 897;
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(project) ||
      !/^agent13_q900_[0-9]{14}_[0-9]{1,5}$/.test(id) ||
      !['seed','race','verify'].includes(mode) ||
      !Number.isInteger(task) || task < 0) throw Error('INVALID_PROBE_CONFIGURATION');
  const root = 'https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents';
  const name = 'projects/'+project+'/databases/(default)/documents/blaise_agent13_iam_probe/'+id;
  const doc = root+'/blaise_agent13_iam_probe/'+id;
  const label = 'AG13_Q900_'+id;
  const m = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    {headers:{'Metadata-Flavor':'Google'},signal:AbortSignal.timeout(12000)});
  if(!m.ok) throw Error('METADATA_TOKEN_UNAVAILABLE');
  const token = (await m.json()).access_token;
  if(typeof token !== 'string' || !token) throw Error('EMPTY_METADATA_TOKEN');
  const headers = {Authorization:'Bearer '+token, 'Content-Type':'application/json'};
  async function request(method,url,body){
    const r = await fetch(url,{method,headers,body:body === undefined ? undefined : JSON.stringify(body),
      signal:AbortSignal.timeout(15000)});
    let json = {};
    try {json=await r.json();}catch{}
    return {ok:r.ok,status:r.status,json};
  }
  async function begin(){
    const r=await request('POST',root+':beginTransaction',{options:{readWrite:{}}});
    if(!r.ok||typeof r.json.transaction!=='string') throw Error('BEGIN_HTTP_'+r.status);
    return r.json.transaction;
  }
  function write(count,exists,transaction){
    return {transaction,writes:[{update:{name,fields:{
      count:{integerValue:String(count)},maximum:{integerValue:String(MAX)},testOnly:{booleanValue:true}
    }},currentDocument:{exists}}]};
  }
  async function read(transaction){
    const r=await request('GET',doc+'?transaction='+encodeURIComponent(transaction));
    if(!r.ok) throw Error('GET_HTTP_'+r.status);
    const count=Number(r.json?.fields?.count?.integerValue);
    const maximum=Number(r.json?.fields?.maximum?.integerValue);
    if(!Number.isSafeInteger(count)||count<0||maximum!==MAX||r.json?.fields?.testOnly?.booleanValue!==true)
      throw Error('INVALID_TEST_DOCUMENT');
    return count;
  }
  const log=(message)=>console.log(label+' '+message);
  if(mode==='seed'){
    if(task!==0)throw Error('SEED_REQUIRES_ONE_TASK');
    const txn=await begin();
    const result=await request('POST',root+':commit',write(INITIAL,false,txn));
    if(!result.ok)throw Error('SEED_COMMIT_HTTP_'+result.status);
    log('SEED_OK initial='+INITIAL);
    return;
  }
  if(mode==='race'){
    let accepted=0,rejected=0;
    // Two separate Cloud Run job tasks share one Firestore document.
    for(let i=0;i<12;i++){
      let settled=false;
      for(let attempt=0;attempt<35;attempt++){
        const txn=await begin();
        let count;
        try{ count=await read(txn); }
        catch(e){
          if(String(e.message).includes('GET_HTTP_409')){
            await new Promise(r=>setTimeout(r,Math.min(400,20+attempt*12+Math.random()*80)));
            continue;
          }
          throw e;
        }
        if(count>=MAX){rejected++;settled=true;break;}
        const commit=await request('POST',root+':commit',write(count+1,true,txn));
        if(commit.ok){accepted++;settled=true;break;}
        if(commit.status===409||commit.json?.error?.status==='ABORTED'){
          await new Promise(r=>setTimeout(r,Math.min(400,20+attempt*12+Math.random()*80)));
          continue;
        }
        throw Error('COMMIT_HTTP_'+commit.status);
      }
      if(!settled)throw Error('CONFLICT_RETRY_EXHAUSTED');
    }
    log('TASK_'+task+'_DONE accepted='+accepted+' rejected='+rejected);
    return;
  }
  if(mode==='verify'){
    if(task!==0)throw Error('VERIFY_REQUIRES_ONE_TASK');
    const txn=await begin();
    const count=await read(txn);
    log('VERIFY count='+count+' maximum='+MAX+' expected=900');
    if(count!==MAX)throw Error('CAP_INCORRECT');
    log('PASS_NO_OPENWEATHER_CALLED');
  }
})().catch(e=>{
  console.error('AG13_Q900_PROBE_FAILED '+String(e?.message||'UNKNOWN'));
  process.exitCode=1;
});
