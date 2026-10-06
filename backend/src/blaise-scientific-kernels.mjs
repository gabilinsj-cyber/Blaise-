/** Numerical primitives, not hazard classifiers. SI unless the parameter names say otherwise. */
export const SCIENTIFIC_METHOD_VERSION = 'rj-kernels-20261006-v1';
function number(value, name, min=-Infinity, max=Infinity) {
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max) throw RangeError(`invalid_${name}`);
  return value;
}
function positive(value,name){number(value,name);if(value<=0)throw RangeError(`invalid_${name}`);return value;}
function output(value,unit,method,extra={}) {
  number(value,'result');return {value,unit,method,methodVersion:SCIENTIFIC_METHOD_VERSION,nature:'CALCULO_BLAISE',officialAlert:false,...extra};
}
export function equivalentPotentialTemperatureApprox({temperatureK,pressurePa,specificHumidityKgKg}) {
  number(temperatureK,'temperature',180,330);number(pressurePa,'pressure',10000,110000);number(specificHumidityKgKg,'specific_humidity',0,0.05);
  const value=temperatureK*(100000/pressurePa)**(287.05/1004)*Math.exp(2.5e6*specificHumidityKgKg/(1004*temperatureK));
  return output(value,'K','theta_e_constant_latent_heat_approximation',{limitation:'Not Bolton; not a stability or CAPE diagnosis.'});
}
export function clausiusClapeyronDerivative({temperatureK,saturationVaporPressurePa,latentHeatJkg}) {
  number(temperatureK,'temperature',180,330);positive(saturationVaporPressurePa,'vapor_pressure');positive(latentHeatJkg,'latent_heat');
  return output(latentHeatJkg*saturationVaporPressurePa/(461.5*temperatureK**2),'Pa/K','clausius_clapeyron_ideal_vapor',{limitation:'Phase and latent heat must be supplied; not a local rainfall trend.'});
}
export function precipitableWater({levels}) {
  if(!Array.isArray(levels)||levels.length<2)throw TypeError('pressure_profile_required');
  for(let i=0;i<levels.length;i++){
    number(levels[i].pressurePa,'pressure',100,110000);number(levels[i].specificHumidityKgKg,'specific_humidity',0,0.05);
    if(i&&levels[i].pressurePa>=levels[i-1].pressurePa)throw RangeError('pressure_must_decrease');
  }
  let integral=0;
  for(let i=1;i<levels.length;i++)integral+=(levels[i-1].specificHumidityKgKg+levels[i].specificHumidityKgKg)/2*(levels[i-1].pressurePa-levels[i].pressurePa);
  // kg/m² equals millimetres liquid-water equivalent (rho_water = 1000 kg/m³).
  return output(integral/9.80665,'mm','specific_humidity_pressure_trapezoid',{layerBottomPa:levels[0].pressurePa,layerTopPa:levels.at(-1).pressurePa,coverage:'SUPPLIED_LAYER_ONLY',limitation:'Do not label a partial profile total-column PWAT; no rainfall or alert threshold.'});
}
export function referenceEvapotranspirationDaily({temperatureC,netRadiationMJm2day,soilHeatMJm2day,wind2mMs,saturationVaporKpa,actualVaporKpa,slopeKpaC,psychrometricKpaC}) {
  number(temperatureC,'temperature',-50,60);number(netRadiationMJm2day,'radiation');number(soilHeatMJm2day,'soil_heat');number(wind2mMs,'wind',0,100);
  number(saturationVaporKpa,'saturation_vapor',0,20);number(actualVaporKpa,'actual_vapor',0,saturationVaporKpa);positive(slopeKpaC,'slope');positive(psychrometricKpaC,'psychrometric');
  const value=(0.408*slopeKpaC*(netRadiationMJm2day-soilHeatMJm2day)+psychrometricKpaC*900/(temperatureC+273)*wind2mMs*(saturationVaporKpa-actualVaporKpa))/(slopeKpaC+psychrometricKpaC*(1+0.34*wind2mMs));
  return output(value,'mm/day','FAO56_Penman_Monteith_daily',{limitation:'Daily reference grass ET, not actual evapotranspiration; negative signed result may indicate condensation.'});
}
export function soilWaterBalance({precipitationMm,actualEvapotranspirationMm,runoffMm,irrigationMm,capillaryRiseMm,deepDrainageMm}) {
  const values={precipitationMm,actualEvapotranspirationMm,runoffMm,irrigationMm,capillaryRiseMm,deepDrainageMm};
  for(const [key,value]of Object.entries(values))number(value,key,0);
  return output(precipitationMm+irrigationMm+capillaryRiseMm-actualEvapotranspirationMm-runoffMm-deepDrainageMm,'mm','root_zone_water_balance',{limitation:'All fluxes must share area and interval; zero omitted fluxes must be explicit. Not a soil-capacity or landslide model.'});
}
export function oceanWindStress({airDensityKgm3,dragCoefficient,wind10mMs}) {
  positive(airDensityKgm3,'air_density');number(dragCoefficient,'drag',0,0.02);number(wind10mMs,'wind',0,150);
  return output(airDensityKgm3*dragCoefficient*wind10mMs**2,'Pa','bulk_surface_wind_stress',{limitation:'Magnitude using supplied drag; not wave height or storm surge.'});
}
export function tropicalCycloneHeatPotential({levels,densityKgm3,heatCapacityJkgK}) {
  positive(densityKgm3,'density');positive(heatCapacityJkgK,'heat_capacity');
  if(!Array.isArray(levels)||levels.length<2||levels[0].depthM!==0)throw TypeError('surface_to_depth_profile_required');
  for(let i=0;i<levels.length;i++){
    number(levels[i].depthM,'depth',0,12000);number(levels[i].temperatureC,'temperature',-3,45);
    if(i&&levels[i].depthM<=levels[i-1].depthM)throw RangeError('depth_must_increase');
  }
  if(levels[0].temperatureC<=26)return output(0,'J/m²','TCHP_first_26C_isotherm',{z26M:0,limitation:'Not general ocean heat content or an extratropical cyclone classifier.'});
  let integral=0,z26M=null;
  for(let i=1;i<levels.length;i++){
    const a=levels[i-1],b=levels[i];
    if(b.temperatureC<=26){
      z26M=a.depthM+(b.depthM-a.depthM)*(a.temperatureC-26)/(a.temperatureC-b.temperatureC);
      integral+=(a.temperatureC-26)*(z26M-a.depthM)/2;break;
    }
    integral+=((a.temperatureC-26)+(b.temperatureC-26))/2*(b.depthM-a.depthM);
  }
  if(z26M===null)throw RangeError('26C_isotherm_not_observed');
  return output(integral*densityKgm3*heatCapacityJkgK,'J/m²','TCHP_first_26C_isotherm',{z26M,limitation:'Not sufficient to predict rapid intensification; not a rule for extratropical cyclones.'});
}
export function neutralMeanWindProfile({frictionVelocityMs,heightM,roughnessM,displacementM,vonKarman,stability}) {
  if(stability!=='NEUTRAL')throw TypeError('neutral_stability_required');
  number(frictionVelocityMs,'friction_velocity',0,20);positive(heightM,'height');positive(roughnessM,'roughness');number(displacementM,'displacement',0);number(vonKarman,'von_karman',0.3,0.5);
  if(heightM-displacementM<=roughnessM)throw RangeError('height_outside_log_layer');
  return output(frictionVelocityMs/vonKarman*Math.log((heightM-displacementM)/roughnessM),'m/s','neutral_surface_layer_log_mean_wind',{limitation:'Mean surface-layer wind, not gust velocity or full Ekman spiral.'});
}
export function calibratedKdpRainRate({kdpDegKm,policy,radarBand}) {
  if(!['S','C','X'].includes(radarBand)||policy?.status!=='CALIBRATED'||!policy.version||policy.radarBand!==radarBand||!policy.scopeId)throw TypeError('local_radar_calibration_required');
  number(kdpDegKm,'kdp',0);positive(policy.a,'coefficient_a');positive(policy.b,'coefficient_b');positive(policy.maxKdpDegKm,'kdp_limit');
  if(kdpDegKm>policy.maxKdpDegKm)throw RangeError('outside_calibration');
  return output(policy.a*kdpDegKm**policy.b,'mm/h','local_calibrated_R_KDP',{policyVersion:policy.version,scopeId:policy.scopeId,limitation:'Quality-controlled liquid-rain gates only; no universal coefficients or hail classification.'});
}
export function calibratedMos({predictors,policy,scopeId,variable,unit,leadHours}) {
  if(policy?.status!=='CALIBRATED'||!policy.version||policy.scopeId!==scopeId||policy.variable!==variable||policy.unit!==unit||policy.leadHours!==leadHours)throw TypeError('local_mos_calibration_required');
  number(policy.intercept,'intercept');if(!policy.coefficients||Object.keys(policy.coefficients).length===0)throw TypeError('coefficients_required');
  let value=policy.intercept;
  for(const[key,beta]of Object.entries(policy.coefficients)){
    number(beta,'coefficient');number(predictors?.[key],key);const range=policy.predictorRanges?.[key];
    if(!Array.isArray(range)||range.length!==2)throw TypeError('calibration_domain_required');
    number(range[0],'range_min');number(range[1],'range_max');if(range[0]>range[1]||predictors[key]<range[0]||predictors[key]>range[1])throw RangeError('outside_calibration');
    value+=beta*predictors[key];
  }
  return output(value,unit,'local_multivariate_MOS',{policyVersion:policy.version,scopeId,variable,leadHours,limitation:'Supplied coefficients only; training and independent regional skill validation required.'});
}
export function scalarKalmanUpdate({predictedMean,predictedVariance,measurement,measurementVariance}) {
  number(predictedMean,'mean');number(predictedVariance,'predicted_variance',0);number(measurement,'measurement');positive(measurementVariance,'measurement_variance');
  const innovationVariance=predictedVariance+measurementVariance;positive(innovationVariance,'innovation_variance');
  const gain=predictedVariance/innovationVariance;
  const mean=predictedMean+gain*(measurement-predictedMean);
  const variance=(1-gain)**2*predictedVariance+gain**2*measurementVariance;
  number(mean,'posterior_mean');number(variance,'posterior_variance',0);return {mean,variance,gain,method:'scalar_Kalman_measurement_update_Joseph',methodVersion:SCIENTIFIC_METHOD_VERSION,nature:'CALCULO_BLAISE',officialAlert:false,limitation:'Measurement update only, not a trained temporal model; comparable observations and calibrated variances required.'};
}
