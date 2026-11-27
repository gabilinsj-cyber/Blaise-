import {runWeatherApiMinute}
from './rj-weatherapi-minute-runner.mjs';

export function createWeatherApiMinuteLock({db}={}) {

  if(typeof db?.runTransaction !== 'function')
    throw Error('DATABASE_REQUIRED');

  const ref = db.collection(
    'blaise_rj_weatherapi_scheduler_guard_v1'
  ).doc('weatherapi-minute');

  return Object.freeze({

    async claim(now){

      if(!Number.isSafeInteger(now) || now<0)
        throw Error('INVALID_CLOCK');

      const minute=Math.floor(now/60000);

      return db.runTransaction(async tx=>{

        const snapshot=await tx.get(ref);

        if(snapshot.exists){

          const previous=snapshot.data().lastMinute;

          if(!Number.isSafeInteger(previous) ||
             previous<0)
            throw Error('INVALID_LOCK_STATE');

          if(previous>=minute)
            return false;
        }

        tx.set(ref,{
          lastMinute:minute,
          reservedAtMs:now,
          publicationEnabled:false
        });

        return true;
      });
    }
  });
}

export async function runLockedWeatherApiMinute({
  lock,
  enabled=false,
  operatorApproved=false,
  clock=()=>Date.now(),
  ...options
}={}){

  const blocked=status=>({
    status,
    providerCalls:0,
    publicationEnabled:false,
    paidCallsAllowed:false
  });

  if(enabled!==true || operatorApproved!==true)
    return blocked('DRY_RUN');

  if(typeof lock?.claim!=='function' ||
     typeof options.reserve!=='function' ||
     typeof options.cache?.save!=='function' ||
     typeof options.fetchImpl!=='function')
    return blocked('SAFETY_GATE_CLOSED');

  const now=clock();

  try{
    if(await lock.claim(now)!==true)
      return blocked('DUPLICATE_MINUTE_BLOCKED');
  }catch{
    return blocked('LOCK_UNAVAILABLE');
  }

  if(Math.floor(clock()/60000)!==
     Math.floor(now/60000))
    return blocked('MINUTE_EXPIRED');

  let first=true;

  return runWeatherApiMinute({
    ...options,
    enabled,
    operatorApproved,
    clock:()=>{
      if(first){
        first=false;
        return now;
      }
      return clock();
    }
  });
}
