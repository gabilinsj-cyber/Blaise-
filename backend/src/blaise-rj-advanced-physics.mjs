/**
 * Additional numerical kernels for Blaise Vector RJ.
 * SI units. No direct warnings or weather predictions; callers must enforce
 * official data provenance, locality, calibration and time consistency.
 */
export const RJ_ADVANCED_PHYSICS_VERSION = 'blaise-rj-physics-2026-10-10-v1';
const finite = (value, name, min=-Infinity, max=Infinity) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value<min || value>max) {
    throw new RangeError(`invalid_${name}`);
  }
  return value;
};
const result = (value, unit, formula, metadata={}) => {
  finite(value, 'calculated_result');
  return Object.freeze({
    value, unit, formula, methodVersion: RJ_ADVANCED_PHYSICS_VERSION,
    nature: 'CALCULO_EXPERIMENTAL_BLAISE', officialMeasurement:false,
    officialAlert:false, mayTriggerAlert:false, ...metadata,
  });
};

export function linearFeatureAdvection({
  initialEastM, initialNorthM, eastVelocityMs, northVelocityMs, leadSeconds,
}) {
  finite(initialEastM,'x0'); finite(initialNorthM,'y0');
  finite(eastVelocityMs,'east_velocity',-150,150);
  finite(northVelocityMs,'north_velocity',-150,150);
  finite(leadSeconds,'lead_seconds',0,7200);
  return Object.freeze({
    eastM: initialEastM + eastVelocityMs*leadSeconds,
    northM: initialNorthM + northVelocityMs*leadSeconds,
    speedMs: Math.hypot(eastVelocityMs,northVelocityMs),
    leadSeconds,
    method:'x(t)=x0+v*t in a local metric coordinate system',
    methodVersion:RJ_ADVANCED_PHYSICS_VERSION,
    nature:'CALCULO_EXPERIMENTAL_BLAISE',
    officialAlert:false, mayTriggerAlert:false,
    limitation:'Only for a tracked feature with measured motion; no new radar pixels, rain or impact forecast.',
  });
}

function saturationVaporPressureHpa(T) {
  finite(T,'temperature',-45,60);
  return 6.112*Math.exp(17.67*T/(T+243.5));
}
export function vaporPressureFromDewPoint({dewPointC}) {
  return result(saturationVaporPressureHpa(dewPointC),'hPa','Bolton_Magnus_saturation_vapor_pressure',
    { limitation:'Approximation for liquid-water phase; dew point must be directly validated.' });
}
export function relativeHumidityFromDewPoint({temperatureC,dewPointC}) {
  finite(temperatureC,'temperature',-45,60);
  finite(dewPointC,'dew_point',-45,temperatureC+0.2);
  const rh=100*saturationVaporPressureHpa(dewPointC)/saturationVaporPressureHpa(temperatureC);
  return result(Math.min(rh,100),'%','Magnus_vapor_pressure_ratio',
    {limitation:'Td and T must be matched in time and location; result is derived, not station RH.'});
}
export function mixingRatio({vaporPressurePa,ambientPressurePa}) {
  finite(ambientPressurePa,'ambient_pressure',10000,110000);
  finite(vaporPressurePa,'vapor_pressure',0,10000);
  if(vaporPressurePa>=ambientPressurePa) throw RangeError('vapor_pressure_must_be_less_than_total');
  return result(0.622*vaporPressurePa/(ambientPressurePa-vaporPressurePa),
    'kg/kg','epsilon*e/(p-e)',{limitation:'Input e and p must come from the same air parcel.'});
}
export function specificHumidityFromMixingRatio({mixingRatioKgKg}) {
  finite(mixingRatioKgKg,'mixing_ratio',0,0.1);
  return result(mixingRatioKgKg/(1+mixingRatioKgKg),'kg/kg','r/(1+r)');
}
export function observedEnvironmentalLapseRate({temperatureAtBottomC,temperatureAtTopC,bottomHeightM,topHeightM}) {
  finite(temperatureAtBottomC,'lower_temp',-90,60);
  finite(temperatureAtTopC,'upper_temp',-90,60);
  finite(bottomHeightM,'bottom_height',-500,18000);
  finite(topHeightM,'top_height',-500,25000);
  if(topHeightM-bottomHeightM<50)throw RangeError('vertical_separation_required');
  return result((temperatureAtBottomC-temperatureAtTopC)/(topHeightM-bottomHeightM)*1000,
    '°C/km','-(T_top-T_bottom)/delta_z',
    {limitation:'Observed environmental lapse rate, NOT necessarily the dry adiabatic 9.8 C/km value.'});
}
export function meanVirtualTemperatureSeaLevelPressure({
  stationPressurePa,stationHeightM,meanVirtualTemperatureK,
}) {
  finite(stationPressurePa,'station_pressure',30000,110000);
  finite(stationHeightM,'height',-500,5500);
  finite(meanVirtualTemperatureK,'mean_virtual_temperature',180,330);
  return result(stationPressurePa*Math.exp(9.80665*stationHeightM/(287.05*meanVirtualTemperatureK)),
    'Pa','hypsometric_sea_level_reduction',
    {limitation:'Requires justified mean virtual temperature through the air column; not a standard unverified sea-level observation.'});
}
export function wetBulbStullApprox({temperatureC,relativeHumidityPercent}) {
  finite(temperatureC,'temperature',-20,50);
  finite(relativeHumidityPercent,'relative_humidity',5,99);
  const T=temperatureC, RH=relativeHumidityPercent;
  const wet=T*Math.atan(0.151977*Math.sqrt(RH+8.313659))
    +Math.atan(T+RH)-Math.atan(RH-1.676331)
    +0.00391838*RH**1.5*Math.atan(0.023101*RH)-4.686035;
  return result(wet,'°C','Stull_2011_empirical_wet_bulb',
    {limitation:'Empirical approximation, not psychrometric measurement; valid only for bounded T/RH domain.'});
}

