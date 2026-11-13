/**
 * Exclusions by USER choice for Blaise V6 RJ.
 * SOS Chuva is NOT an active provider, fallback, mirror, radar or map layer.
 * This does not ban INPE/CPTEC's separately authorized scientific products,
 * nor NOAA GOES-19/GLM data obtained directly from NOAA.
 */
export const RJ_SOS_CHUVA_POLICY=Object.freeze({
  sourceId:'SOS_CHUVA_CPTEC_INPE',
  state:'EXCLUDED',
  dataIngestion:false,
  fallback:false,
  mapLayers:false,
  radarFrames:false,
  displayAsExternalReference:false,
  notes:'Do not retrieve, reproduce or repackage SOS Chuva products. CPTEC/INPE is not globally excluded.'
});
const EXCLUDED_SOURCE_IDS=new Set([
  'SOS_CHUVA','SOSCHUVA','SOS_CHUVA_CPTEC_INPE','INPE_SOS_CHUVA'
]);
/** Check product provenance, not only branding: a renamed feed stays excluded. */
export function isExcludedSosChuvaProduct(record){
  if(!record||typeof record!=='object')return false;
  for(const field of ['sourceId','originalSourceId','originalProducerId','productId','upstreamProductId']){
    const v=record[field];
    if(typeof v==='string'&&EXCLUDED_SOURCE_IDS.has(v.toUpperCase().replace(/[ -]/g,'_')))
      return true;
  }
  for(const field of ['sourceUrl','originalSourceUrl','upstreamUrl','productUrl']){
    if(typeof record[field]!=='string')continue;
    try{
      const url=new URL(record[field]);
      if((url.hostname==='satelite.cptec.inpe.br'||
          url.hostname.endsWith('.satelite.cptec.inpe.br'))&&
          /^\/soschuvaapp(?:\/|$)/i.test(url.pathname))return true;
    }catch{/* unrelated invalid URLs are rejected by their own contract */}
  }
  return false;
}
