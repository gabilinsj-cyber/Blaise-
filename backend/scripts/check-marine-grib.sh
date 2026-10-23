set -eu
grib_get -p shortName,units,dataDate,dataTime,validityDate,validityTime,Ni,Nj /fixtures/noaa-wave-20261022-06.grib2
grib_ls -n geography /fixtures/noaa-wave-20261022-06.grib2
grib_ls -l -23.5,317 /fixtures/noaa-wave-20261022-06.grib2
node --input-type=module <<\NOAA_TEST
import { readMarineGribPoint } from "./src/marine-grib-reader.mjs";
const result = await readMarineGribPoint("/fixtures/noaa-wave-20261022-06.grib2", -23.5, -43);
if (Math.abs(result.waveHeightM - 1.64) > 0.001) throw new Error("noaa_fixture_height_mismatch");
if (result.issuedAt !== "2026-10-22T06:00:00.000Z") throw new Error("noaa_issue_mismatch");
if (result.validAt !== "2026-10-22T06:00:00.000Z") throw new Error("noaa_validity_mismatch");
console.log("NOAA fixture OK", JSON.stringify(result));
NOAA_TEST
node --input-type=module <<\NOAA_LIVE
import { readMarineGribPoint } from "./src/marine-grib-reader.mjs";
const live = await readMarineGribPoint("/fixtures/noaa-wave-live.grib2", -23.5, -43);
if (live.issuedAt !== "2026-10-23T06:00:00.000Z") throw new Error("noaa_live_issue_mismatch");
if (live.validAt !== live.issuedAt) throw new Error("noaa_live_validity_mismatch");
console.log("NOAA GRIB baixado OK", JSON.stringify(live));
NOAA_LIVE
node --input-type=module <<\NOAA_COLLECT
import { collectNoaaWave } from "./src/noaa-wave-collector.mjs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const fixture = await readFile(
"/fixtures/noaa-wave-live.grib2");
const fakeFetch = async () => new Response(fixture);
const now = Date.UTC(2026, 9, 23, 7);
const result = await collectNoaaWave(
-23.5, -43, now, fakeFetch);
assert.equal(result.nature, "MODELO");
assert.ok(Math.abs(result.waveHeightM - 1.77) < 0.001);
assert.equal(result.expiresAt, "2026-10-23T18:00:00.000Z");
assert.equal(Date.parse(result.checkedAt), now);
const collectAt = t => collectNoaaWave(-23.5, -43, t, fakeFetch);
await assert.rejects(() => collectAt(now+21600000), /noaa_cycle_mismatch/);
console.log("NOAA coletor OK");
NOAA_COLLECT
