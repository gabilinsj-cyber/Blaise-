export const CHM_TIDE_FUSO_CONTRACT = 'CHM_TIDE_HEADER_SIGNED_UTC_OFFSET_BOUND_CIVIL_CLOCK_ADJUSTMENT_SEPARATE';
export const CHM_TIDE_FUSO_SIGN_CONVENTION = 'SIGNED_UTC_OFFSET_FROM_CHM_TABLE_HEADER';
export const CHM_TIDE_FUSO_TIME_BASIS = 'CHM_TABLE_HEADER_LEGAL_TIME_UTC_OFFSET';
export const CHM_TIDE_CIVIL_CLOCK_BINDING = 'BLOCKED_SEPARATE_CIVIL_CLOCK_ADJUSTMENT_POLICY';
export const CHM_TIDE_FUSO_MIN_HOURS = -14;
export const CHM_TIDE_FUSO_MAX_HOURS = 14;

export const CHM_TIDE_FUSO_EVIDENCE = Object.freeze([
  'https://www.marinha.mil.br/chm/pagina-basica/informacoes-sobre-mares',
  'https://www.marinha.mil.br/chm/tabuas-de-mare-6',
  'https://www.marinha.mil.br/chm/sites/www.marinha.mil.br.chm/files/dados_de_mare/40%20-%20PORTO%20DO%20RIO%20DE%20JANEIRO%20-%20I%20FISCAL%20-%20130%20-%20132.pdf',
]);

export class ChmTideFusoError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ChmTideFusoError';
    this.code = code;
  }
}

export function bindChmTideFusoToken(value) {
  if (typeof value !== 'string') throw new ChmTideFusoError('chm_tide_fuso_token_invalid');
  const rawToken = value.trim().replace(',', '.');
  if (!/^[+-]\d{1,2}(?:\.0)?$/u.test(rawToken)) throw new ChmTideFusoError('chm_tide_fuso_token_invalid');

  const utcOffsetHours = Number(rawToken);
  if (!Number.isInteger(utcOffsetHours)
      || utcOffsetHours < CHM_TIDE_FUSO_MIN_HOURS
      || utcOffsetHours > CHM_TIDE_FUSO_MAX_HOURS) {
    throw new ChmTideFusoError('chm_tide_fuso_range_invalid');
  }

  const baseUtcOffsetMinutes = Object.is(utcOffsetHours, -0) ? 0 : utcOffsetHours * 60;
  const zoneHoursWestDerived = utcOffsetHours === 0 ? 0 : -utcOffsetHours;
  return Object.freeze({
    rawToken,
    utcOffsetHours,
    zoneHoursWestDerived,
    baseUtcOffsetMinutes,
    signConvention: CHM_TIDE_FUSO_SIGN_CONVENTION,
    timeBasis: CHM_TIDE_FUSO_TIME_BASIS,
    civilClockAdjustmentMinutes: null,
    effectiveUtcOffsetMinutes: null,
    civilClockBinding: CHM_TIDE_CIVIL_CLOCK_BINDING,
    evidence: CHM_TIDE_FUSO_EVIDENCE,
    contract: CHM_TIDE_FUSO_CONTRACT,
  });
}
