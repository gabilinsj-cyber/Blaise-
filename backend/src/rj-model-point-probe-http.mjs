import {fetchWindyLicensedPoint} from './rj-windy-point-source.mjs';

export const RJ_MODEL_PROBE_PATH='/v1/internal/rj-model-point';
const MAX_REQUEST=1024;
const reply=(res,status,obj)=>{
  res.statusCode=status;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(obj));
};
async function boundedJson(req){
  if(!String(req.headers?.['content-type']??'').toLowerCase().startsWith('application/json'))
    throw Error('INVALID_CONTENT_TYPE');
  let size=0,buf='';
  for await(const chunk of req){
    size+=chunk.length;
    if(size>MAX_REQUEST)throw Error('REQUEST_TOO_LARGE');
    buf+=chunk.toString('utf8');
  }
  const obj=JSON.parse(buf);
  if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('INVALID_JSON_BODY');
  if(Object.keys(obj).sort().join(',')!=='ibge,latitude,longitude')
    throw Error('UNEXPECTED_BODY_FIELDS');
  return obj;
}
/**
 * Operator-only manual smoke test for a SINGLE RJ model point.
 * No pricing/subscription bypass; NOT a public forecast API.
 *
 * Live usage is explicitly disabled unless BOTH operator-authorized product
 * usage and a PROFESSIONAL Windy Point Forecast key are configured.
 * The municipality is NOT geospatially verified against the request point;
 * no municipality-specific result may be displayed from this probe alone.
 */
export function createRjModelPointProbeHandler(delegate,{
  verifyOperatorOidc=null,env=process.env,fetchPoint=fetchWindyLicensedPoint,
  clock=()=>Date.now(),
}={}) {
  if(typeof delegate!=='function'||typeof fetchPoint!=='function'
    ||typeof clock!=='function'||!env||typeof env!=='object')
    throw new TypeError('rj_model_probe_invalid_configuration');
  return async(req,res)=>{
    if(req.url?.split('?',1)[0]!==RJ_MODEL_PROBE_PATH)return delegate(req,res);
    if(req.method!=='POST'){reply(res,405,{error:'method_not_allowed'});return;}
    if(typeof verifyOperatorOidc!=='function'){
      reply(res,503,{error:'operator_identity_not_configured'});return;
    }
    let authorized=false;
    try{authorized=await verifyOperatorOidc(req.headers?.authorization);}
    catch{authorized=false;}
    if(authorized!==true){reply(res,403,{error:'operator_not_authorized'});return;}
    if(env.BLAISE_WINDY_POINT_OPERATOR_APPROVED!=='true'
      ||env.BLAISE_WINDY_POINT_PLAN!=='PROFESSIONAL'
      ||!env.BLAISE_WINDY_POINT_API_KEY){
      reply(res,503,{error:'windy_license_or_professional_key_not_configured'});return;
    }
    let body;
    try{body=await boundedJson(req);}
    catch{reply(res,400,{error:'invalid_request'});return;}
    try{
      const result=await fetchPoint({
        ...body,now:clock(),
        apiKey:env.BLAISE_WINDY_POINT_API_KEY,
        keyPlan:env.BLAISE_WINDY_POINT_PLAN,
        licenseApproved:true,
      });
      if(result?.status!=='FORECAST_CONTEXT_ONLY'){
        reply(res,503,{error:'windy_source_unavailable',reason:String(result?.reason||'UNKNOWN').slice(0,70)});
        return;
      }
      reply(res,200,{
        contract:'BLAISE_RJ_OPERATOR_MODEL_SMOKE_V1',
        ...result,
        municipalityAttributionVerified:false,
        usableForMunicipalWarnings:false,
        commercialDistributionApprovedByThisTest:false,
      });
    }catch{
      reply(res,503,{error:'windy_source_unavailable'});
    }
  };
}
