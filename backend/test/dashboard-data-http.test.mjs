import http from 'node:http';
import assert from 'node:assert/strict';
import test from 'node:test';

import { ALERTA_RIO_EXPECTED_ACTIVE_STATIONS, ALERTA_RIO_LIVE_SOURCE_ID } from '../src/alerta-rio-source.mjs';
import {
  buildPaidDashboardSnapshot,
  createPaidDashboardDataHttpHandler,
  DASHBOARD_DATA_HTTP_CONTRACT,
  DASHBOARD_DATA_HTTP_PATH,
} from '../src/dashboard-data-http.mjs';
import { createOperationalMetrics } from '../src/observability.mjs';

const NOW = Date.parse('2026-09-15T11:00:00Z');
const config = Object.freeze({
  packageName: 'br.com.blaise.rj',
  monthlyProductId: 'monthly.test',
  annualProductId: 'annual.test',
  allowTestPurchases: false,
});

function activeSubscription() {
  return {
    subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
    lineItems: [{ productId: 'monthly.test', expiryTime: '2099-01-01T00:00:00Z' }],
  };
}

function validRequest(overrides = {}) {
  return {
    packageName: config.packageName,
    purchaseToken: 'token-12345678',
    productIds: ['monthly.test'],
    ...overrides,
  };
}

function stations() {
  return Array.from({ length: ALERTA_RIO_EXPECTED_ACTIVE_STATIONS }, (_, index) => ({
    code: index + 1,
    name: `Estacao ${index + 1}`,
    zone: 'Rio de Janeiro',
    observedAt: '2026-09-15T10:59:00.000Z',
    rain15mMm: index === 3 ? 12.5 : index === 8 ? 1.2 : 0,
    rain1hMm: index === 3 ? 28.4 : index === 8 ? 4.5 : 0,
    rain24hMm: index === 3 ? 85.7 : index === 8 ? 10.1 : 0,
  }));
}

function currentWorker({ state = 'CURRENT', enabled = true, started = true } = {}) {
  const reading = Object.freeze({
    sourceId: ALERTA_RIO_LIVE_SOURCE_ID,
    state,
    reason: state === 'CURRENT' ? 'fresh_snapshot' : 'cache_age_exceeded',
    mode: 'normal',
    fetchedAt: '2026-09-15T10:59:30.000Z',
    dataAgeMs: state === 'CURRENT' ? 60_000 : 999_999,
    cacheAgeMs: state === 'CURRENT' ? 30_000 : 999_999,
    snapshot: state === 'CURRENT' ? Object.freeze({
      sourceId: ALERTA_RIO_LIVE_SOURCE_ID,
      stationCount: ALERTA_RIO_EXPECTED_ACTIVE_STATIONS,
      missingValueCount: 0,
      freshestObservedAt: '2026-09-15T10:59:00.000Z',
      stations: Object.freeze(stations()),
    }) : null,
  });
  return Object.freeze({
    status() {
      return Object.freeze({
        enabled,
        started,
        mode: 'normal',
        sources: Object.freeze([Object.freeze({
          sourceId: ALERTA_RIO_LIVE_SOURCE_ID,
          state,
          reason: reading.reason,
          fetchedAt: reading.fetchedAt,
          observedAt: '2026-09-15T10:59:00.000Z',
          dataAgeMs: reading.dataAgeMs,
          cacheAgeMs: reading.cacheAgeMs,
          semanticValidity: null,
        })]),
      });
    },
    readSource() {
      return reading;
    },
  });
}

