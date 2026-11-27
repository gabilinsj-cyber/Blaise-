import geo from './rj-ibge-92-points.json'
with {type:'json'};

import {
  WEATHERAPI_INTERNAL_MONTHLY_CEILING,
  WEATHERAPI_FREE_MONTHLY_QUOTA
} from './rj-weatherapi-free-92-plan.mjs';

const cities = geo.points.map(p => String(p.ibge));

const priority = ['3304557','3303302'];

if(cities.length !== 92 ||
   new Set(cities).size !== 92 ||
   priority.some(c => !cities.includes(c)))
  throw Error('INVALID_RJ_COVERAGE');

const regular = cities.filter(
  c => !priority.includes(c)
);

const slots = Array.from(
  {length:60}, () => []
);

regular.forEach((ibge,i)=>{
  slots[Math.floor(i*60/regular.length)]
    .push(ibge);
});

slots[0].push(priority[0]);
slots[30].push(priority[0]);
slots[15].push(priority[1]);
slots[45].push(priority[1]);

export function planWeatherApiMinute({
  now = Date.now()
} = {}) {

  if(!Number.isSafeInteger(now) ||
     now < 0 ||
     !Number.isFinite(new Date(now).getTime()))
    throw Error('INVALID_CLOCK');

  const minute = new Date(now).getUTCMinutes();

  return Object.freeze({
    minute,
    municipalities:Object.freeze([...slots[minute]]),
    automaticCollection:false,
    publicationEnabled:false,
    paidCallsAllowed:false
  });
}

export function planWeatherApiMonthly({
  year = 2026,
  month = 12
} = {}) {

  if(!Number.isInteger(year) ||
     year < 2026 || year > 2100 ||
     !Number.isInteger(month) ||
     month < 1 || month > 12)
    throw Error('INVALID_MONTH');

  const days = new Date(
    Date.UTC(year,month,0)
  ).getUTCDate();

  const hourlyCalls = slots.flat().length;
  const monthlyCalls = hourlyCalls * 24 * days;

  return Object.freeze({
    municipalities:92,
    priorityMunicipalities:2,
    regularMunicipalities:90,
    priorityIntervalMinutes:30,
    regularIntervalMinutes:60,
    hourlyCalls,
    dailyCalls:hourlyCalls*24,
    monthlyCalls,
    internalCap:WEATHERAPI_INTERNAL_MONTHLY_CEILING,
    providerQuota:WEATHERAPI_FREE_MONTHLY_QUOTA,
    internalMargin:
      WEATHERAPI_INTERNAL_MONTHLY_CEILING-monthlyCalls,
    withinBudget:
      monthlyCalls<=WEATHERAPI_INTERNAL_MONTHLY_CEILING,
    automaticCollection:false,
    publicationEnabled:false,
    paidCallsAllowed:false
  });
}
