import assert from 'node:assert/strict';
import test from 'node:test';

import { validateAlertaRioLiveRainfallHtml } from '../src/alerta-rio-source.mjs';

function liveHtmlWithNd() {
  const rows = Array.from({ length: 33 }, (_, index) => {
    const values = Array.from({ length: 14 }, () => '0,0');
    if (index === 3) {
      values[1] = 'ND';
      values[2] = 'ND';
      values[3] = 'ND';
      values[4] = 'ND';
      values[5] = 'ND';
      values[6] = 'ND';
      values[7] = 'ND';
      values[8] = 'ND';
      values[13] = 'ND';
    }
    const cells = [
      index + 1,
      `Estação ${index + 1}`,
      'Baía de Guanabara',
      '07/09/2026 - 09:40:00',
      ...values,
    ].map((value) => `<td>${value}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  return `<!doctype html><html><body><h1>Dados Pluviométricos</h1><span>TX - 15</span><table>${rows}</table></body></html>`;
}

test('official ND rainfall cells remain missing instead of being converted to zero', () => {
  const snapshot = validateAlertaRioLiveRainfallHtml(liveHtmlWithNd());
  assert.equal(snapshot.stationCount, 33);
  assert.equal(snapshot.stations[3].rain5mMm, 0);
  assert.equal(snapshot.stations[3].rain10mMm, null);
  assert.equal(snapshot.stations[3].rain1hMm, null);
  assert.equal(snapshot.stations[3].tx15Mm, null);
  assert.equal(snapshot.missingValueCount, 9);
});

test('unknown textual rainfall markers still fail closed', () => {
  assert.throws(
    () => validateAlertaRioLiveRainfallHtml(liveHtmlWithNd().replace('<td>0,0</td>', '<td>indisponível</td>')),
    (error) => error.code === 'alerta_rio_live_invalid_rain_value',
  );
});
