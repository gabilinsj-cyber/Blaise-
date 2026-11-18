#!/usr/bin/env python3
"""No fake *operational* SST; these mocks only test provenance/QA gates."""
import importlib.util
import unittest
from pathlib import Path
from datetime import datetime,timezone,timedelta
HERE=Path(__file__).resolve().parents[1]/"scripts"/"probe-osisaf-sst-rj-staging.py"
spec=importlib.util.spec_from_file_location("rj_osisaf_coast",HERE)
probe=importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

NOW=datetime(2026,11,18,12,0,tzinfo=timezone.utc)
URL="https://osi-saf.ifremer.fr/sst/l3c/west_atlantic_east_pacific/2026/11/18/GOES19_20261118.nc"
def good(path,now):
    return {"validAt":(now-timedelta(hours=2)).isoformat().replace("+00:00","Z"),
      "gridType":"GHRSST_L3C_1D_LATLON",
      "points":[{"id":p["id"],"latitude":p["latitude"],"longitude":p["longitude"],
      "dataLatitude":p["latitude"]+0.01,"dataLongitude":p["longitude"]+0.01,
      "qualityLevel":5,"temperatureC":24.5} for p in probe.POINTS]}
class OsiSafGatedProbe(unittest.TestCase):
 def test_official_source_without_redirect_or_wrong_product(self):
  self.assertTrue(probe.source_allowed(URL))
  self.assertFalse(probe.source_allowed("https://evil.org/GOES19_20261118.nc"))
  self.assertFalse(probe.source_allowed("http://osi-saf.ifremer.fr/sst/l3c/west_atlantic_east_pacific/2026/11/GOES19.nc"))
  self.assertFalse(probe.source_allowed(URL+"?token=private"))
 def test_real_netcdf_gate_mocked_decoder(self):
  r=probe.probe_osi_saf_rj(now=NOW,discovery=lambda at:URL,
    download=lambda u:b"\x89HDF\r\n\x1a\n"+bytes(90),
    decode=good)
  self.assertEqual(r["status"],"FULL")
  self.assertEqual(r["verifiedPoints"],3)
  self.assertEqual(r["kind"],"E")
  self.assertFalse(r["publishedToSubscriber"])
  self.assertTrue(r["measuredAsAirTemperature"] is False)
 def test_no_source_status_is_not_zero_degrees(self):
  r=probe.probe_osi_saf_rj(now=NOW,discovery=lambda at:None)
  self.assertEqual(r["status"],"UNAVAILABLE")
  self.assertIsNone(r["validAt"])
  self.assertEqual(r["points"],[])
 def test_low_qa_remains_null_at_missing_point(self):
  def low(path,now):
    o=good(path,now)
    o["points"][1]["temperatureC"]=None
    o["points"][1]["qualityLevel"]=None
    return o
  r=probe.probe_osi_saf_rj(now=NOW,discovery=lambda at:URL,
    download=lambda u:b"\x89HDF\r\n\x1a\n"+bytes(90),decode=low)
  self.assertEqual(r["status"],"PARTIAL")
  self.assertEqual(r["verifiedPoints"],2)
  self.assertIsNone(r["points"][1]["temperatureC"])
 def test_expired_satellite_timestamp_is_rejected(self):
  def stale(path,now):
    o=good(path,now)
    o["validAt"]=(now-timedelta(hours=18)).isoformat().replace("+00:00","Z")
    return o
  r=probe.probe_osi_saf_rj(now=NOW,discovery=lambda at:URL,
    download=lambda u:b"\x89HDF\r\n\x1a\n"+bytes(90),decode=stale)
  self.assertEqual(r["status"],"UNAVAILABLE")
  self.assertIn("SST_TIME_NOT_FRESH",r["reason"])
if __name__=="__main__":
 unittest.main()
