/**
 * Isolated central driver for the Agent 13 one-minute freshness analysis.
 * No timer/cron, provider HTTP, quota reservation, Google Cloud creation,
 * secret read, or client publication. A SINGLE authorized Cloud Scheduler job
 * may call tick() later using a distributed lease and shared cached samples.
 */
import {auditAgent13Minute,AGENT13_MINUTE_AUDIT_MS}
 from './rj-agent13-freshness-supervisor.mjs';

const safe=(status,reason)=>Object.freeze({
 status,reason,
 providerCalls:0,creditReservations:0,
 proposalsStaged:0,publishedToClients:false,
});
export function createAgent13ReadOnlyMinuteWorker({
 enabled=false,operatorApproved=false,readSharedSourceCache=null,
 readLastPublishedMetadata=null,tryAcquireMinuteLease=null,
 readPrivateInmetConflictReviews=null,
 stagePrivateProposals=null,clock=()=>Date.now()
}={}){
 const configured=enabled===true&&operatorApproved===true&&
  typeof readSharedSourceCache==='function'&&
  typeof readLastPublishedMetadata==='function'&&
  typeof tryAcquireMinuteLease==='function'&&
  typeof stagePrivateProposals==='function'&&typeof clock==='function';
 async function tick({selectedMunicipalityIbges=[],enabledSources={}}={}){
  if(!configured)return safe('BLOCKED','SUPERVISOR_NOT_AUTHORIZED');
  const now=clock();
  if(!Number.isSafeInteger(now)||now<0)
   return safe('BLOCKED','INVALID_CLOCK');
  const minute=Math.floor(now/AGENT13_MINUTE_AUDIT_MS);
  let lease;
  try{
   lease=await tryAcquireMinuteLease({minute,leaseKey:'agent13:minute:all92',at:now});
  }catch{return safe('BLOCKED','SHARED_LEASE_UNAVAILABLE');}
  if(lease?.acquired!==true)return safe('BLOCKED','MINUTE_ALREADY_CLAIMED');
  let rows,existing;
  try{
   [rows,existing]=await Promise.all([
    readSharedSourceCache({minute,at:now}),
    readLastPublishedMetadata({minute,at:now})
   ]);
  }catch{return safe('BLOCKED','SHARED_SOURCE_CACHE_UNAVAILABLE');}
  let result;
  try{
   result=auditAgent13Minute({nowMs:now,rows,existing,
    selectedMunicipalityIbges,enabledSources});
  }catch{return safe('BLOCKED','SOURCE_AUDIT_INCOMPLETE');}
  // Only actual verified conflicts may consult an already-reviewed INTERNAL
  // INMET panel evidence record. Never request the INMET website here.
  if(result.heldForConflictCount>0 &&
     typeof readPrivateInmetConflictReviews==='function'){
   try{
    const privateReviews=await readPrivateInmetConflictReviews({
     conflictKeys:result.heldFields,minute,at:now
    });
    if(privateReviews&&typeof privateReviews==='object'&&!Array.isArray(privateReviews))
     result=auditAgent13Minute({nowMs:now,rows,existing,
      selectedMunicipalityIbges,enabledSources,privateInmetReviews:privateReviews});
   }catch{
    // Keep each unresolved conflict on HOLD; do not block other safe fields.
   }
  }
  // This is a private queue only. The public release gate is deliberately
  // absent; no fake current data can reach the subscription dashboard.
  try{
   if(result.proposedUpdates.length>0){
    const receipt=await stagePrivateProposals({
     minute,proposals:result.proposedUpdates,
     contract:result.contract
    });
    if(receipt?.staged!==true)
      return safe('BLOCKED','PRIVATE_STAGING_FAILED');
   }
  }catch{return safe('BLOCKED','PRIVATE_STAGING_FAILED');}
  return Object.freeze({
   status:'PRIVATE_MINUTE_AUDIT_COMPLETED',
   reason:null,minute,
   inspectedRows:result.inspectedRows,
   eligibleRows:result.eligibleRows,
   rejectedRows:result.rejectedCount,
   conflictsHeld:result.heldForConflictCount,
   conflictsResolvedWithPrivateInmetReview:result.resolvedByPrivateInmetCount,
   proposalsStaged:result.proposedUpdates.length,
   providerCalls:0,creditReservations:0,
   publishedToClients:false,
   releaseAuthorized:false
  });
 }
 return Object.freeze({
  configured:Boolean(configured),tick,
  intervalMs:AGENT13_MINUTE_AUDIT_MS,
  automaticSchedulingEnabled:false,
  requiresExternalSharedScheduler:true,
  canCallWeatherProviders:false,
  canPublishToSubscribers:false
 });
}
