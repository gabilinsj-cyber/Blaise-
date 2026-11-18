#!/usr/bin/env python3
import importlib.util
import unittest
from datetime import datetime,timezone,timedelta
from pathlib import Path
p=Path(__file__).resolve().parents[1]/"scripts"/"probe-noaa-glm19-rj-staging.py"
sp=importlib.util.spec_from_file_location("noaa_glm19_rj",p)
m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
NOW=datetime(2026,11,18,14,0,0,tzinfo=timezone.utc)
t=NOW-timedelta(minutes=10)
dt=t.strftime("%Y%j%H%M%S")+"0"
KEY=f"GLM-L2-LCFA/{t.year}/{t.timetuple().tm_yday:03d}/{t.hour:02d}/OR_GLM-L2-LCFA_G19_s{dt}_e{dt}_c{dt}.nc"
def xml(key):
 return f'<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><Contents><Key>{key}</Key></Contents></ListBucketResult>'.encode()
class NoaaGlmProvenanceTests(unittest.TestCase):
 def test_official_20_second_glm_key_discovery_without_credentials(self):
  self.assertTrue(m.KEY_PATTERN.fullmatch(KEY))
  got=m.find_latest_glm_key(NOW,lambda _:xml(KEY))
  self.assertEqual(got,KEY)
  self.assertTrue(m.list_url(NOW).startswith(m.S3))
 def test_one_real_shape_stub_never_claims_alert_or_municipal_coverage(self):
  r=m.probe_noaa_glm(now=NOW,find=lambda _:KEY,
   download=lambda url:b"\x89HDF"+bytes(220),
   decode=lambda _:{"validFlashesInSingleFile":9,
      "rjRectangleFlashesInSingleFile":2})
  self.assertEqual(r["status"],"VALIDATED_ONE_FILE")
  self.assertEqual(r["rjRectangleFlashesInSingleFile"],2)
  self.assertFalse(r["physicalGroundStrikesMeasured"])
  self.assertFalse(r["municipalFlashesValidated"])
  self.assertFalse(r["publishableWarning"])
  self.assertFalse(r["publishedToSubscribers"])
 def test_no_file_does_not_mean_no_lightning(self):
  r=m.probe_noaa_glm(now=NOW,find=lambda _:None)
  self.assertEqual(r["status"],"UNAVAILABLE")
  self.assertIsNone(r["rjRectangleFlashesInSingleFile"])
 def test_invalid_netcdf_and_unrealistic_counter_fail_closed(self):
  r=m.probe_noaa_glm(now=NOW,find=lambda _:KEY,
   download=lambda _:b"not real netcdf",decode=lambda _:{"validFlashesInSingleFile":0,
    "rjRectangleFlashesInSingleFile":0})
  self.assertEqual(r["status"],"UNAVAILABLE")
  r=m.probe_noaa_glm(now=NOW,find=lambda _:KEY,
   download=lambda _:b"\x89HDF"+bytes(180),decode=lambda _:{
    "validFlashesInSingleFile":2,"rjRectangleFlashesInSingleFile":4})
  self.assertEqual(r["status"],"UNAVAILABLE")
 def test_old_glm_detection_is_not_current(self):
  old=(NOW-timedelta(hours=6))
  stamp=old.strftime("%Y%j%H%M%S")+"0"
  key=f"GLM-L2-LCFA/{old.year}/{old.timetuple().tm_yday:03d}/{old.hour:02d}/OR_GLM-L2-LCFA_G19_s{stamp}_e{stamp}_c{stamp}.nc"
  self.assertEqual(m.parse_s3_glm_keys(xml(key),NOW),[])
  self.assertEqual(m.probe_noaa_glm(now=NOW,find=lambda _:key)["status"],"UNAVAILABLE")
if __name__=="__main__":unittest.main()