/**
 * Integrated 5/10/15/30/60/1440 minute rain, from complete NON-overlapping
 * timed observational intervals (no interpolation, duplicated slots or gaps).
 */
export function verifiedRainfallAccumulation({observations,windowStart,windowEnd}) {
  const start=Date.parse(windowStart),end=Date.parse(windowEnd);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start
      || ![5,10,15,30,60,1440].includes((end-start)/60000))throw RangeError('unsupported_rain_window');
  if(!Array.isArray(observations)||observations.length<1||observations.length>1440)
    throw TypeError('rain_intervals_required');
  const ordered=[...observations].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  let cursor=start,total=0;
  const stationId=ordered[0]?.stationId;
  if(typeof stationId!=='string'||!stationId.trim())throw TypeError('same_station_required');
  for(const obs of ordered) {
    const a=Date.parse(obs.start),b=Date.parse(obs.end);
    finite(obs.rainfallMm,'rainfall',0,400);
    if(obs.stationId!==stationId||obs.verified!==true
       ||!Number.isFinite(a)||!Number.isFinite(b)||b<=a||a!==cursor||b>end)
      throw RangeError('gaps_overlap_or_unverified_rain');
    cursor=b;total+=obs.rainfallMm;
  }
  if(cursor!==end)throw RangeError('incomplete_rain_window');
  return result(total,'mm','complete_verified_interval_sum',
    {stationId,windowStart,windowEnd,intervalCount:ordered.length,
      limitation:'One station accumulation, not an area mean. Cannot be interpolated without authorized spatial evidence.'});
}

/** Radar Z–R relationship requires documented instrument+region calibration. */
export function calibratedZrRainRate({reflectivityDbz,calibration,scopeId}) {
  finite(reflectivityDbz,'dbz',-20,75);
  if(calibration?.status!=='CALIBRATED' || calibration?.scopeId!==scopeId
     || !/^municipality:33\d{5}$/.test(scopeId||'')
     || typeof calibration.version!=='string'||!calibration.version
     || !['S','C','X'].includes(calibration.radarBand))
    throw TypeError('validated_radar_calibration_required');
  finite(calibration.a,'zr_a',1,1000);
  finite(calibration.b,'zr_b',0.5,3);
  const z=10**(reflectivityDbz/10);
  const r=(z/calibration.a)**(1/calibration.b);
  return result(r,'mm/h','Z=a*R^b_with_station_calibration',
    {scopeId,calibrationVersion:calibration.version,radarBand:calibration.radarBand,
      limitation:'Radar-estimated rate, not gauge observation; beam blockage, hail, attenuation and VPR need quality control.'});
}

