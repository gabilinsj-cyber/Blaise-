import test from "node:test";
import assert from "node:assert/strict";
import { buildStatewideDashboardSnapshot } from "../src/statewide-dashboard.mjs";

const now = Date.parse("2026-10-26T12:00:00Z");

const point = {
  waveHeightM: 0.83,
  latitude: -23,
  longitude: -43,
  sourceUrl: "https://nomads.ncep.noaa.gov/",
  issuedAt: "2026-10-26T10:00:00Z",
  validAt: "2026-10-26T11:00:00Z",
  expiresAt: "2026-10-26T13:00:00Z"
};

function marine(state, snapshot) {
  const worker = {
    status: () => ({
      enabled: true,
      started: true,
      sources: []
    }),
    readSource: id => id === "noaa-gfs-wave"
      ? { state, snapshot }
      : null
  };

  return buildStatewideDashboardSnapshot(
    worker, { nowMillis: now }
  ).marine;
}

test("Ponto sem municipio validado", () => {
  assert.deepEqual(marine("CURRENT", point), []);
});

test("Codigo IBGE isolado nao basta", () => {
  assert.deepEqual(marine("CURRENT", {
    ...point, cityIbge: 3304557
  }), []);
});

test("Previsao vencida nao aparece", () => {
  assert.deepEqual(marine("STALE", {
    ...point,
    cityIbge: 3304557,
    municipalityGeoVerified: true
  }), []);
});
