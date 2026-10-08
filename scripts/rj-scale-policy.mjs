// Blaise V6 RJ - verified subscriber thresholds, no purchasing or deployment.
export const SCALE_REVIEW_THRESHOLD = 500_000;
export const SCALE_EARLY_REVIEW_THRESHOLD = 400_000;

export function evaluateScaleReadiness({activeSubscribers,observedAt,lastReportedMilestone,now=new Date()}={}) {
  if(activeSubscribers===undefined || activeSubscribers===null || activeSubscribers==='' || !observedAt) {
    return {status:'NOT_CONFIGURED',reason:'verified_subscriber_count_and_timestamp_required',action:'CONNECT_AUTHORIZED_SUBSCRIPTION_METRIC'};
  }
  const str=String(activeSubscribers);
  if(!/^\d{1,12}$/.test(str))return {status:'INVALID_INPUT',reason:'subscriber_count_must_be_nonnegative_integer'};
  const count=Number(str);
  if(!Number.isSafeInteger(count))return {status:'INVALID_INPUT',reason:'subscriber_count_overflow'};
  if(typeof observedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(observedAt))
    return {status:'INVALID_INPUT',reason:'timestamp_must_be_utc_iso8601'};
  const date=new Date(observedAt);
  if(!Number.isFinite(date.getTime()))return {status:'INVALID_INPUT',reason:'invalid_observation_time'};
  const nowDate = now instanceof Date ? now : new Date(now);
  if(!Number.isFinite(nowDate.getTime()))return {status:'INVALID_INPUT',reason:'invalid_clock'};
  const age=nowDate.getTime()-date.getTime();
  if(age < -2*60_000)return {status:'INVALID_INPUT',reason:'subscriber_data_from_future'};
  if(age>24*60*60_000)return {status:'STALE_METRIC',reason:'verified_subscriber_metric_older_than_24h',count,observedAt};

  const reachedMilestone=Math.floor(count/SCALE_REVIEW_THRESHOLD)*SCALE_REVIEW_THRESHOLD;
  if(reachedMilestone===0) {
    if(count>=SCALE_EARLY_REVIEW_THRESHOLD)return {status:'EARLY_REVIEW_400K',count,observedAt,nextMilestone:SCALE_REVIEW_THRESHOLD,action:'START_LOAD_TESTS_AND_PROVIDER_QUOTES'};
    return {status:'BELOW_THRESHOLD',count,observedAt,nextMilestone:SCALE_REVIEW_THRESHOLD,action:'CONTINUE_CAPACITY_MONITORING'};
  }

  // A durable, authenticated record of sent reports is essential to prevent repeated notices.
  if(lastReportedMilestone===undefined || lastReportedMilestone===null || lastReportedMilestone==='') {
    return {status:'REPORT_HISTORY_NOT_CONFIGURED',count,observedAt,reachedMilestone,action:'CONNECT_DURABLE_REPORT_HISTORY'};
  }
  const previous=String(lastReportedMilestone);
  if(!/^\d{1,12}$/.test(previous))return {status:'INVALID_INPUT',reason:'last_reported_milestone_must_be_integer'};
  const previousNum=Number(previous);
  if(!Number.isSafeInteger(previousNum) || previousNum%SCALE_REVIEW_THRESHOLD!==0 || previousNum>reachedMilestone) {
    return {status:'INVALID_INPUT',reason:'last_reported_milestone_invalid'};
  }
  if(reachedMilestone===previousNum)return {status:'MILESTONE_ALREADY_REPORTED',count,observedAt,reachedMilestone,nextMilestone:reachedMilestone+SCALE_REVIEW_THRESHOLD,action:'CONTINUE_CAPACITY_MONITORING'};
  const pendingMilestones=[];
  for(let marker=previousNum+SCALE_REVIEW_THRESHOLD;marker<=reachedMilestone;marker+=SCALE_REVIEW_THRESHOLD) {
    pendingMilestones.push(marker);
  }
  return {
    status:'MILESTONE_REPORT_DUE',count,observedAt,reachedMilestone,lastReportedMilestone:previousNum,pendingMilestones,
    nextMilestone:reachedMilestone+SCALE_REVIEW_THRESHOLD,
    action:'RESEARCH_SECURITY_CAPACITY_STORAGE_QUOTE_USD_EUR_AND_REQUEST_OWNER_APPROVAL',
    note:'No purchases, automated reclassification, deployed code changes or emails are performed by this policy.'
  };
}