/** Supplied parcel and environment virtual-temperature profiles; no CAPE
 * can be calculated by guessing the parcel lifting trajectory.
 */
export function parcelBuoyancyEnergy({levels,minimumTopHeightM=6000}) {
  finite(minimumTopHeightM,'minimum_top_height',1000,18000);
  if(!Array.isArray(levels)||levels.length<3||levels.length>500)throw TypeError('virtual_temperature_profiles_required');
  let cape=0,cin=0;
  for(let i=0;i<levels.length;i++){
    const l=levels[i];
    finite(l.heightM,'height',0,30000);
    finite(l.parcelVirtualTemperatureK,'parcel_virtual',180,350);
    finite(l.environmentVirtualTemperatureK,'environment_virtual',180,350);
    if(i && l.heightM<=levels[i-1].heightM)throw RangeError('ordered_profile_required');
    if(i && l.heightM-levels[i-1].heightM>500)throw RangeError('vertical_profile_gap');
  }
  if(levels[0].heightM>250 || levels.at(-1).heightM<minimumTopHeightM)
    throw RangeError('insufficient_profile_extent');
  for(let i=1;i<levels.length;i++) {
    const a=levels[i-1],b=levels[i],dz=b.heightM-a.heightM;
    const buoy=l=>9.80665*(l.parcelVirtualTemperatureK-l.environmentVirtualTemperatureK)/l.environmentVirtualTemperatureK;
    let y0=buoy(a),y1=buoy(b);
    // Crossings are split to integrate positive and negative areas.
    if(y0*y1<0) {
      const fraction=Math.abs(y0)/(Math.abs(y0)+Math.abs(y1));
      const left=0.5*y0*dz*fraction, right=0.5*y1*dz*(1-fraction);
      cape+=Math.max(0,left)+Math.max(0,right);
      cin+=Math.min(0,left)+Math.min(0,right);
    } else {
      const energy=0.5*(y0+y1)*dz;
      cape+=Math.max(0,energy);cin+=Math.min(0,energy);
    }
  }
  return Object.freeze({
    capeJkg:cape, cinJkg:cin,
    nature:'CALCULO_EXPERIMENTAL_BLAISE',officialAlert:false,
    mayTriggerAlert:false, method:'vertical_virtual_temperature_buoyancy_trapezoid',
    methodVersion:RJ_ADVANCED_PHYSICS_VERSION,
    limitation:'Only for measured/modelled, co-located validated parcel and environmental profiles. No EL, LFC, tornado probability or thunderstorm declaration inferred.',
  });
}

export function moistureFluxConvergence({specificHumidityKgKg,eastWindMs,northWindMs,
  dqDxPerM,dqDyPerM,duDxPerSec,dvDyPerSec}) {
  finite(specificHumidityKgKg,'q',0,0.05);
  finite(eastWindMs,'east_wind',-150,150);
  finite(northWindMs,'north_wind',-150,150);
  finite(dqDxPerM,'dq_dx',-0.01,0.01);
  finite(dqDyPerM,'dq_dy',-0.01,0.01);
  finite(duDxPerSec,'du_dx',-10,10);
  finite(dvDyPerSec,'dv_dy',-10,10);
  return result(-(eastWindMs*dqDxPerM+northWindMs*dqDyPerM
    +specificHumidityKgKg*(duDxPerSec+dvDyPerSec)),
    's⁻¹','-div(q*horizontal_wind)',
    {limitation:'Requires consistent metric horizontal gradients, not lon/lat differences; not a direct precipitation-rate estimator.'});
}
