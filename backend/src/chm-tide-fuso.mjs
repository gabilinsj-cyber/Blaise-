export const CHM_TIDE_FUSO_CONTRACT = 'DHN_FUSO_SIGN_CONVENTION_BOUND_CIVIL_CLOCK_ADJUSTMENT_SEPARATE';
export const CHM_TIDE_FUSO_SIGN_CONVENTION = 'DHN_POSITIVE_WEST_NEGATIVE_EAST';
export const CHM_TIDE_FUSO_TIME_BASIS = 'CHM_TABLE_HEADER_LEGAL_TIME_FUSO_BASE_OFFSET';
export const CHM_TIDE_CIVIL_CLOCK_BINDING = 'BLOCKED_SEPARATE_CIVIL_CLOCK_ADJUSTMENT_POLICY';
export const CHM_TIDE_FUSO_MIN_HOURS = -14;
export const CHM_TIDE_FUSO_MAX_HOURS = 14;

export const CHM_TIDE_FUSO_EVIDENCE = Object.freeze([
  'https://www.marinha.mil.br/chm/pagina-basica/informacoes-sobre-mares',
  'https://www.marinha.mil.br/chm/sites/www.marinha.mil.br.chm/files/u1974/rot-par-par.pdf',
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
  const rawToken = value.trim();
  if (!/^[+-]?\d{1,2}$/u.test(rawToken)) throw new ChmTideFusoError('chm_tide_fuso_token_invalid');

  const zoneHoursWest = Number(rawToken);
  if (!Number.isInteger(zoneHoursWest)
      || zoneHoursWest < CHM_TIDE_FUSO_MIN_HOURS
      || zoneHoursWest > CHM_TIDE_FUSO_MAX_HOURS) {
    throw new ChmTideFusoError('chm_tide_fuso_range_invalid');
  }

  const baseUtcOffsetMinutes = zoneHoursWest === 0 ? 0 : -zoneHoursWest * 60;
  return Object.freeze({
    rawToken,
    zoneHoursWest,
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
