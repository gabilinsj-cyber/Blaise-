import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeOptionalMetNorwayRuntime} from '../src/rj-met-norway-runtime-optional.mjs';
import officialIbge from '../src/rj-ibge-92-points.json' with {type:'json'};
const now=Date.parse('2026-11-17T16:00:00Z');
const baseEnv={
  BLAISE_MET_NORWAY_ENABLED:'true',
  BLAISE_MET_NORWAY_TOS_ACCEPTED_BY_HUMAN:'true',
  BLAISE_MET_NORWAY_FIRESTORE_ENABLED:'true',
  BLAISE_MET_NORWAY_USER_AGENT:'BlaiseV6RJ/6.0 weather-support@example.com',
  GOOGLE_CLOUD_PROJECT:'blaise-rj-staging-test'
};
test('read-only runtime cannot enable without operator terms acceptance',async()=>{
  let dbCalls=0,apiCalls=0;
  const runtime=await initializeOptionalMetNorwayRuntime({
    env:{...baseEnv,BLAISE_MET_NORWAY_TOS_ACCEPTED_BY_HUMAN:'false'},
    createDatabase:async()=>{dbCalls++;throw Error('must not happen');},
    fetchImpl:async()=>{apiCalls++;throw Error('must not happen');},
    clock:()=>now
  });
  assert.equal(runtime.configured,false);
  assert.equal(runtime.publishedToAndroid,false);
  assert.equal(runtime.state,'HUMAN_TOS_ACCEPTANCE_REQUIRED');
  assert.equal(await runtime.readCachedCity('3304557'),null);
  assert.equal(dbCalls,0);assert.equal(apiCalls,0);
});
test('read-only cached forecast is revalidated but never calls the upstream MET API',async()=>{
  let reads=0,fetches=0;
  const payload={
    type:'Feature',
    geometry:{coordinates:(()=>{
      const point=officialIbge.points.find(p=>p.ibge==='3304557');
      return [point.lon,point.lat];
    })()},
    properties:{
      meta:{updated_at:'2026-11-17T15:15:00Z'},
      timeseries:[{
        time:'2026-11-17T15:00:00Z',
        data:{instant:{details:{
          air_temperature:28.5,apparent_air_temperature:31.0,
          relative_humidity:67,wind_speed:3.0,ultraviolet_index_clear_sky:8
        }},next_1_hours:{details:{precipitation_amount:1.2}}}
      }]
    }
  };
  const db={
    collection:()=>({doc:code=>({
      get:async()=>{reads++;
        return code==='3304557'
          ?{exists:true,data:()=>({
            ibge:code,provider:'MET_NORWAY_LOCATIONFORECAST_2',payload,
            nextAllowedAtMs:now+3600000,lastModified:null
          })}
          :{exists:false};
      }
    })}),
    runTransaction:async()=>{throw Error('READ_ONLY_MUST_NOT_RESERVE_PROVIDER_QUOTA');}
  };
  const runtime=await initializeOptionalMetNorwayRuntime({
    env:baseEnv,createDatabase:async()=>db,clock:()=>now,
    fetchImpl:async()=>{fetches++;throw Error('UPSTREAM_MUST_NOT_BE_CALLED');}
  });
  assert.equal(runtime.configured,true);
  assert.equal(runtime.automaticSchedulingEnabled,false);
  const f=await runtime.readCachedCity('3304557');
  assert.equal(f.status,'FORECAST_AVAILABLE');
  assert.equal(f.values.temperatureC,28.5);
  assert.equal(f.values.feelsLikeC,31.0);
  assert.equal(f.officialObservation,false);
  assert.equal(await runtime.readCachedCity('3304557'),f);
  assert.equal(reads,1);
  assert.equal(fetches,0);
  assert.equal(await runtime.readCachedCity('3304904'),null);
});
