export {
  linearFeatureAdvection,
  vaporPressureFromDewPoint,
  relativeHumidityFromDewPoint,
  mixingRatio,
  specificHumidityFromMixingRatio,
  observedEnvironmentalLapseRate,
  meanVirtualTemperatureSeaLevelPressure,
  wetBulbStullApprox,
  verifiedRainfallAccumulation,
  calibratedZrRainRate,
  parcelBuoyancyEnergy,
  moistureFluxConvergence,
} from './blaise-rj-advanced-physics.mjs';
/** Numerical primitives, not hazard classifiers. SI unless the parameter names say otherwise. */
export {significantWaveSpectrum,linearWaveDispersion,conditionalMarineTravelTime} from './blaise-marine-kernels.mjs';
export const SCIENTIFIC_METHOD_VERSION = 'rj-kernels-20261006-v2';
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

export function calibratedTurbulentGust({meanWindMs,alongWindStdMs,heightM,averagingSeconds,windowSeconds,stationarity,policy}) {
  number(meanWindMs,'mean_wind',0,150);number(alongWindStdMs,'along_wind_std',0,100);positive(heightM,'height');
  positive(averagingSeconds,'averaging_seconds');positive(windowSeconds,'window_seconds');
  if(windowSeconds<=averagingSeconds||stationarity!=='VALIDATED_STATIONARY')throw TypeError('stationary_window_required');
  if(policy?.status!=='CALIBRATED'||!policy.version||!policy.scopeId||policy.method!=='mean_plus_peak_sigma'||policy.heightM!==heightM||policy.averagingSeconds!==averagingSeconds||policy.windowSeconds!==windowSeconds)throw TypeError('local_gust_calibration_required');
  positive(policy.peakFactor,'peak_factor');number(policy.maxMeanWindMs,'mean_limit',0,150);number(policy.maxStdMs,'std_limit',0,100);
  if(meanWindMs>policy.maxMeanWindMs||alongWindStdMs>policy.maxStdMs)throw RangeError('outside_calibration');
  return output(meanWindMs+policy.peakFactor*alongWindStdMs,'m/s','locally_calibrated_turbulent_peak',{policyVersion:policy.version,scopeId:policy.scopeId,heightM,averagingSeconds,windowSeconds,limitation:'Estimated peak for a calibrated stationary window, not observed gust or future downburst/tornado wind; no universal factor.'});
}

function windLayer(levels,bottomM,topM,maxGapM) {
  if(!Array.isArray(levels)||levels.length<2||levels.length>2048)throw TypeError('bounded_wind_profile_required');
  number(bottomM,'layer_bottom',0,30000);number(topM,'layer_top',0,30000);positive(maxGapM,'profile_gap');
  if(topM<=bottomM)throw RangeError('positive_layer_required');
  for(let i=0;i<levels.length;i++){
    const l=levels[i];number(l.heightAglM,'height_agl',0,30000);number(l.eastMs,'east_wind',-150,150);number(l.northMs,'north_wind',-150,150);
    if(i&&l.heightAglM<=levels[i-1].heightAglM)throw RangeError('height_must_increase');
    if(i&&l.heightAglM>bottomM&&levels[i-1].heightAglM<topM&&l.heightAglM-levels[i-1].heightAglM>maxGapM)throw RangeError('profile_gap_exceeds_policy');
  }
  if(levels[0].heightAglM>bottomM||levels.at(-1).heightAglM<topM)throw RangeError('full_layer_coverage_required');
  const interpolate=heightAglM=>{
    const exact=levels.find(l=>l.heightAglM===heightAglM);if(exact)return {...exact};
    const i=levels.findIndex(l=>l.heightAglM>heightAglM),a=levels[i-1],b=levels[i],f=(heightAglM-a.heightAglM)/(b.heightAglM-a.heightAglM);
    return {heightAglM,eastMs:a.eastMs+f*(b.eastMs-a.eastMs),northMs:a.northMs+f*(b.northMs-a.northMs)};
  };
  return [interpolate(bottomM),...levels.filter(l=>l.heightAglM>bottomM&&l.heightAglM<topM),interpolate(topM)];
}

