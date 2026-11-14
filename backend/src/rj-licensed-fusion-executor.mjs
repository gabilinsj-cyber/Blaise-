/**
 * Explicit opt-in backend-only Agent 12 executor.
 * Reads grants from an authenticated licensing registry BEFORE requesting
 * observations. Fetch adapters must use provider-approved HTTPS/TLS APIs and
 * their authorized product IDs. No hidden access or unverifiable "no trace".
 * This module neither starts timers nor contacts any endpoint on import.
 */
import {prepareRjLicensedLocalWeatherFusion} from './rj-licensed-weather-fusion.mjs';

export function createRjLicensedFusionExecutor({
  enabled=false,target=null,authorizeOperator=null,
  loadVerifiedGrants=null,loadAuthorizedObservations=null,
  now=Date.now,onAudit=()=>{}
}={}){
  if(typeof enabled!=='boolean'||typeof now!=='function'||typeof onAudit!=='function'||
     (authorizeOperator!==null&&typeof authorizeOperator!=='function')||
     (loadVerifiedGrants!==null&&typeof loadVerifiedGrants!=='function')||
     (loadAuthorizedObservations!==null&&typeof loadAuthorizedObservations!=='function'))
    throw new TypeError('invalid_licensed_fusion_executor_configuration');
  const unavailable=(reason)=>Object.freeze({
    status:'UNAVAILABLE',reason,officialAlert:false,automaticCollection:false
  });
  return Object.freeze({
    agentId:'geodados-fusao-licenciada',
    configured:enabled&&!!authorizeOperator&&!!loadVerifiedGrants&&!!loadAuthorizedObservations,
    automaticCollection:false,
    async run({operatorContext=null}={}){
      if(!enabled||!authorizeOperator||!loadVerifiedGrants||!loadAuthorizedObservations)
        return unavailable('AUTHENTICATED_LICENSED_COLLECTORS_NOT_CONFIGURED');
      try{
        if(await authorizeOperator(operatorContext)!==true)
          return unavailable('OPERATOR_NOT_AUTHORIZED');
        const at=now();
        if(!Number.isSafeInteger(at)||at<0)
          return unavailable('INVALID_OBSERVATION_CLOCK');
        // This function must be a protected service-controlled license registry;
        // the client is not permitted to issue or override a grant.
        const grants=await loadVerifiedGrants({target,asOf:at});
        if(!Array.isArray(grants)||grants.length<2||grants.length>80)
          return unavailable('VERIFIED_COMMERCIAL_PRODUCT_GRANTS_REQUIRED');
        const allowed=grants.filter(g=>g?.status==='VERIFIED'&&
          g.permission==='COMMERCIAL_PUBLIC_DISPLAY_AND_DERIVATION'&&
          typeof g.sourceId==='string'&&typeof g.productId==='string'&&
          typeof g.evidenceId==='string'&&g.evidenceId.length>=8&&
          Number.isFinite(Date.parse(g.validUntil))&&Date.parse(g.validUntil)>at);
        if(allowed.length<2)
          return unavailable('VERIFIED_COMMERCIAL_PRODUCT_GRANTS_REQUIRED');
        // Never ask adapters for unlicensed products.
        const approvedProducts=allowed.map(g=>({
          sourceId:g.sourceId,productId:g.productId
        }));
        const observations=await loadAuthorizedObservations({
          target,asOf:at,approvedProducts
        });
        if(!observations||typeof observations!=='object'||Array.isArray(observations))
          return unavailable('AUTHORIZED_OBSERVATIONS_UNAVAILABLE');
        const fusion=prepareRjLicensedLocalWeatherFusion({
          target,observations,grants:allowed,now:at
        });
        // Data values, subscriber identity, question content and raw audio
        // are intentionally excluded from bounded operational telemetry.
        try{onAudit(Object.freeze({
          event:'licensed_fusion_attempt',at:new Date(at).toISOString(),
          agentId:'geodados-fusao-licenciada',status:fusion.status,
          availableMetrics:Object.entries(fusion.metrics??{}).filter(([,v])=>
            v.status==='AUTHORIZED_LOCAL_WEIGHTED_ESTIMATE').map(([k])=>k)
        }));}catch{ /* telemetry must never replace a failed validation with success */ }
        return fusion;
      }catch{
        return unavailable('VERIFIED_SOURCE_ADAPTER_OR_REGISTRY_UNAVAILABLE');
      }
    }
  });
}
