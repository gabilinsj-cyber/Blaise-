/**
 * Blaise V6 RJ — explicit operator-only, fail-closed Agent 13 HTTP gate.
 * This module does not fetch, start agents, expose provider data or schedule.
 * A Cloud Run service must apply its own IAM authentication in addition to OIDC.
 */
export const RJ_AGENT13_OPERATOR_PATH='/v1/internal/rj/agent13/collect';
export const RJ_AGENT13_OPERATOR_HTTP_VERSION='rj-agent13-operator-http-20261115-v1';
const BODY_LIMIT=0;
function reply(res,status,body){
  res.statusCode=status;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Pragma','no-cache');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.end(JSON.stringify(body));
}
export function createRjAgent13OperatorHttpHandler(delegate,{
  agent13=null,verifyOperatorOidc=null,
}={}) {
  if(typeof delegate!=='function')throw TypeError('AGENT13_DELEGATE_REQUIRED');
  return async(req,res)=>{
    if(req?.url?.split('?')[0]!==RJ_AGENT13_OPERATOR_PATH)
      return delegate(req,res);
    if(req.url!==RJ_AGENT13_OPERATOR_PATH){
      reply(res,400,{error:'query_parameters_not_permitted'});return;
    }
    if(req.method!=='POST'){
      res.setHeader('Allow','POST');
      reply(res,405,{error:'method_not_allowed'});return;
    }
    // Absolutely no user-provided target, secret or other request body.
    const len=req.headers?.['content-length'];
    if(req.headers?.['transfer-encoding']!=null ||
      (len!=null && (!/^\d+$/.test(String(len))||Number(len)>BODY_LIMIT))){
      reply(res,413,{error:'request_body_not_permitted'});return;
    }
    if(typeof verifyOperatorOidc!=='function'){
      reply(res,503,{error:'operator_auth_not_configured'});return;
    }
    const authorization=req.headers?.authorization;
    if(typeof authorization!=='string'||authorization.length>8192||
       !/^Bearer [^\s]+$/.test(authorization)){
      reply(res,403,{error:'not_authorized'});return;
    }
    let authorized=false;
    try{authorized=await verifyOperatorOidc(authorization);}catch{authorized=false;}
    if(authorized!==true){reply(res,403,{error:'not_authorized'});return;}
    if(agent13?.configured!==true||typeof agent13.onDemand!=='function'){
      reply(res,503,{error:'agent13_not_configured'});return;
    }
    let result;
    try{result=await agent13.onDemand({adminAuthorized:true});}
    catch{reply(res,503,{error:'agent13_execution_unavailable'});return;}
    if(result?.status==='BUSY'){
      reply(res,409,{status:'BUSY',reason:'already_running'});return;
    }
    if(result?.status==='COMPLETED'&&result?.result?.status==='CURRENT_ESTIMATE_AVAILABLE'&&
       result?.result?.weather?.officialObservation===false&&
       result?.result?.weather?.officialAlert===false&&
       result?.result?.weather?.sourceId==='OPENWEATHER_ONECALL4_CURRENT'){
      // Operator response does not publish weather data, target, credentials,
      // full upstream response, station-like claims or raw errors.
      reply(res,200,{status:'CURRENT_PROVIDER_ESTIMATE_RETRIEVED',
        sourceId:'OPENWEATHER_ONECALL4_CURRENT',
        officialObservation:false,officialAlert:false,
        customerDataPublished:false});return;
    }
    reply(res,503,{status:'UNAVAILABLE',
      officialObservation:false,officialAlert:false,
      customerDataPublished:false});
  };
}
