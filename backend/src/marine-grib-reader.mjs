import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
export async function readMarineGribMetadata(file) {
  if (typeof file !== "string" || !file.startsWith("/") || file.includes("\0")) throw new Error("marine_grib_path_invalid");
  const { stdout } = await run("grib_get", ["-p", "shortName,units,dataDate,dataTime,validityDate,validityTime", file], { timeout: 15000, maxBuffer: 65536 });
  return stdout.trim();
}
