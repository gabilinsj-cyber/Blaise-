export function publicScientificResults(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(row =>
      row?.status === 'CALCULATED_INPUTS_ONLY' &&
      /^(municipality:33\d{5}|state:RJ)$/.test(row.scopeId) &&
      Number.isFinite(row.result?.value) &&
      typeof row.result?.unit === 'string'
    )
    .map(row => ({
      scopeId: row.scopeId,
      validAt: row.validAt,
      calculatedAt: row.calculatedAt,
      value: row.result.value,
      unit: row.result.unit,
      nature: 'CALCULO_BLAISE',
      officialAlert: false
    }));
}
