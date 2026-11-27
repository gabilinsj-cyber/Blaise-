import geo from './rj-ibge-92-points.json'
with {type:'json'};

import {parseVisualCrossingPrivateSample}
from './rj-visual-crossing-free-private.mjs';

import {normalizeVisualCrossingCacheRecord}
from './rj-visual-crossing-free-cache.mjs';

const points = new Map(
  geo.points.map(p => [String(p.ibge), p])
);

export async function collectVisualCrossingDaily({
  ibge, apiKey, approval = {},
  ledger, cache, fetchImpl,
  clock = () => Date.now()
} = {}) {

  const result = (status, contacted = false) => ({
    status,
    providerContacted: contacted,
    publicationEnabled: false
  });

  if (approval.enabled !== true ||
      approval.freePlanConfirmed !== true ||
      approval.paidAllowed !== false ||
      approval.autoTopupDisabled !== true ||
      approval.exclusiveAccountUseConfirmed !== true ||
      approval.operatorApproved !== true ||
      approval.costVerified !== true ||
      approval.rollingWindowConfirmed !== true ||
      typeof fetchImpl !== 'function' ||
      typeof ledger?.reserve !== 'function' ||
      typeof cache?.save !== 'function')
    return result('BLOCKED');

  const city = String(ibge);
  const point = points.get(city);

  if (!point ||
      typeof apiKey !== 'string' ||
      !/^[A-Za-z0-9_-]{8,180}$/.test(apiKey))
    return result('INVALID_CONFIGURATION');

  const url = new URL(
    'https://weather.visualcrossing.com/' +
    'VisualCrossingWebServices/rest/services/timeline/' +
    point.lat.toFixed(4) + ',' +
    point.lon.toFixed(4)
  );

  url.searchParams.set('key', apiKey);
  url.searchParams.set('unitGroup', 'metric');
  url.searchParams.set('include', 'current');
  url.searchParams.set('contentType', 'json');
  url.searchParams.set('elements',
    'datetimeEpoch,temp,feelslike,humidity,dew,' +
    'windspeed,windgust,precip,precipprob,pressure,' +
    'severerisk,conditions'
  );

  let reserved;

  try {
    reserved = await ledger.reserve(approval);
  } catch {
    return result('BUDGET_UNAVAILABLE');
  }

  if (reserved?.approved !== true)
    return result('DAILY_LIMIT_BLOCKED');

  const now = clock();

  if (!Number.isSafeInteger(now) ||
      now < 0 ||
      now % 86400000 > 86370000 ||
      new Date(now).toISOString().slice(0,10) !==
        approval.confirmedDay)
    return result('DAY_CHANGED_OR_RESET_NEAR');

  try {
    const response = await fetchImpl(url.href, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(12000)
    });

    if (response.status !== 200)
      return result('PROVIDER_ERROR', true);

    const body = await response.text();

    if (body.length > 300000)
      return result('RESPONSE_TOO_LARGE', true);

    const raw = JSON.parse(body);

    if (raw.queryCost !== 1)
      return result('UNEXPECTED_COST_STOP', true);

    const sample = parseVisualCrossingPrivateSample(
      raw, {ibge: city, now: clock()}
    );

    if (!normalizeVisualCrossingCacheRecord(
      sample, {now: clock()}
    ))
      return result('INVALID_OR_EXPIRED_DATA', true);

    const receipt = await cache.save(sample);

    if (receipt?.saved !== true)
      return result('CACHE_NOT_CONFIRMED', true);

    return result('PRIVATE_CACHE_SAVED', true);

  } catch {
    return result('COLLECTION_FAILED', true);
  }
}
