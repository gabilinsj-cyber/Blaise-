// Blaise V6 RJ - pure verification of scaling milestone. Does not buy or deploy.
export const SCALE_REVIEW_THRESHOLD = 500_000;
export const SCALE_EARLY_REVIEW_THRESHOLD = 400_000;
export function evaluateScaleReadiness({activeSubscribers,observedAt,now=new Date()}={}) {
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
  const age = nowDate.getTime()-date.getTime();
  if(age < -2*60_000)return {status:'INVALID_INPUT',reason:'subscriber_data_from_future'};
  if(age>24*60*60_000)return {status:'STALE_METRIC',reason:'verified_subscriber_metric_older_than_24h',count,observedAt};
  if(count>=SCALE_REVIEW_THRESHOLD)return {status:'REVIEW_REQUIRED_500K',count,observedAt,action:'CAPACITY_SECURITY_STORAGE_AND_COST_REVIEW'};
  if(count>=SCALE_EARLY_REVIEW_THRESHOLD)return {status:'EARLY_REVIEW_400K',count,observedAt,action:'START_LOAD_TESTS_AND_PROVIDER_QUOTES'};
  return {status:'BELOW_THRESHOLD',count,observedAt,action:'CONTINUE_CAPACITY_MONITORING'};
}
