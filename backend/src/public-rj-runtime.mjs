/**
 * Blaise V6 RJ public meteorology runtime.
 *
 * Deliberately DOES NOT import Google Play billing, Firebase entitlement,
 * purchase tokens or the monetized backend's loadConfig().
 * Runs only GET health/readiness plus separately source-licensed official
 * public-status and station-weather handlers. No external sources are
 * enabled by default. Creates no alerts and never uses INEA.
 *
 * For deployment after source API access approval and tests:
 *   node src/public-rj-runtime.mjs
 * Env: PORT, BLAISE_OFFICIAL_SOURCE_WORKER_ENABLED and source-specific flags,
 * BLAISE_RJ_PUBLIC_SOURCE_TERMS_APPROVED,
 * BLAISE_RJ_PUBLIC_STATUS_ENABLED,
 * BLAISE_RJ_INMET_STATION_TERMS_APPROVED,
 * BLAISE_RJ_METEOROLOGY_ENABLED.
 */
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { createOfficialSourceWorker, loadOfficialSourceWorkerConfig } from './official-source-worker.mjs';
import { createRjPublicStatusHandler } from './rj-public-status-http.mjs';
import { createRjInmetStationAdapter } from './rj-inmet-observation.mjs';
import { createRjMeteorologicalService, createRjMeteorologicalHandler } from './rj-meteorological-http.mjs';

function send(res,code,payload) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
  res.statusCode=code;
  res.end(JSON.stringify(payload));
}
function approved(value){return value==='true'}
export function createPublicRjRuntime({
  env=process.env,
  worker=null,
  fetchImpl=globalThis.fetch,
  now=()=>Date.now(),
}={}) {
  if(!env||typeof env!=='object'||typeof fetchImpl!=='function'||typeof now!=='function')
    throw TypeError('invalid_public_rj_runtime_config');
  if(String(env.BLAISE_INEA_STATION_URL||'').trim())
    throw TypeError('retired_inea_source_forbidden');
  const sourceWorker=worker||createOfficialSourceWorker({
    config:loadOfficialSourceWorkerConfig(env),
    fetchImpl,refreshIntervalsMs:{normal:300_000,severe:60_000},
    cadenceMode:'fixed_start',autoSchedule:true,
  });
  const verifiedTerms=approved(env.BLAISE_RJ_PUBLIC_SOURCE_TERMS_APPROVED);
  const statusEnabled=approved(env.BLAISE_RJ_PUBLIC_STATUS_ENABLED);
  const weatherEnabled=approved(env.BLAISE_RJ_METEOROLOGY_ENABLED);
  const weatherTermsApproved=verifiedTerms&&approved(env.BLAISE_RJ_INMET_STATION_TERMS_APPROVED);
  const stationAdapter=createRjInmetStationAdapter({
    enabled:weatherEnabled,termsApproved:weatherTermsApproved,
    fetchImpl,now,
  });
  const meteorology=createRjMeteorologicalService({inmetAdapter:stationAdapter,now});

  let draining=false;
  const fallback=(req,res)=>{
    if(req.method==='GET'&&(req.url==='/healthz'||req.url==='/health'))
      return send(res,200,{status:'ok',service:'blaise-v6-rj-public'});
    if(req.method==='GET'&&req.url==='/readyz')
      return send(res,draining?503:200,
        {status:draining?'draining':'ready',service:'blaise-v6-rj-public'});
    return send(res,draining?503:404,
      {error:draining?'service_draining':'route_not_found'});
  };
  const publicStatus=createRjPublicStatusHandler(fallback,{
    sourceWorker,enabled:statusEnabled,licensingApproved:verifiedTerms,clock:now,
  });
  const weather=createRjMeteorologicalHandler(publicStatus,{
    service:meteorology,enabled:weatherEnabled,termsApproved:weatherTermsApproved,
  });
  return Object.freeze({
    sourceWorker,
    handler:(req,res)=>draining
      ? send(res,503,{error:'service_draining'})
      : weather(req,res),
    start(){return sourceWorker.start()},
    stop(){if(draining)return false;draining=true;sourceWorker.stop();return true},
    get state(){return Object.freeze({
      draining,workerConfigured:sourceWorker.status?.().enabled===true,
      statusEndpointEnabled:statusEnabled&&verifiedTerms,
      stationWeatherEndpointEnabled:weatherEnabled&&weatherTermsApproved,
      billingConfigured:false, autoWarningsPublished:false,
    })},
  });
}
export function runPublicRjRuntime({env=process.env}={}) {
  const runtime=createPublicRjRuntime({env});
  const port=Number(env.PORT||8080);
  if(!Number.isInteger(port)||port<1||port>65535)throw TypeError('invalid_public_port');
  const server=http.createServer(runtime.handler);
  server.requestTimeout=10_000;
  server.headersTimeout=5_000;
  server.keepAliveTimeout=5_000;
  let closing=false;
  const shutdown=()=>{
    if(closing)return;
    closing=true;runtime.stop();
    server.close();
    server.closeIdleConnections?.();
  };
  process.once('SIGTERM',shutdown);
  process.once('SIGINT',shutdown);
  runtime.start();
  server.listen(port,'0.0.0.0',()=>{
    console.log('blaise_rj_public_runtime_listening:'+port);
    console.log('blaise_rj_public_status_enabled:'+runtime.state.statusEndpointEnabled);
    console.log('blaise_rj_public_weather_enabled:'+runtime.state.stationWeatherEndpointEnabled);
  });
  return Object.freeze({runtime,server,shutdown});
}
const directly=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(directly) {
  try{runPublicRjRuntime()}
  catch(error){
    console.error('blaise_rj_public_startup_failed',error?.code||'configuration_error');
    process.exitCode=1;
  }
}
