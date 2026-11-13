/**
 * Diagnósticos termodinâmicos adicionais do Blaise V6 RJ.
 * Nunca são alerta oficial. Resultados exigem perfis previamente validados,
 * fonte, jurisdição, instante de validade e controle de qualidade no job runner.
 */
const G=9.80665,RD=287.05,CP=1004.0;
const VERSION='rj-advanced-kernels-20261113-v1';
function n(v,name,min=-Infinity,max=Infinity){
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw RangeError('invalid_'+name);
  return v;
}
function p(v,name,min=0,max=Infinity){n(v,name,min,max);if(v<=0)throw RangeError('invalid_'+name);return v;}
function result(value,unit,method,extra={}){
  n(value,'result');return {value,unit,method,methodVersion:VERSION,nature:'CALCULO_BLAISE',officialAlert:false,...extra};
}

/** Bolton (1980) temperature of LCL; dry parcel ascent idealization. */
export function liftingCondensationLevel({temperatureK,dewPointK,pressurePa}){
  n(temperatureK,'temperature_K',180,330);n(dewPointK,'dewpoint_K',180,330);
  p(pressurePa,'pressure_Pa',10000,110000);
  if(dewPointK>temperatureK)throw RangeError('dewpoint_above_temperature');
  const tLclK=1/(1/(dewPointK-56)+Math.log(temperatureK/dewPointK)/800)+56;
  const pLclPa=pressurePa*(tLclK/temperatureK)**(CP/RD);
  return result((temperatureK-tLclK)*CP/G,'m','Bolton_LCL_dry_lift_height_approx',{
    temperatureLclK:tLclK,pressureLclPa:pLclPa,
    limitation:'Approximate parcel ascent height above starting level, not cloud base measured at terrain or CIN/LFC.'
  });
}

/** Layer-mean environmental lapse rate from two quality-controlled heights. */
export function environmentalLapseRate({lower,upper}){
  const a=lower,b=upper;if(!a||!b)throw TypeError('temperature_profile_required');
  n(a.heightAglM,'lower_height',0,30000);n(b.heightAglM,'upper_height',0,30000);
  n(a.temperatureK,'lower_temp',170,340);n(b.temperatureK,'upper_temp',170,340);
  if(b.heightAglM<=a.heightAglM||b.heightAglM-a.heightAglM>12000)throw RangeError('ordered_layer_required');
  return result((a.temperatureK-b.temperatureK)*1000/(b.heightAglM-a.heightAglM),'K/km','layer_mean_environmental_lapse_rate',{
    bottomM:a.heightAglM,topM:b.heightAglM,
    limitation:'Two-level gradient, not an observed inversion thickness, environmental sounding or convective alert.'
  });
}

/** Hydrostatic thickness from layer mean virtual temperature. */
export function hypsometricThickness({bottomPressurePa,topPressurePa,meanVirtualTemperatureK}){
  p(bottomPressurePa,'bottom_pressure',100,110000);p(topPressurePa,'top_pressure',100,110000);
  n(meanVirtualTemperatureK,'mean_virtual_temperature',160,340);
  if(topPressurePa>=bottomPressurePa)throw RangeError('pressure_must_decrease');
  return result(RD*meanVirtualTemperatureK/G*Math.log(bottomPressurePa/topPressurePa),'m','hypsometric_hydrostatic_layer_thickness',{
    limitation:'Requires representative layer-mean virtual temperature; not surface elevation or sea-level pressure conversion.'
  });
}

/**
 * Parcel/environment VIRTUAL temperatures at exactly the same height.
 * Integrates B=g*(Tv_parcel-Tv_env)/Tv_env via piecewise linear interpolation.
 * Vertical zero crossings split positive and negative areas exactly.
 * No environmental parcel solver, entrainment or pressure-to-height conversion.
 */
export function suppliedParcelCapeCin({levels,maxGapM=1000}){
  if(!Array.isArray(levels)||levels.length<2||levels.length>2048)throw TypeError('bounded_parcel_profile_required');
  p(maxGapM,'max_gap',0,5000);
  let cape=0,cin=0,layers=0;
  const profile=levels.map((l,i)=>{
    n(l.heightAglM,'height',0,30000);
    n(l.environmentVirtualTemperatureK,'environment_tv',160,340);
    n(l.parcelVirtualTemperatureK,'parcel_tv',160,340);
    if(i&&(l.heightAglM<=levels[i-1].heightAglM||l.heightAglM-levels[i-1].heightAglM>maxGapM))throw RangeError('profile_order_or_gap_invalid');
    return {z:l.heightAglM,b:G*(l.parcelVirtualTemperatureK-l.environmentVirtualTemperatureK)/l.environmentVirtualTemperatureK};
  });
  const addSegment=(a,b,dz)=>{
    const area=(a+b)*dz/2;
    if(area>=0)cape+=area;else cin+=area;
  };
  for(let i=1;i<profile.length;i++){
    const a=profile[i-1],b=profile[i],dz=b.z-a.z;
    if(a.b*b.b<0){
      const f=Math.abs(a.b)/(Math.abs(a.b)+Math.abs(b.b));
      addSegment(a.b,0,dz*f);
      addSegment(0,b.b,dz*(1-f));
    } else addSegment(a.b,b.b,dz);
    layers++;
  }
  n(cape,'cape',0);n(cin,'cin',-1e7,0);
  return result(cape,'J/kg','supplied_virtual_buoyancy_positive_integral',{
    capeJkg:cape,cinJkg:cin,integratedBottomM:profile[0].z,
    integratedTopM:profile.at(-1).z,layers,
    limitation:'Layer-limited signed buoyancy, NOT full CAPE/CIN from surface parcel, no LFC/EL unless parcel origin, inhibition boundaries and complete ascent are independently validated. CIN is negative signed area.'
  });
}
