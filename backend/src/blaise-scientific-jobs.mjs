import * as kernels from './blaise-scientific-kernels.mjs';
const METHODS=Object.freeze(Object.fromEntries(Object.entries(kernels).filter(([,v])=>typeof v==='function')));
export const SCIENTIFIC_METHODS=Object.freeze(Object.keys(METHODS));
/** Provider must normalize coherent, quality-controlled profiles before submitting a job. */
export function evaluateScientificJobs(jobs,{now=Date.now()}={}) {
  if(!Array.isArray(jobs)||jobs.length>64||!Number.isFinite(now))throw TypeError('bounded_job_batch_required');
  return jobs.map(job=>{
    try{
      if(!job||typeof job.id!=='string'||!job.id||!Object.hasOwn(METHODS,job.method))throw TypeError('known_method_required');
      if(!/^municipality:33\d{5}$|^state:RJ$/.test(job.scopeId||''))throw TypeError('RJ_scope_required');
      if(!Number.isFinite(job.maxAgeMs)||job.maxAgeMs<=0||job.maxAgeMs>86400000)throw TypeError('freshness_policy_required');
      if(!Array.isArray(job.sources)||job.sources.length===0)throw TypeError('source_provenance_required');
      for(const source of job.sources){
        if(!source.sourceId||source.scopeId!==job.scopeId||source.quality!=='VALIDATED'||!['OBSERVADO','MODELO'].includes(source.nature))throw TypeError('validated_comparable_source_required');
        const url=new URL(source.sourceUrl);if(url.protocol!=='https:'||url.username||url.password)throw TypeError('https_source_required');
        const at=Date.parse(source.observedAt);if(!Number.isFinite(at)||at>now||now-at>job.maxAgeMs)throw RangeError('stale_source');
        if(!source.validAt||!Number.isFinite(Date.parse(source.validAt))||source.validAt!==job.validAt)throw TypeError('same_valid_time_required');
      }
      if(['calibratedMos','calibratedKdpRainRate','calibratedTurbulentGust'].includes(job.method)&&job.inputs?.policy?.scopeId!==job.scopeId)throw TypeError('calibration_scope_mismatch');
      if(job.method==='calibratedZrRainRate'&&job.inputs?.calibration?.scopeId!==job.scopeId)throw TypeError('radar_calibration_scope_mismatch');
      if(job.method==='conditionalMarineTravelTime'&&job.scopeId!==`municipality:${job.inputs?.destination?.cityIbge}`)throw TypeError('coastal_target_scope_mismatch');
      return {id:job.id,status:'CALCULATED_INPUTS_ONLY',scopeId:job.scopeId,validAt:job.validAt,calculatedAt:new Date(now).toISOString(),sources:job.sources,result:METHODS[job.method](job.inputs)};
    }catch(error){return {id:job?.id??null,status:'UNAVAILABLE',reason:error.message,result:null,officialAlert:false};}
  });
}
