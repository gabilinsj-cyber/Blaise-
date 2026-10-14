import { RJ_MUNICIPALITIES } from './rio-municipalities.mjs';

/**
 * Optional server-side Windy Point Forecast adapter for Blaise V6 RJ.
 *
 * Strictly a FORECAST data product; never a weather station, an official
 * alert or proof which of two stations is accurate. The API key stays on the
 * backend. No free testing key or unlicensed redistribution is permitted.
 */
export const WINDY_ENDPOINT='https://api.windy.com/api/point-forecast/v2';
export const WINDY_MODEL_SOURCE='WINDY_MODELO';
const MAX_BYTES=512*1024;
const fail=(reason)=>Object.freeze({
  sourceId:WINDY_MODEL_SOURCE,status:'UNAVAILABLE',reason,
  forecastOnly:true,measurements:Object.freeze([]),mayTriggerAlert:false,
});
const bounded=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;

export function validateWindyPointForecast(body,{ibge,latitude,longitude,now=Date.now()}={}) {
  if(!Number.isFinite(now)||!bounded(latitude,-23.7,-20.4)
    ||!bounded(longitude,-45.5,-40.4)
    ||!RJ_MUNICIPALITIES.some(c=>c.ibge===String(ibge)))
    throw new TypeError('windy_rj_invalid_location');
  if(!body||typeof body!=='object'||Array.isArray(body)
    ||!Array.isArray(body.ts)||body.ts.length<1||body.ts.length>240
    ||!body.units||typeof body.units!=='object')return fail('INVALID_RESPONSE_SHAPE');
  const ts=body.ts;
  if(ts.some(t=>!Number.isSafeInteger(t)))return fail('INVALID_FORECAST_TIMES');
  const fields=[
    ['TEMPERATURA_C','temp-surface','K',v=>v-273.15,[-35,60],'°C'],
    ['UMIDADE_PERCENTUAL','rh-surface','%',v=>v,[0,100],'%'],
    ['RAJADA_KMH','gust-surface','m*s-1',v=>v*3.6,[0,400],'km/h'],
    ['CHUVA_MM_3H','past3hprecip-surface','mm',v=>v,[0,300],'mm'],
  ];
  const measurements=[];
  for(const [variable,key,unit,convert,range,resultUnit] of fields){
    if(!Object.hasOwn(body,key))continue;
    if(body.units[key]!==unit || !Array.isArray(body[key]) ||
      body[key].length!==ts.length)return fail('INVALID_UNITS_OR_ARRAY_SHAPE');
    for(let i=0;i<ts.length;i++){
      const value=body[key][i],validAt=ts[i];
      if(value===null)continue;
      if(!bounded(value,-300,1500))continue;
      if(validAt < now-3_600_000||validAt>now+48*3_600_000)continue;
      const amount=convert(value);
      if(!bounded(amount,...range))continue;
      measurements.push(Object.freeze({
        sourceId:WINDY_MODEL_SOURCE,sourceUrl:'https://api.windy.com/point-forecast/docs',
        kind:'MODEL_FORECAST_UNCALIBRATED',ibge:String(ibge),
        latitude,longitude,variable,value:Math.round(amount*100)/100,
        unit:resultUnit,validAt:new Date(validAt).toISOString(),
        dataProvenance:'WINDY_GFS_POINT_FORECAST',
        modelFamilyId:'gfs',modelRunId:null,issuedAt:null,
        historicalSkillStatus:'NOT_VERIFIED',
        officialMeasurement:false,mayTriggerAlert:false,
      }));
    }
  }
  if(!measurements.length)return fail('NO_USABLE_VALUES');
  return Object.freeze({
    sourceId:WINDY_MODEL_SOURCE,status:'FORECAST_CONTEXT_ONLY',
    forecastOnly:true,mayTriggerAlert:false,
    retrievedAt:new Date(now).toISOString(),
    modelFamilyId:'gfs',modelRunValidated:false,
    historicalSkillValidated:false,
    measurements:Object.freeze(measurements.slice(0,500)),
  });
}

/** Fetch ONE point only when operator has confirmed licensed PRO access.
 * Deliberately does not return credentials, and refuses all test-key modes.
 */
export async function fetchWindyLicensedPoint({
  ibge,latitude,longitude,apiKey,licenseApproved=false,
  keyPlan='UNVERIFIED',fetchImpl=globalThis.fetch,now=Date.now(),
}={}) {
  if(!licenseApproved)return fail('COMMERCIAL_LICENSE_NOT_APPROVED');
  if(keyPlan!=='PROFESSIONAL')return fail('PRODUCTION_API_PLAN_NOT_VERIFIED');
  if(typeof apiKey!=='string'||apiKey.length<16||apiKey.length>512)
    return fail('PROFESSIONAL_KEY_NOT_CONFIGURED');
  if(typeof fetchImpl!=='function')return fail('NETWORK_CLIENT_UNAVAILABLE');
  // Reject invalid city and coordinates BEFORE any request is made.
  validateWindyPointForecast({ts:[now],units:{}},{ibge,latitude,longitude,now});
  try {
    const response=await fetchImpl(WINDY_ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      redirect:'error',signal:AbortSignal.timeout(9000),
      body:JSON.stringify({lat:latitude,lon:longitude,model:'gfs',
        parameters:['temp','rh','windGust','precip'],levels:['surface'],key:apiKey}),
    });
    if(response?.status!==200)return fail('SOURCE_HTTP_UNAVAILABLE');
    const declared=Number(response.headers?.get?.('content-length'));
    if(Number.isFinite(declared)&&declared>MAX_BYTES)return fail('RESPONSE_TOO_LARGE');
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length>MAX_BYTES)return fail('RESPONSE_TOO_LARGE');
    let json;
    try{json=JSON.parse(bytes.toString('utf8'));}
    catch{return fail('INVALID_JSON_RESPONSE');}
    return validateWindyPointForecast(json,{ibge,latitude,longitude,now});
  }catch{return fail('NETWORK_OR_TIMEOUT_FAILURE');}
}
