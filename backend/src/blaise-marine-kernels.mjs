/** Marine numerical support. No automatic classification of tsunami or coastal impact. */
import {classifyRjSeaFacingMunicipality} from './rj-seafront-municipalities.mjs';
const VERSION='rj-marine-20261006-v1',G=9.80665;
function n(value,name,min=-Infinity,max=Infinity){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw RangeError(`invalid_${name}`);return value;}
function p(value,name){n(value,name);if(value<=0)throw RangeError(`invalid_${name}`);return value;}
function provenance(metadata){
 if(metadata?.status!=='VALIDATED'||!metadata.version||!metadata.sourceId||!metadata.verticalDatum||!Number.isFinite(metadata.resolutionMeters)||metadata.resolutionMeters<=0||!/^[a-f0-9]{64}$/i.test(metadata.sha256||''))throw TypeError('validated_versioned_bathymetry_required');
 const url=new URL(metadata.sourceUrl);if(url.protocol!=='https:'||url.username||url.password)throw TypeError('bathymetry_https_required');
 return {sourceId:metadata.sourceId,sourceUrl:metadata.sourceUrl,version:metadata.version,verticalDatum:metadata.verticalDatum,resolutionMeters:metadata.resolutionMeters,sha256:metadata.sha256};
}
export function significantWaveSpectrum({bins}){
 if(!Array.isArray(bins)||bins.length<1||bins.length>4096)throw TypeError('bounded_spectrum_required');
 let m0=0,m1=0,m2=0,peak=null;
 for(let i=0;i<bins.length;i++){
  const b=bins[i];p(b.lowerHz,'lower_frequency');p(b.upperHz,'upper_frequency');n(b.densityM2PerHz,'spectral_density',0);
  if(b.upperHz<=b.lowerHz||(i&&b.lowerHz<bins[i-1].upperHz))throw RangeError('ordered_nonoverlapping_frequency_bins_required');
  m0+=b.densityM2PerHz*(b.upperHz-b.lowerHz);
  m1+=b.densityM2PerHz*(b.upperHz**2-b.lowerHz**2)/2;
  m2+=b.densityM2PerHz*(b.upperHz**3-b.lowerHz**3)/3;
  if(b.densityM2PerHz>0&&(!peak||b.densityM2PerHz>peak.densityM2PerHz))peak=b;
 }
 [m0,m1,m2].forEach(v=>n(v,'spectral_moment',0));
 return {value:4*Math.sqrt(m0),unit:'m',m0M2:m0,meanPeriodTm01Seconds:m1>0?m0/m1:null,meanPeriodTm02Seconds:m2>0?Math.sqrt(m0/m2):null,peakBinPeriodSeconds:peak?2/(peak.lowerHz+peak.upperHz):null,method:'piecewise_constant_spectral_moments_Hm0',methodVersion:VERSION,coverage:'SUPPLIED_FREQUENCY_BANDS_ONLY',nature:'CALCULO_BLAISE',officialAlert:false,limitation:'Spectral significant wave height, not individual crest height, maximum wave, coastal runup or tsunami identification.'};
}
export function linearWaveDispersion({periodSeconds,depthMeters}){
 n(periodSeconds,'wave_period',1,7200);n(depthMeters,'water_depth',0.1,12000);
 const omega=2*Math.PI/periodSeconds,target=omega**2;
 let low=0,high=Math.max(target/G,omega/Math.sqrt(G*depthMeters));
 while(G*high*Math.tanh(high*depthMeters)<target)high*=2;
 for(let i=0;i<80;i++){const mid=(low+high)/2;if(G*mid*Math.tanh(mid*depthMeters)<target)low=mid;else high=mid;}
 const k=(low+high)/2,kh=k*depthMeters,phaseSpeedMs=omega/k;
 const groupFactor=kh>350?0.5:0.5*(1+2*kh/Math.sinh(2*kh));
 const groupSpeedMs=phaseSpeedMs*groupFactor;
 return {value:groupSpeedMs,unit:'m/s',phaseSpeedMs,groupSpeedMs,waveNumberPerMeter:k,wavelengthMeters:2*Math.PI/k,periodSeconds,depthMeters,method:'linear_gravity_wave_dispersion_no_current',methodVersion:VERSION,nature:'CALCULO_BLAISE',officialAlert:false,limitation:'Local linear nonbreaking gravity wave without currents; group speed propagates energy, not the cyclone centre or coastal water level.'};
}
function coordinates(point){n(point.latitude,'latitude',-90,90);n(point.longitude,'longitude',-180,180);n(point.depthMeters,'depth',0.1,12000);}
function distance(a,b){
 const rad=Math.PI/180,phi1=a.latitude*rad,phi2=b.latitude*rad,dp=(b.latitude-a.latitude)*rad,dl=(b.longitude-a.longitude)*rad;
 const h=Math.sin(dp/2)**2+Math.cos(phi1)*Math.cos(phi2)*Math.sin(dl/2)**2;
 return 6371008.8*2*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
}
export function conditionalMarineTravelTime({points,bathymetry,destination,originTime,propagation,periodSeconds,maxSegmentMeters,pathValidation}){
 const source=provenance(bathymetry);
 if(!Array.isArray(points)||points.length<2||points.length>10000)throw TypeError('bounded_water_path_required');
 if(pathValidation?.status!=='VALIDATED_WATER_ONLY'||!pathValidation.version)throw TypeError('validated_water_path_required');
 p(maxSegmentMeters,'maximum_segment');if(maxSegmentMeters>100000)throw RangeError('excessively_coarse_path');
 if(!Number.isInteger(destination?.cityIbge)||!/^33\d{5}$/.test(String(destination.cityIbge))||!destination.coastPointId||destination.geometryStatus!=='VALIDATED'||!destination.geometryVersion)throw TypeError('validated_RJ_coastal_target_required');
 const municipality=classifyRjSeaFacingMunicipality(destination.cityIbge);
 if(!municipality.seaFacing)throw RangeError('municipality_has_no_catalogued_seafront');
 n(destination.latitude,'destination_latitude',-90,90);n(destination.longitude,'destination_longitude',-180,180);
 if(!['LINEAR_SWELL_GROUP','LONG_WAVE_APPROXIMATION'].includes(propagation))throw TypeError('explicit_wave_propagation_required');
 n(periodSeconds,'period',1,7200);const epoch=Date.parse(originTime);if(!Number.isFinite(epoch))throw TypeError('origin_time_required');
 points.forEach(coordinates);
 if(distance(points.at(-1),destination)>1)throw RangeError('path_destination_mismatch');
 const speeds=points.map(point=>{
  if(propagation==='LINEAR_SWELL_GROUP')return linearWaveDispersion({periodSeconds,depthMeters:point.depthMeters}).groupSpeedMs;
  const c=Math.sqrt(G*point.depthMeters),wavelength=c*periodSeconds;
  if(wavelength/point.depthMeters<20)throw RangeError('long_wave_assumption_not_satisfied');
  return c;
 });
 let travelSeconds=0,distanceMeters=0;
 for(let i=1;i<points.length;i++){
  const length=distance(points[i-1],points[i]);if(length<=0||length>maxSegmentMeters)throw RangeError('invalid_path_segment');
  // Trapezoidal slowness integral along an externally supplied path, not a first-arrival grid solver.
  distanceMeters+=length;travelSeconds+=length*(1/speeds[i-1]+1/speeds[i])/2;
 }
 p(travelSeconds,'travel_seconds');const arrivalTime=new Date(epoch+travelSeconds*1000).toISOString();
 return {value:travelSeconds,unit:'s',arrivalTimeUtc:arrivalTime,averagePropagationSpeedMs:distanceMeters/travelSeconds,minPropagationSpeedMs:Math.min(...speeds),maxPropagationSpeedMs:Math.max(...speeds),distanceMeters,originTime,destination:{cityIbge:destination.cityIbge,cityName:municipality.name,coastPointId:destination.coastPointId,latitude:destination.latitude,longitude:destination.longitude,geometryVersion:destination.geometryVersion},bathymetry:source,pathVersion:pathValidation.version,propagation,method:'conditional_supplied_water_path_slowness_integral',methodVersion:VERSION,nature:'CALCULO_BLAISE',officialAlert:false,firstArrivalProven:false,coastalImpactConfirmed:false,arrivalProbability:null,coastalHeightMeters:null,inundationMeters:null,limitation:'Conditional travel along supplied path only; not proven earliest arrival, city affected, coastal amplitude, calibrated probability or operational tsunami warning.'};
}
