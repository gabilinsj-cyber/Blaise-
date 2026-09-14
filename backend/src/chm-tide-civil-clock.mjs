export const CHM_TIDE_CIVIL_CLOCK_CONTRACT = 'RJ_2026_EFFECTIVE_CIVIL_CLOCK_UTC_OFFSET_BOUND_TO_OFFICIAL_BRAZILIAN_TIME_POLICY';
export const CHM_TIDE_CIVIL_CLOCK_BINDING = 'PASS_RJ_2026_EFFECTIVE_UTC_OFFSET_BOUND_NO_DST';
export const CHM_TIDE_CIVIL_CLOCK_POLICY = 'NO_DAYLIGHT_SAVING_ADJUSTMENT_UNDER_CURRENT_DECREE_9772_2019';
export const CHM_TIDE_CIVIL_CLOCK_SNAPSHOT_DATE = '2026-09-14';
export const CHM_TIDE_CIVIL_CLOCK_EVIDENCE = Object.freeze([
  'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/decreto/d9772.htm',
  'https://www.gov.br/mme/pt-br/assuntos/secretarias/secretaria-nacional-energia-eletrica/horario-de-verao',
  'https://www.gov.br/pt-br/servicos/hora-falada-on?id=9525&origem=servico',
]);

export class ChmTideCivilClockError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ChmTideCivilClockError';
    this.code = code;
  }
}

function boundedInteger(value, min, max, code) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ChmTideCivilClockError(code);
  }
  return parsed;
}

export function bindChmTideCivilClock(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ChmTideCivilClockError('chm_tide_civil_clock_input_invalid');
  }

  const calendarYear = boundedInteger(
    input.calendarYear,
    2020,
    2100,
    'chm_tide_civil_clock_year_invalid',
  );
  const baseUtcOffsetMinutes = boundedInteger(
    input.baseUtcOffsetMinutes,
    -840,
    840,
    'chm_tide_civil_clock_base_offset_invalid',
  );

  if (calendarYear !== 2026) {
    throw new ChmTideCivilClockError('chm_tide_civil_clock_year_not_evidenced');
  }
  if (baseUtcOffsetMinutes !== -180) {
    throw new ChmTideCivilClockError('chm_tide_civil_clock_base_offset_mismatch');
  }

  const civilClockAdjustmentMinutes = 0;
  const effectiveUtcOffsetMinutes = baseUtcOffsetMinutes + civilClockAdjustmentMinutes;

  return Object.freeze({
    calendarYear,
    baseUtcOffsetMinutes,
    civilClockAdjustmentMinutes,
    effectiveUtcOffsetMinutes,
    civilClockBinding: CHM_TIDE_CIVIL_CLOCK_BINDING,
    policy: CHM_TIDE_CIVIL_CLOCK_POLICY,
    policySnapshotDate: CHM_TIDE_CIVIL_CLOCK_SNAPSHOT_DATE,
    evidence: CHM_TIDE_CIVIL_CLOCK_EVIDENCE,
    contract: CHM_TIDE_CIVIL_CLOCK_CONTRACT,
  });
}
