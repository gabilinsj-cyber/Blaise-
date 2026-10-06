import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAlertaRioMeteorologyHtml } from '../src/alerta-rio-source.mjs';
const page = (temp = '25,2', humidity = '94,2', date = '06/10/2026 - 16:45:00') => `<h3>Dados Meteorológicos</h3><table><tr><th>Umi. do Ar</th><th>P. de Orvalho</th></tr><tr>${['32','São Cristóvão',date,temp,humidity,'1009,8','24,2','8,5','322,1'].map(x=>`<td>${x}</td>`).join('')}</tr></table>`;
const opts = { now: new Date('2026-10-06T20:02:00Z') };
test('preserves station coverage, timestamp, units and unavailable forecast fields', () => {
 const s=validateAlertaRioMeteorologyHtml(page(),opts).stations[0];
 assert.equal(s.temperatureC,25.2); assert.equal(s.relativeHumidityPercent,94.2);
 assert.equal(s.windSpeedKmh,8.5); assert.equal(s.observedAt,'2026-10-06T19:45:00.000Z');
 assert.equal(s.coverage,'station');assert.equal(s.freshness,'recent');
 for (const key of ['feelsLikeC','uvIndex','rainProbabilityPercent','cloudCoverPercent','windGustKmh']) assert.equal(s[key],null);
});
test('missing observation remains missing instead of zero',()=>assert.equal(validateAlertaRioMeteorologyHtml(page('-','-'),opts).stations[0].temperatureC,null));
test('rejects impossible humidity',()=>assert.throws(()=>validateAlertaRioMeteorologyHtml(page('25','101'),opts)));
test('old readings remain explicitly stale',()=>assert.equal(validateAlertaRioMeteorologyHtml(page('25','80','06/10/2026 - 12:00:00'),opts).stations[0].freshness,'stale'));
test('future reading cannot count as recent',()=>assert.equal(validateAlertaRioMeteorologyHtml(page('25','80','06/10/2026 - 18:00:00'),opts).stations[0].freshness,'future'));
test('rejects invalid calendar date',()=>assert.throws(()=>validateAlertaRioMeteorologyHtml(page('25','80','31/02/2026 - 16:45:00'),opts)));
