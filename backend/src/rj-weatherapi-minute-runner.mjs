import {planWeatherApiMinute}
from './rj-weatherapi-free-auto-plan.mjs';

import {collectRjWeatherApiFreeOne}
from './rj-weatherapi-free-92-collector.mjs';

export async function runWeatherApiMinute({
  enabled = false,
  operatorApproved = false,
  clock = () => Date.now(),
  collect = collectRjWeatherApiFreeOne,
  env = {},
  reserve,
  cache,
  fetchImpl
} = {}) {

  const now = clock();
  const plan = planWeatherApiMinute({now});

  const result = {
    planned:plan.municipalities.length,
    attempts:0,
    saved:0,
    providerCalls:0,
    publicationEnabled:false,
    paidCallsAllowed:false,
    results:[]
  };

  if(enabled !== true ||
     operatorApproved !== true)
    return {
      ...result,
      status:'DRY_RUN'
    };

  if(typeof reserve !== 'function' ||
     typeof cache?.save !== 'function' ||
     typeof fetchImpl !== 'function')
    return {
      ...result,
      status:'SAFETY_GATE_CLOSED'
    };

  if(plan.municipalities.length > 3)
    throw Error('INVALID_MINUTE_LIMIT');

  for(const ibge of plan.municipalities){

    if(Math.floor(clock()/60000) !==
       Math.floor(now/60000))
      return {
        ...result,
        status:'MINUTE_EXPIRED'
      };

    result.attempts++;

    let r;

    try {
      r = await collect({
        ibge,env,reserve,cache,
        fetchImpl,clock
      });
    } catch {
      return {
        ...result,
        status:'COLLECTOR_FAILURE'
      };
    }

    if(r?.providerContacted === true)
      result.providerCalls++;

    result.results.push({
      ibge,
      saved:r?.status === 'PRIVATE_CACHE_SAVED'
    });

    if(r?.status === 'PRIVATE_CACHE_SAVED' &&
       r.providerContacted === true){

      result.saved++;
      continue;
    }

    return {
      ...result,
      status:'SAFETY_STOP'
    };
  }

  return {
    ...result,
    status:'MINUTE_COMPLETED'
  };
}
