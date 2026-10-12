/**
 * Operator-authenticated, read-only OpenWeatherMap query.
 *
 * Never expose or distribute the OWM API key. A production subscriber/mobile
 * endpoint requires separate subscriber auth, quotas and product license.
 * This is an internal operational endpoint for testing REAL source ingestion.
 */
export const RJ_OWM_INTERNAL_PATH='/v1/internal/rj-sources/openweather-current';
function reply(res,code,body) {
  res.statusCode=code;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.end(JSON.stringify(body));
}
export function createRjOpenWeatherInternalHandler(delegate,{
  adapter,verifyOperatorOidc=null,clock=()=>Date.now(),
}={}) {
  if(typeof delegate!=='function'||!adapter
    ||typeof adapter.query!=='function'||typeof adapter.status!=='function'
    ||typeof clock!=='function')throw TypeError('rj_owm_internal_invalid_handler');
  return async(req,res)=>{
    const url=typeof req.url==='string'?req.url:'';
    if(url.split('?',1)[0]!==RJ_OWM_INTERNAL_PATH)
      return delegate(req,res);
    if(req.method!=='GET')return reply(res,405,{error:'method_not_allowed'});
    if(typeof verifyOperatorOidc!=='function')
      return reply(res,503,{error:'operator_identity_not_configured'});
    let authenticated=false;
    try {authenticated=await verifyOperatorOidc(req.headers?.authorization);}
    catch {authenticated=false;}
    if(authenticated!==true)return reply(res,403,{error:'not_authorized'});
    let parsed;
    try {
      parsed=new URL(url,'https://localhost');
      if(parsed.searchParams.size!==2)throw Error('wrong_query_parameters');
      if(!/^33\d{5}$/.test(parsed.searchParams.get('ibge')??''))
        throw Error('invalid_municipality');
      if(!/^[A-Z_]{4,35}$/.test(parsed.searchParams.get('phenomenon')??''))
        throw Error('invalid_phenomenon');
    } catch {return reply(res,400,{error:'invalid_query'});}
    try {
      const result=await adapter.query({
        ibge:parsed.searchParams.get('ibge'),
        phenomenon:parsed.searchParams.get('phenomenon'),
        now:clock(),
      });
      // The adapter provides a minimal, validated projection with no key.
      return reply(res,result.status==='FRESH_COMPLEMENTARY_PRODUCT'?200:503,result);
    } catch {
      return reply(res,503,{error:'source_unavailable'});
    }
  };
}
