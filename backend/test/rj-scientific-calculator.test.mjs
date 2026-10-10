import test from 'node:test';
import assert from 'node:assert/strict';
import { RJ_MUNICIPALITIES } from '../src/rio-municipalities.mjs';
import {
  weightedOfficialMean, dewPointCelsius, thermalSensationCelsius,
} from '../src/rj-scientific-calculator.mjs';

const NOW = Date.parse('2026-10-10T18:00:00Z');
const at = '2026-10-10T17:30:00Z';
const observation = (stationId, value, weight = 1) => ({
  origin: 'OFFICIAL_OBSERVATION',
  sourceId: stationId === 'INMET-1' ? 'INMET' : 'DEFESA_CIVIL',
  stationId, ibge: '3304557',
  variable: 'TEMPERATURA_C', unit: '°C', value, weight,
  observedAt: at, latitude: -22.90, longitude: -43.18,
  sourceUrl: 'https://apitempo.inmet.gov.br/estacao/2026-10-09/2026-10-10/A652',
});

test('weighted mean of two same place-time official observations is experimental, not an official measurement', () => {
  const result = weightedOfficialMean({ observations: [
    observation('INMET-1', 30, 1),
    observation('DC-2', 33, 2),
  ], now: NOW });
  assert.equal(result.value, 32);
  assert.equal(result.ibge, '3304557');
  assert.equal(result.state, 'CALCULO_EXPERIMENTAL_BLAISE');
  assert.equal(result.officialMeasurement, false);
  assert.equal(result.mayTriggerAlert, false);
  assert.equal(result.sourceCount, 2);
});

test('do not average unofficial model Windy with official measurement even as tie-break', () => {
  const modeled = { ...observation('WIN', 40), origin: 'MODEL_FORECAST', sourceId: 'WINDY_MODELO' };
  const result = weightedOfficialMean({ observations: [observation('INMET-1', 29), modeled], now: NOW });
  assert.equal(result.state, 'DADOS_INSUFICIENTES');
  assert.equal(result.mayTriggerAlert, false);
});
test('different municipalities cannot be averaged into a fictional statewide temperature', () => {
  const result = weightedOfficialMean({ observations: [
    observation('INMET-1', 30),
    { ...observation('NIT-2', 31), ibge: '3303302' },
  ], now: NOW });
  assert.equal(result.state, 'DADOS_INSUFICIENTES');
});
test('prevent averaging alert severity scales, duplicate stations and stale data', () => {
  const a = observation('INMET-1', 5);
  assert.equal(weightedOfficialMean({ observations: [
    { ...a, variable: 'NIVEL_ALERTA', unit: 'categoria' },
    { ...observation('DC-2', 4), variable: 'NIVEL_ALERTA', unit: 'categoria' },
  ], now: NOW }).state, 'DADOS_INSUFICIENTES');
  assert.equal(weightedOfficialMean({ observations: [a, a], now: NOW }).reason, 'DUPLICATE_STATION');
  assert.equal(weightedOfficialMean({ observations: [
    a, { ...observation('DC-2', 30), observedAt: '2026-10-10T14:00:00Z' },
  ], now: NOW }).state, 'DADOS_INSUFICIENTES');
});
test('do not combine distant stations or records from different times', () => {
  const out = weightedOfficialMean({ observations: [
    observation('INMET-1', 30),
    { ...observation('DC-2', 32), latitude: -22.4, longitude: -42.4 },
  ], now: NOW });
  assert.equal(out.reason, 'STATIONS_TOO_FAR_APART');
  assert.equal(weightedOfficialMean({ observations: [
    observation('INMET-1', 30),
    { ...observation('DC-2', 31), observedAt: '2026-10-10T17:05:00Z' },
  ], now: NOW }).reason, 'OBSERVATION_TIMES_NOT_COMPARABLE');
});

test('dew point reaches temperature at 100 percent humidity and stays a calculation', () => {
  const result = dewPointCelsius({ temperatureC: 25, humidityPercent: 100,
    ibge: '3304557', observedAt: at, now: NOW });
  assert.equal(result.value, 25);
  assert.equal(result.state, 'CALCULO_EXPERIMENTAL_BLAISE');
  assert.equal(result.mayTriggerAlert, false);
});

test('thermal sensations use only applicable formula and do not invent a value mid-range', () => {
  const hot = thermalSensationCelsius({ temperatureC: 33, humidityPercent: 70,
    windKmh: 2, ibge: '3304557', observedAt: at, now: NOW });
  assert.equal(hot.formula, 'ROTHFUSZ_HEAT_INDEX');
  assert.ok(hot.value > 33);
  const cold = thermalSensationCelsius({ temperatureC: 5, humidityPercent: 80,
    windKmh: 25, ibge: '3304557', observedAt: at, now: NOW });
  assert.equal(cold.formula, 'WIND_CHILL_STANDARD');
  assert.ok(cold.value < 5);
  assert.equal(thermalSensationCelsius({ temperatureC: 19, humidityPercent: 80,
    windKmh: 5, ibge: '3304557', observedAt: at, now: NOW }).state, 'DADOS_INSUFICIENTES');
});

test('all 92 municipalities are eligible for isolated calculations, never for fabricated observations', () => {
  assert.equal(RJ_MUNICIPALITIES.length, 92);
  for (const {ibge} of RJ_MUNICIPALITIES) {
    const dew = dewPointCelsius({ temperatureC: 24, humidityPercent: 65,
      ibge, observedAt: at, now: NOW });
    assert.equal(dew.ibge, ibge);
    assert.equal(dew.officialMeasurement, false);
  }
  assert.equal(dewPointCelsius({ temperatureC: 20, humidityPercent: 60,
    ibge: '4106902', observedAt: at, now: NOW }).reason, 'MUNICIPALITY_NOT_CONFIRMED');
});
