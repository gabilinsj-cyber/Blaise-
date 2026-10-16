import { findRjMunicipality } from './rio-municipalities.mjs';

export const RJ_SEAFRONT_CONTRACT = 'IBGE_MUNICIPIOS_DEFRONTANTES_COM_O_MAR_2024_RJ_25_PREFILTER';
export const RJ_SEAFRONT_SOURCE_URL = 'https://www.ibge.gov.br/geociencias/organizacao-do-territorio/estrutura-territorial/24072-municipios-defrontantes-com-o-mar.html';

export const RJ_SEAFRONT_MUNICIPALITIES = Object.freeze([
  Object.freeze({ name: 'Angra dos Reis', ibge: '3300100' }),
  Object.freeze({ name: 'Araruama', ibge: '3300209' }),
  Object.freeze({ name: 'Armação dos Búzios', ibge: '3300233' }),
  Object.freeze({ name: 'Arraial do Cabo', ibge: '3300258' }),
  Object.freeze({ name: 'Cabo Frio', ibge: '3300704' }),
  Object.freeze({ name: 'Campos dos Goytacazes', ibge: '3301009' }),
  Object.freeze({ name: 'Carapebus', ibge: '3300936' }),
  Object.freeze({ name: 'Casimiro de Abreu', ibge: '3301306' }),
  Object.freeze({ name: 'Duque de Caxias', ibge: '3301702' }),
  Object.freeze({ name: 'Guapimirim', ibge: '3301850' }),
  Object.freeze({ name: 'Itaboraí', ibge: '3301900' }),
  Object.freeze({ name: 'Itaguaí', ibge: '3302007' }),
  Object.freeze({ name: 'Macaé', ibge: '3302403' }),
  Object.freeze({ name: 'Magé', ibge: '3302502' }),
  Object.freeze({ name: 'Mangaratiba', ibge: '3302601' }),
  Object.freeze({ name: 'Maricá', ibge: '3302700' }),
  Object.freeze({ name: 'Niterói', ibge: '3303302' }),
  Object.freeze({ name: 'Paraty', ibge: '3303807' }),
  Object.freeze({ name: 'Quissamã', ibge: '3304151' }),
  Object.freeze({ name: 'Rio das Ostras', ibge: '3304524' }),
  Object.freeze({ name: 'Rio de Janeiro', ibge: '3304557' }),
  Object.freeze({ name: 'São Francisco de Itabapoana', ibge: '3304755' }),
  Object.freeze({ name: 'São Gonçalo', ibge: '3304904' }),
  Object.freeze({ name: 'São João da Barra', ibge: '3305000' }),
  Object.freeze({ name: 'Saquarema', ibge: '3305505' }),
]);

const byIbge = new Map(RJ_SEAFRONT_MUNICIPALITIES.map((city) => [city.ibge, city]));
const byName = new Map(RJ_SEAFRONT_MUNICIPALITIES.map((city) => [city.name, city]));

if (RJ_SEAFRONT_MUNICIPALITIES.length !== 25 || byIbge.size !== 25 || byName.size !== 25) {
  throw new Error('invalid_rj_seafront_catalog');
}

for (const city of RJ_SEAFRONT_MUNICIPALITIES) {
  const canonical = findRjMunicipality(city.ibge);
  if (!canonical || canonical.name !== city.name) {
    throw new Error('rj_seafront_catalog_not_canonical');
  }
}

export class RjSeafrontError extends Error {
  constructor(code) {
    super(code);
    this.name = 'RjSeafrontError';
    this.code = code;
  }
}

export function classifyRjSeaFacingMunicipality(ibge) {
  const normalized = String(ibge ?? '').trim();
  if (!/^33\d{5}$/.test(normalized)) {
    throw new RjSeafrontError('rj_seafront_ibge_invalid');
  }

  const canonical = findRjMunicipality(normalized);
  if (!canonical) {
    throw new RjSeafrontError('rj_seafront_unknown_rj_municipality');
  }

  const seaFacing = byIbge.has(normalized);
  return Object.freeze({
    name: canonical.name,
    ibge: canonical.ibge,
    seaFacing,
    sourceEdition: '2024',
    contract: RJ_SEAFRONT_CONTRACT,
  });
}

export function isRjSeaFacingMunicipality(ibge) {
  return classifyRjSeaFacingMunicipality(ibge).seaFacing;
}
