import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
export async function readMarineGribMetadata(file) {
  if (typeof file !== "string" || !file.startsWith("/") || file.includes("\0")) throw new Error("marine_grib_path_invalid");
  const { stdout } = await run("grib_get", ["-p", "shortName,units,dataDate,dataTime,validityDate,validityTime", file], { timeout: 15000, maxBuffer: 65536 });
  return stdout.trim();
}
export async function readMarineGribPoint(file, latitude, longitude) {
  const metadata = await readMarineGribMetadata(file);
  if (![latitude, longitude].every(Number.isFinite)) throw new Error("marine_coordinates_invalid");
  if (latitude < -25 || latitude > -21 || longitude < -45 || longitude > -40) throw new Error("marine_outside_rj");
  const [variable, units, dataDate, dataTime, validityDate, validityTime] = metadata.split(/\s+/);
  if (variable !== "swh" || units !== "m") throw new Error("marine_variable_or_units_invalid");
  if (metadata.split(/\s+/).length !== 6) throw new Error("marine_single_record_required");
  const point = latitude + "," + (longitude + 360) + ",1";
  const { stdout } = await run("grib_get", ["-l", point, file], { timeout: 15000, maxBuffer: 65536 });
  const raw = stdout.trim();
  const waveHeightM = Number(raw);
  if (!raw || !Number.isFinite(waveHeightM) || waveHeightM < 0) throw new Error("marine_wave_invalid");
  return { waveHeightM, units, dataDate, dataTime, validityDate, validityTime };
}
