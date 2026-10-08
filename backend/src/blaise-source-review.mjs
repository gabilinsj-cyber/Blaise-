/** Alert authority and derived analyses remain separate; scales are ordinal, never averaged. */
export function reviewBlaiseEvidence({ officialAlerts=[], analyses=[], now=Date.now() }={}) {
 if (!Number.isFinite(now)) throw TypeError('invalid_clock');
 const excluded=[];
 const valid = (items, kind) => items.filter(item=>{
  const start=Date.parse(item.validFrom),end=Date.parse(item.validUntil);
  const reason=!item.sourceId||!item.independentSourceId||!item.sourceUrl?.startsWith('https://')||!item.scopeId||!item.phenomenon||!Number.isInteger(item.level)||item.level<1||item.level>5||!Number.isFinite(start)||!Number.isFinite(end)||end<=start?'invalid_contract':now<start?'not_yet_valid':now>=end?'expired':null;
  if(reason){excluded.push({sourceId:item.sourceId??null,kind,reason});return false;}return true;
 });
 const alerts=valid(officialAlerts,'official_alert');const calculated=valid(analyses,'blaise_analysis');
 const discrepancies=[];
 for(const alert of alerts){
  const comparable=calculated.filter(a=>a.scopeId===alert.scopeId&&a.phenomenon===alert.phenomenon);
  if(comparable.some(a=>a.level!==alert.level)) discrepancies.push({officialSourceId:alert.sourceId,officialLevel:alert.level,analysisLevels:comparable.map(a=>a.level),scopeId:alert.scopeId,phenomenon:alert.phenomenon,state:'DIVERGENCE_REVIEW_REQUIRED',mayDiscardOfficialAlert:false});
 }
 return {officialAlerts:alerts.map(a=>({...a,nature:'ALERTA_OFICIAL'})),analyses:calculated.map(a=>({...a,nature:'CALCULO_BLAISE'})),discrepancies,excluded,policy:'PRESERVE_VALID_OFFICIAL_ALERT_NO_ORDINAL_AVERAGING',generatedAt:new Date(now).toISOString()};
}

/** Only comparable, independent observations can flag a numeric candidate for review. */
export function reviewNumericCandidate(candidate, corroborators,{maxAgeMs,maxSkewMs,tolerance,now=Date.now()}={}){
 if (![maxAgeMs,maxSkewMs,tolerance,now].every(Number.isFinite)||maxAgeMs<=0||maxSkewMs<0||tolerance<0)throw TypeError('validated_review_limits_required');
 const valid=r=>r&&Number.isFinite(r.value)&&r.sourceId&&r.independentSourceId&&r.sourceUrl?.startsWith('https://')&&r.scopeId&&r.unit&&r.variable&&r.nature==='OBSERVADO'&&Number.isFinite(Date.parse(r.observedAt))&&now-Date.parse(r.observedAt)>=0&&now-Date.parse(r.observedAt)<=maxAgeMs;
 if(!valid(candidate))return {state:'EXCLUDED_FROM_CALCULATION',reason:'invalid_or_stale',officialAlertAffected:false};
 const peers=corroborators.filter(r=>valid(r)&&r.independentSourceId!==candidate.independentSourceId&&['scopeId','unit','variable','nature'].every(k=>r[k]===candidate[k])&&Math.abs(Date.parse(r.observedAt)-Date.parse(candidate.observedAt))<=maxSkewMs);
 const seen=new Set();const unique=peers.filter(r=>!seen.has(r.independentSourceId)&&seen.add(r.independentSourceId));
 const agreement=unique.length>=2&&Math.max(...unique.map(r=>r.value))-Math.min(...unique.map(r=>r.value))<=tolerance;
 const discrepant=agreement&&unique.every(r=>Math.abs(r.value-candidate.value)>tolerance);
 return {state:discrepant?'QUARANTINED_FOR_REVIEW':'INSUFFICIENT_EVIDENCE_TO_REJECT',reason:discrepant?'two_independent_comparable_sources_disagree':'no_comparable_consensus',sources:unique.map(r=>r.sourceId),provenWrong:false,officialAlertAffected:false};
}

/** User-selected automatic delivery gate; never changes the displayed official level. */
export function category5DeliveryGate({officialAlerts=[],analyses=[],scopeId,phenomenon,now=Date.now()}={}){
 const review=reviewBlaiseEvidence({officialAlerts,analyses,now});
 const authorities=new Set(review.officialAlerts.filter(a=>a.level===5&&a.scopeId===scopeId&&a.phenomenon===phenomenon).map(a=>a.independentSourceId));
 const blaiseConfirmed=review.analyses.some(a=>a.level===5&&a.scopeId===scopeId&&a.phenomenon===phenomenon);
 const allowed=authorities.size>=2&&blaiseConfirmed;
 return {automaticAlarm:allowed,automaticVoice:allowed,siren:allowed,vibration:allowed,
  officialAlertRemainsVisible:true,independentOfficialSources:authorities.size,blaiseConfirmed,
  reason:allowed?'CATEGORY5_CONVERGENCE_CONFIRMED':'VISIBLE_ONLY_PENDING_CONVERGENCE'};
}
