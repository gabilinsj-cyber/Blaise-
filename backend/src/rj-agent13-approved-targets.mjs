/**
 * Server-owned, source-documented sampling targets for the 92 RJ counties.
 * These are verified polygon interior samples, NOT client GPS or locations of
 * meteorological stations. This module never schedules or makes provider calls.
 */
import {RJ_92_REPRESENTATIVE_BY_IBGE,RJ_92_REPRESENTATIVE_POINTS}
  from './rj-municipal-representative-points.mjs';

export function verifiedRjAgent13Target(ibge){
  if(!/^33\d{5}$/.test(String(ibge))) return null;
  const p=RJ_92_REPRESENTATIVE_BY_IBGE.get(String(ibge));
  if(!p)return null;
  return Object.freeze({ibge:p.ibge,latitude:p.latitude,longitude:p.longitude});
}
export function listRjAgent13Targets(){
  return RJ_92_REPRESENTATIVE_POINTS.map(p=>verifiedRjAgent13Target(p.ibge));
}
