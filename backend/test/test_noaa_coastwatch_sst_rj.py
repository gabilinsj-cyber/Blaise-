import importlib.util
import unittest
from datetime import datetime,timezone,timedelta
from pathlib import Path
P=Path(__file__).resolve().parents[1]/"scripts"/"probe-noaa-coastwatch-sst-rj.py"
s=importlib.util.spec_from_file_location("acspo_sst",P)
mod=importlib.util.module_from_spec(s);s.loader.exec_module(mod)
NOW=datetime(2026,11,18,13,0,tzinfo=timezone.utc)
URL=mod.ROOT+"2026/11/18/20261118100000-STAR-L3C_GHRSST-SSTsubskin-ABI_G19-ACSPO_V3.00-v02.1-fv01.0.nc"
def fake(path,now):
 return {"validAt":(now-timedelta(hours=2)).isoformat().replace("+00:00","Z"),
  "gridType":"GHRSST_L3C_1D_LATLON",
  "points":[{"id":p["id"],"latitude":p["latitude"],"longitude":p["longitude"],
   "dataLatitude":p["latitude"],"dataLongitude":p["longitude"],
   "temperatureC":23.9,"qualityLevel":5} for p in mod.POINTS]}
class CoastwatchGates(unittest.TestCase):
 def test_correct_official_url_and_l3c_timestamp(self):
  self.assertTrue(mod.allowed(URL,file=True))
  self.assertFalse(mod.allowed(URL.replace("coastwatch.noaa.gov","bad.org"),file=True))
  self.assertTrue(mod.recent_filename_date(URL.rsplit("/",1)[-1]))
  self.assertFalse(mod.recent_filename_date("wrong.nc"))
 def test_mocked_provider_has_three_derived_sst_values(self):
  v=mod.probe_noaa_coastwatch_sst(now=NOW,discovery=lambda now:URL,
   download=lambda _:b"\x89HDF"+bytes(128),decode=fake)
  self.assertEqual(v["status"],"FULL")
  self.assertEqual(v["verifiedPoints"],3)
  self.assertFalse(v["underlyingSensorIndependentOfEumetsat"])
  self.assertFalse(v["publishedToSubscriber"])
 def test_quality_4_is_not_sufficient_for_acspo(self):
  def low(path,now):
   v=fake(path,now);v["points"][1]["qualityLevel"]=4;return v
  o=mod.probe_noaa_coastwatch_sst(now=NOW,discovery=lambda now:URL,
   download=lambda _:b"\x89HDF"+bytes(128),decode=low)
  self.assertEqual(o["status"],"PARTIAL")
  self.assertEqual(o["verifiedPoints"],2)
  self.assertIsNone(o["points"][1]["temperatureC"])
 def test_failed_distributor_is_not_zero_sst(self):
  v=mod.probe_noaa_coastwatch_sst(now=NOW,discovery=lambda _:None)
  self.assertEqual(v["status"],"UNAVAILABLE")
  self.assertEqual(v["points"],[])
  self.assertIsNone(v["validAt"])
if __name__=="__main__":unittest.main()
