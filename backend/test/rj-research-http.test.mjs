import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createRjResearchHttpHandler,RJ_RESEARCH_PATH}
  from '../src/rj-research-http.mjs';
import {createRjDynamicResearchAgent}
  from '../src/blaise-rj-dynamic-research.mjs';

const NOW=Date.parse('2026-11-13T18:00:00Z');
const payload=()=>({
  question:'Qual é a situação de El Niño atualmente?',
  geography:'GLOBAL_CLIMA_RELEVANTE_RJ',timeZone:'America/Sao_Paulo',
  requestedAt:new Date(NOW).toISOString()
});
function req(body=payload()) {
  const stream=Readable.from([Buffer.from(JSON.stringify(body))]);
  return Object.assign(stream,{url:RJ_RESEARCH_PATH,method:'POST',
    headers:{'content-type':'application/json; charset=utf-8'}});
}
function res(){
  return {statusCode:200,headers:{},body:null,
    setHeader(k,v){this.headers[k]=v;},
    end(v){this.body=JSON.parse(v);}
  };
}
function agent(){
  return createRjDynamicResearchAgent({
    enabled:true,now:()=>NOW,
    retrieve:async()=>[{
      id:'noaa-climate',sourceId:'noaa',kind:'CLIMATE_REPORT',
      url:'https://www.climate.gov/news-features/understanding-climate',
      issuedAt:new Date(NOW-3600000).toISOString(),
      geography:'GLOBAL_CLIMA_RELEVANTE_RJ',
      excerpt:'Uma publicação científica NOAA em data conhecida avalia os indicadores atuais de oscilação climática.'
    }],
    compose:async()=>({
      answer:'Os documentos meteorológicos precisam ser interpretados com horário de publicação e escopo regional.',
      usedEvidenceIds:['noaa-climate']
    })
  });
}
test('research route is disabled without authorized retrieval, entitlement and abuse control',async()=>{
  let calls=0;
  const handler=createRjResearchHttpHandler(()=>{},{
    enabled:true,agent:agent(),clock:()=>NOW,
    verifySubscriber:async()=>{calls++;return {subject:'paid-user-123',isActive:true};}
  });
  const result=res();
  await handler(req(),result);
  assert.equal(result.statusCode,503);
  assert.equal(calls,0);
  assert.equal(result.headers['Cache-Control'],'no-store');
});
test('subscription and throttling are checked before reading user question',async()=>{
  const base={enabled:true,agent:agent(),clock:()=>NOW,
    rateLimit:async()=>true,approveSynthesis:async()=>true};
  const denied=createRjResearchHttpHandler(()=>{},{...base,
    verifySubscriber:async()=>({subject:'not-paying',isActive:false})});
  const deniedRes=res();await denied(req(),deniedRes);
  assert.equal(deniedRes.statusCode,403);
  const throttled=createRjResearchHttpHandler(()=>{},{...base,
    verifySubscriber:async()=>({subject:'paid-user-123',isActive:true}),
    rateLimit:async()=>false});
  const throttledRes=res();await throttled(req(),throttledRes);
  assert.equal(throttledRes.statusCode,429);
});
test('synthetic sources cannot be returned without independent semantic verification',async()=>{
  const handler=createRjResearchHttpHandler(()=>{},{
    enabled:true,agent:agent(),clock:()=>NOW,
    verifySubscriber:async()=>({subject:'paid-user-123',isActive:true}),
    rateLimit:async()=>true,approveSynthesis:async()=>false
  });
  const result=res();await handler(req(),result);
  assert.equal(result.statusCode,503);
  assert.equal(result.body.error,'research_not_semantically_verified');
});
test('authorized on-demand climate response includes actual date and citation identifiers',async()=>{
  const handler=createRjResearchHttpHandler(()=>{},{
    enabled:true,agent:agent(),clock:()=>NOW,
    verifySubscriber:async()=>({subject:'paid-user-123',isActive:true}),
    rateLimit:async()=>true,approveSynthesis:async()=>true
  });
  const result=res();await handler(req(),result);
  assert.equal(result.statusCode,200);
  assert.equal(result.body.status,'ANSWER_WITH_CITATIONS');
  assert.equal(result.body.officialAlert,false);
  assert.equal(result.body.evidence[0].sourceId,'noaa');
  assert.equal(result.body.geography,'GLOBAL_CLIMA_RELEVANTE_RJ');
});
test('old question timestamp is rejected even if provider is active',async()=>{
  const handler=createRjResearchHttpHandler(()=>{},{
    enabled:true,agent:agent(),clock:()=>NOW,
    verifySubscriber:async()=>({subject:'paid-user-123',isActive:true}),
    rateLimit:async()=>true,approveSynthesis:async()=>true
  });
  const result=res();await handler(req({...payload(),
    requestedAt:'2025-01-01T00:00:00Z'}),result);
  assert.equal(result.statusCode,400);
  assert.equal(result.body.error,'invalid_question_timestamp');
});
