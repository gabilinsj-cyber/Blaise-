import {mkdir,writeFile} from 'node:fs/promises';

// Read-only evidence from documented interfaces. Outages are recorded, never turned into data.
const sources=[
 ['AGENCIA_BRASIL_NACIONAL','https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml','rss'],
 ['AGENCIA_BRASIL_INTERNACIONAL','https://agenciabrasil.ebc.com.br/rss/internacional/feed.xml','rss'],
 ['USGS','https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson','seismic'],
 ['INMET_PREVISAO_RIO','https://apiprevmet3.inmet.gov.br/previsao/3304557','forecast'],
 ['INMET_PREVISAO_NITEROI','https://apiprevmet3.inmet.gov.br/previsao/3303302','forecast'],
 ['BLAISE_RJ_PUBLIC_STATUS','https://blaise-v6-rj-backend-4bl6iadyua-rj.a.run.app/v1/public/rj-status','status'],
];
const records=await Promise.all(sources.map(async([source,url,kind])=>{
 const checkedAt=new Date().toISOString();
 try{
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Cache-Control':'no-cache',Accept:'application/json, application/rss+xml'}});
  if(response.status!==200)return {source,url,checkedAt,state:'UNAVAILABLE',reason:`HTTP_${response.status}`};
  let bytes=0;const chunks=[];
  for await(const chunk of response.body){bytes+=chunk.length;if(bytes>2*1024*1024)throw Error('SOURCE_TOO_LARGE');chunks.push(chunk);}
  const body=Buffer.concat(chunks).toString('utf8'),now=Date.now();
  if(kind==='rss'){
   if(!/<rss[\s>]/.test(body)||/<!DOCTYPE|<!ENTITY/i.test(body))throw Error('RSS_CONTRACT_INVALID');
   const dates=[...body.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map(m=>Date.parse(m[1])).filter(t=>Number.isFinite(t)&&t<=now&&now-t<=172800000);
   return {source,url,checkedAt,state:dates.length?'RECENT_HEADLINES_AVAILABLE':'NO_RECENT_HEADLINES',recentCount:dates.length,newestPublishedAt:dates.length?new Date(Math.max(...dates)).toISOString():null};
  }
  const json=JSON.parse(body);
  if(kind==='seismic'){
   const generated=json.metadata?.generated;
   if(json.type!=='FeatureCollection'||!Number.isFinite(generated)||generated>now||now-generated>120000)throw Error('USGS_STALE_OR_INVALID');
   return {source,url,checkedAt,state:'CURRENT_FEED',generatedAt:new Date(generated).toISOString(),eventCount:json.features?.length??0,tsunamiConfirmed:false};
  }
  if(kind==='forecast'){
   const city=json[url.split('/').at(-1)];
   if(!city||typeof city!=='object')throw Error('FORECAST_CITY_CONTRACT_INVALID');
   return {source,url,checkedAt,state:'PAYLOAD_AVAILABLE_ISSUANCE_NOT_VERIFIED',forecastDisplayed:false,dayKeys:Object.keys(city).filter(k=>/^\d{2}\/\d{2}\/\d{4}$/.test(k)),reason:'RETRIEVAL_TIME_IS_NOT_MODEL_ISSUANCE'};
  }
  return {source,url,checkedAt,state:json.contract==='BLAISE_RJ_PUBLIC_OFFICIAL_STATUS_V1'?'STATUS_ENDPOINT_AVAILABLE':'INVALID_STATUS_CONTRACT',generatedAt:json.generatedAt??null};
 }catch(error){return {source,url,checkedAt,state:'UNAVAILABLE',reason:error.message==='SOURCE_TOO_LARGE'?error.message:'SOURCE_NETWORK_OR_CONTRACT_FAILURE'};}
}));
await mkdir('evidence/rj-interface-review',{recursive:true});
await writeFile('evidence/rj-interface-review/live-information-sources.json',JSON.stringify({checkedAt:new Date().toISOString(),sources:records,allIntegrationsValidated:false},null,2)+'\n');
records.forEach(r=>console.log(`${r.source}=${r.state}`));
