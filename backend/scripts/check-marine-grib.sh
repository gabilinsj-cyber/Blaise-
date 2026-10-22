set -eu
grib_get -p shortName,units,dataDate,dataTime,validityDate,validityTime,Ni,Nj /fixtures/noaa-wave-20261022-06.grib2
grib_ls -n geography /fixtures/noaa-wave-20261022-06.grib2
grib_ls -l -23.5,317 /fixtures/noaa-wave-20261022-06.grib2
node --input-type=module <<\NOAA_TEST
import { readMarineGribPoint } from "./src/marine-grib-reader.mjs";
const result = await readMarineGribPoint("/fixtures/noaa-wave-20261022-06.grib2", -23.5, -43);
if (Math.abs(result.waveHeightM - 1.64) > 0.001) throw new Error("noaa_fixture_height_mismatch");
console.log("NOAA fixture OK", JSON.stringify(result));
NOAA_TEST