export function bulkWindShear({levels,bottomM,topM,maxGapM}) {
  const layer=windLayer(levels,bottomM,topM,maxGapM),a=layer[0],b=layer.at(-1);
  const eastMs=b.eastMs-a.eastMs,northMs=b.northMs-a.northMs;
  return output(Math.hypot(eastMs,northMs),'m/s','bulk_layer_vector_wind_difference',{eastMs,northMs,bottomM,topM,limitation:'Supports supplied layers such as 0–1 and 0–6 km AGL; does not confirm a supercell or tornado.'});
}

export function stormRelativeHelicity({levels,bottomM,topM,maxGapM,stormEastMs,stormNorthMs}) {
  number(stormEastMs,'storm_east',-150,150);number(stormNorthMs,'storm_north',-150,150);
  const layer=windLayer(levels,bottomM,topM,maxGapM);let positiveHelicity=0,negativeHelicity=0;
  for(let i=1;i<layer.length;i++){
    const a=layer[i-1],b=layer[i];
    const contribution=(b.eastMs-stormEastMs)*(a.northMs-stormNorthMs)-(a.eastMs-stormEastMs)*(b.northMs-stormNorthMs);
    number(contribution,'helicity_segment');if(contribution>=0)positiveHelicity+=contribution;else negativeHelicity+=contribution;
  }
  number(positiveHelicity,'positive_helicity');number(negativeHelicity,'negative_helicity');
  return output(positiveHelicity+negativeHelicity,'m²/s²','storm_relative_hodograph_line_integral',{positiveHelicity,negativeHelicity,bottomM,topM,stormEastMs,stormNorthMs,limitation:'Signed diagnostic of supplied wind profile and storm motion; no universal tornado threshold or occurrence probability, especially across hemispheres.'});
}

export function horizontalWindDiagnostics({duDxPerSecond,duDyPerSecond,dvDxPerSecond,dvDyPerSecond,coordinateSystem}) {
  if(coordinateSystem!=='LOCAL_CARTESIAN_EAST_NORTH_METERS')throw TypeError('metric_cartesian_gradients_required');
  for(const n of[duDxPerSecond,duDyPerSecond,dvDxPerSecond,dvDyPerSecond])number(n,'wind_gradient',-10,10);
  const divergencePerSecond=duDxPerSecond+dvDyPerSecond,vorticityPerSecond=dvDxPerSecond-duDyPerSecond;
  return {divergencePerSecond,convergencePerSecond:-divergencePerSecond,vorticityPerSecond,stretchingDeformationPerSecond:duDxPerSecond-dvDyPerSecond,shearingDeformationPerSecond:dvDxPerSecond+duDyPerSecond,unit:'s⁻¹',method:'horizontal_cartesian_wind_derivatives',methodVersion:SCIENTIFIC_METHOD_VERSION,nature:'CALCULO_BLAISE',officialAlert:false,limitation:'Quality-controlled metric gradients required, not angular degree differences; rotation/convergence does not diagnose a tornado.'};
}

export function stationPressureTendency({earlier,later}) {
  if(!earlier?.stationId||earlier.stationId!==later?.stationId||earlier.pressureKind!==later.pressureKind||!['STATION','SEA_LEVEL'].includes(earlier.pressureKind)||earlier.heightM!==later.heightM)throw TypeError('same_pressure_station_reference_required');
  number(earlier.heightM,'station_height',-500,6000);number(earlier.pressurePa,'earlier_pressure',30000,110000);number(later.pressurePa,'later_pressure',30000,110000);
  const first=Date.parse(earlier.observedAt),last=Date.parse(later.observedAt),seconds=(last-first)/1000;
  if(!Number.isFinite(seconds)||seconds<=0||seconds>86400)throw RangeError('ordered_bounded_pressure_interval_required');
  return output((later.pressurePa-earlier.pressurePa)/100/(seconds/3600),'hPa/h','two_point_same_station_pressure_tendency',{stationId:earlier.stationId,pressureKind:earlier.pressureKind,intervalSeconds:seconds,limitation:'Two-point observed tendency, not pressure-gradient force or a standalone cyclone forecast.'});
}