async function withServer(handler, callback) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    await callback(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function handlerWith({ gateway, sourceWorker = currentWorker(), readInternationalForecasts = null, readVisualCrossingPrivateCache = null, visualCrossingSubscriberReleaseApproved = false, metrics = createOperationalMetrics({ startedAtMillis: NOW }) } = {}) {
  const fallback = (_req, res) => {
    res.statusCode = 404;
    res.end();
  };
  return {
    metrics,
    handler: createPaidDashboardDataHttpHandler(fallback, {
      config,
      gateway: gateway ?? {
        async getSubscription() { return activeSubscription(); },
        async acknowledge() {},
      },
      sourceWorker,
      metrics,
      readInternationalForecasts,
      readVisualCrossingPrivateCache,
      visualCrossingSubscriberReleaseApproved,
    }),
  };
}

async function post(base, body) {
  return fetch(`${base}${DASHBOARD_DATA_HTTP_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('paid dashboard snapshot projects only bounded current Alerta Rio rainfall summary after Play verification', async () => {
  const { handler, metrics } = handlerWith();
  await withServer(handler, async (base) => {
    const response = await post(base, validRequest());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.equal(body.contract, DASHBOARD_DATA_HTTP_CONTRACT);
    assert.equal(body.rainfall.sourceId, ALERTA_RIO_LIVE_SOURCE_ID);
    assert.equal(body.rainfall.stationCount, ALERTA_RIO_EXPECTED_ACTIVE_STATIONS);
    assert.equal(body.rainfall.wetStationCount, 2);
    assert.equal(body.rainfall.max15mMm, 12.5);
    assert.equal(body.rainfall.max1hMm, 28.4);
    assert.equal(body.rainfall.max24hMm, 85.7);
    assert.equal(body.currentSourceCount, 1);
    assert.equal(body.sources.length, 1);
    const serialized = JSON.stringify(body);
    assert.equal(serialized.includes('token-12345678'), false);
    assert.equal(serialized.includes('Estacao 4'), false);
    assert.equal(serialized.includes('productIds'), false);
    assert.deepEqual(body.privacy, {
      purchaseTokenExposed: false,
      rawStationPayloadExposed: false,
      userLocationStored: false,
    });
  });
  const counters = metrics.snapshot({ nowMillis: NOW }).counters;
  assert.equal(counters.dashboard_success_total, 1);
  assert.equal(counters.dashboard_denied_total, 0);
});

test('dashboard indicates unavailable rainfall without inventing data when station cache is stale', () => {
  const snapshot = buildPaidDashboardSnapshot(currentWorker({ state: 'STALE' }), { nowMillis: NOW });
  assert.equal(snapshot.rainfall, null);
  assert.equal(snapshot.rainfallAvailability, 'UNAVAILABLE');
  assert.deepEqual(snapshot.officialNoticeLinks.map(x=>x.id), ['defesa-civil-rj', 'alerta-rio', 'inmet-avisos', 'inpe-cptec-avisos']);
  assert.ok(snapshot.officialNoticeLinks.every(x=>!/cemaden/i.test(x.id+' '+x.url)));
});

test('paid dashboard endpoint denies inactive subscriptions without source disclosure', async () => {
  const { handler, metrics } = handlerWith({
    gateway: {
      async getSubscription() {
        return {
          subscriptionState: 'SUBSCRIPTION_STATE_ON_HOLD',
          acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
          lineItems: [{ productId: 'monthly.test', expiryTime: '2099-01-01T00:00:00Z' }],
        };
      },
      async acknowledge() {},
    },
  });
  await withServer(handler, async (base) => {
    const response = await post(base, validRequest());
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'access_denied' });
  });
  assert.equal(metrics.snapshot({ nowMillis: NOW }).counters.dashboard_denied_total, 1);
});

test('paid dashboard endpoint returns source_unavailable when worker is disabled or has no current verified rainfall', async () => {
  const { handler, metrics } = handlerWith({ sourceWorker: currentWorker({ enabled: false }) });
  await withServer(handler, async (base) => {
    const response = await post(base, validRequest());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'source_unavailable' });
  });
  assert.equal(metrics.snapshot({ nowMillis: NOW }).counters.dashboard_unavailable_total, 1);
});

test('paid dashboard endpoint rejects unexpected fields before Play lookup', async () => {
  let lookups = 0;
  const { handler } = handlerWith({
    gateway: {
      async getSubscription() { lookups += 1; return activeSubscription(); },
      async acknowledge() {},
    },
  });
  await withServer(handler, async (base) => {
    const response = await post(base, validRequest({ debug: true }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'invalid_request' });
  });
  assert.equal(lookups, 0);
});


test('statewide route requires the same active purchase and never exposes credentials', async () => {
  const { handler } = handlerWith({});
  await withServer(handler, async base => {
    const response = await fetch(`${base}/v1/data/municipalities`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validRequest()),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.contract, 'RJ_92_MUNICIPALITIES_V1');
    assert.equal(body.municipalities.length, 92);
    assert.equal(JSON.stringify(body).includes('token-12345678'), false);
    assert.equal(JSON.stringify(body).includes('purchaseToken'), false);
  });
  const denied = handlerWith({ gateway: { async getSubscription() { return { subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED', lineItems: [] }; } } });
  await withServer(denied.handler, async base => {
    const response = await fetch(`${base}/v1/data/municipalities`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validRequest()),
    });
    assert.equal(response.status, 403);
    assert.equal((await response.text()).includes('municipalities'), false);
  });
});


function syntheticModelForecastForTest(nowMs=Date.now()){
  const stamp=at=>new Date(at).toISOString();
  return {
    status:'FORECAST_AVAILABLE',ibge:'3304557',
    source:'MET_NORWAY_LOCATIONFORECAST_2',
    originWeather:'ECMWF_IFS',originUv:'COPERNICUS_CAMS_UV_VIA_MET_NO',
    nature:'PREVISAO_DE_MODELO_NAO_OBSERVACAO',
    issuedAt:stamp(nowMs-45*60_000),
    validAt:stamp(nowMs-20*60_000),checkedAt:stamp(nowMs),
    values:{temperatureC:28.4,feelsLikeC:31.0,humidityPct:65,
      windKmh:17.2,uvClearSkyIndex:8},
    hourly:{precipitationNextHourMm:1.0,precipitationProbabilityNextHourPct:50},
    officialObservation:false,officialAlert:false,
    automaticAlertsAuthorized:false,
    uvIsMeasured:false,uvIsActualCloudAdjusted:false,uvIsClearSky:true,
    independentFromEcmwfDirect:false,
    sourceUrl:'https://api.met.no/weatherapi/locationforecast/2.0/complete',
    license:'CC BY 4.0'
  };
}

test('paid dashboard serves international-only forecast when old source worker is disabled',async()=>{
  let providerCalls=0;
  const {handler}=handlerWith({
    sourceWorker:currentWorker({enabled:false}),
    readInternationalForecasts:async()=>{providerCalls++;return [syntheticModelForecastForTest()];}
  });
  await withServer(handler,async base=>{
    const response=await post(base,validRequest());
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.contract,DASHBOARD_DATA_HTTP_CONTRACT);
    assert.equal(body.rainfall,null);
    assert.equal(body.sources.length,0);
    assert.equal(body.internationalForecasts.length,1);
    assert.equal(body.internationalForecasts[0].temperatureC,null);
    assert.equal(body.internationalForecasts[0].feelsLikeC,null);
    assert.equal(body.internationalForecasts[0].modelOrigin,'ECMWF_IFS');
    assert.equal(body.internationalForecasts[0].kind,'MODEL_FORECAST_NOT_LOCAL_MEASUREMENT');
    assert.equal(JSON.stringify(body).includes('token-12345678'),false);
    assert.equal(providerCalls,1);
  });
});

test('purchase denial occurs before optional international forecast reads',async()=>{
  let providerCalls=0;
  const {handler}=handlerWith({
    sourceWorker:currentWorker({enabled:false}),
    gateway:{async getSubscription(){
      return {subscriptionState:'SUBSCRIPTION_STATE_EXPIRED',lineItems:[]};
    }},
    readInternationalForecasts:async()=>{providerCalls++;return [syntheticModelForecastForTest()];}
  });
  await withServer(handler,async base=>{
    const response=await post(base,validRequest());
    assert.equal(response.status,403);
  });
  assert.equal(providerCalls,0);
});

test('expired optional model never turns source-unavailable into fabricated weather',async()=>{
  const {handler}=handlerWith({
    sourceWorker:currentWorker({enabled:false}),
    readInternationalForecasts:async()=>[{
      ...syntheticModelForecastForTest(),
      checkedAt:'2026-01-01T00:00:00Z'
    }]
  });
  await withServer(handler,async base=>{
    const response=await post(base,validRequest());
    assert.equal(response.status,503);
    assert.deepEqual(await response.json(),{error:'source_unavailable'});
  });
});

test('paid dashboard requests only two selected IBGE municipalities after entitlement verification',async()=>{
  let readCodes=null;
  const {handler}=handlerWith({
    sourceWorker:currentWorker({enabled:false}),
    readInternationalForecasts:async codes=>{
      readCodes=codes;
      return [{...syntheticModelForecastForTest(),ibge:'3304904'}];
    }
  });
  await withServer(handler,async base=>{
    const request=validRequest({municipalityIbges:[3304904,3304557]});
    const response=await post(base,request);
    assert.equal(response.status,200);
    const body=await response.json();
    assert.deepEqual(readCodes,['3304904','3304557']);
    assert.equal(body.internationalForecasts.length,1);
    assert.equal(body.internationalForecasts[0].ibge,'3304904');
  });
});

test('invalid, duplicated or excessive municipality selections fail before purchase verification',async()=>{
  let authCalls=0,sourceCalls=0;
  const {handler}=handlerWith({
    gateway:{async getSubscription(){authCalls++;return activeSubscription();}},
    readInternationalForecasts:async()=>{sourceCalls++;return [];}
  });
  await withServer(handler,async base=>{
    for(const selection of [
      [3304557,3303302,3304904],
      [3304557,3304557],
      [3309999],
      ['unsafe-id'],
      []
    ]){
      const response=await post(base,validRequest({municipalityIbges:selection}));
      assert.equal(response.status,400);
    }
  });
  assert.equal(authCalls,0);
  assert.equal(sourceCalls,0);
});

test('Visual Crossing private cache remains invisible to subscriber unless explicitly approved',async()=>{
 let reads=0;
 const readVisualCrossingPrivateCache=async()=>{
  reads++;
  return {sourceId:'VISUAL_CROSSING_FREE',
    status:'INDISPONIVEL',ibge:'3304557',fields:[],forecast:[]};
 };
 const {handler}=handlerWith({
  sourceWorker:currentWorker({enabled:false}),
  readVisualCrossingPrivateCache,
  visualCrossingSubscriberReleaseApproved:false
 });
 await withServer(handler,async base=>{
  const response=await post(base,validRequest());
  assert.equal(response.status,503);
 });
 assert.equal(reads,0);
});
test('Visual Crossing valid E/P snapshot can augment paid two-city dashboard only after entitlement',async()=>{
 const now=Date.now();
 const iso=m=>new Date(now+m).toISOString();
 let reads=[];
 const snapshot=code=>({
  sourceId:'VISUAL_CROSSING_FREE',status:'PRIVATE_CACHE_VALID',
  ibge:code,kindCurrent:'E',kindForecast:'P',
  publishedToSubscribers:false,providerBalanceVerified:false,
  attribution:'Weather data by Visual Crossing',
  validAt:iso(-5*60_000),checkedAt:iso(-1000),
  fields:[{field:'temperatureC',value:28.0,unit:'°C',kind:'E'},
    {field:'relativeHumidityPct',value:70,unit:'%',kind:'E'}],
  forecast:[{validAt:iso(50*60_000),kind:'P',
    fields:[{field:'precipitationMm',value:1.2,unit:'mm',kind:'P'}]}]
 });
 const {handler}=handlerWith({
  sourceWorker:currentWorker({enabled:false}),
  readVisualCrossingPrivateCache:async(code)=>{reads.push(code);return snapshot(code)},
  visualCrossingSubscriberReleaseApproved:true
 });
 await withServer(handler,async base=>{
  const response=await post(base,validRequest({municipalityIbges:['3304557','3303302']}));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.deepEqual(reads,['3304557','3303302']);
  assert.equal(body.visualCrossingWeather.length,2);
  assert.equal(body.visualCrossingWeather[0].current.temperatureC,28);
  assert.equal(body.visualCrossingWeather[0].current.humidityPct,70);
  assert.equal(body.visualCrossingWeather[0].forecastNext.precipitationMm,1.2);
  assert.equal(body.visualCrossingWeather[0].officialAlert,false);
  assert.equal(body.visualCrossingWeather[0].attribution,'Weather data by Visual Crossing');
  assert.ok(!JSON.stringify(body).includes('weather.visualcrossing.com/VisualCrossingWebServices'));
  assert.ok(!JSON.stringify(body).includes('apiKey'));
 });
});
test('unpaid subscriber cannot probe private Visual Crossing cache',async()=>{
 let reads=0;
 const {handler}=handlerWith({
  sourceWorker:currentWorker({enabled:false}),
  readVisualCrossingPrivateCache:async()=>{reads++;return null},
  visualCrossingSubscriberReleaseApproved:true,
  gateway:{async getSubscription(){return {
   subscriptionState:'SUBSCRIPTION_STATE_EXPIRED',lineItems:[]};
  }}
 });
 await withServer(handler,async base=>{
  const response=await post(base,validRequest());
  assert.equal(response.status,403);
 });
 assert.equal(reads,0);
});
