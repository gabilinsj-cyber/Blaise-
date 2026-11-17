"""Offline synthetic fixtures ONLY; never interpreted as JAXA live data."""
import gzip
import importlib.util
import json
import pathlib
import struct
import tempfile
import unittest
from datetime import datetime, timezone

BASE = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = BASE / "scripts" / "validate-jaxa-gsmap-v9-file.py"
spec = importlib.util.spec_from_file_location("jaxa_binary", SCRIPT)
gsmap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gsmap)
CATALOG = json.loads((BASE / "src" / "rj-ibge-92-points.json").read_text(encoding="utf-8"))
WHEN = datetime(2026, 11, 17, 16, tzinfo=timezone.utc)


class V9GzipTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.path = pathlib.Path(cls.directory.name) / "gsmap_nrt.20261117.1200.dat.gz"
        # The fixture is SYNTHETIC, with two arbitrary cell values, not observations.
        grid = bytearray(gsmap.EXACT_BYTES)
        cls.point = next(p for p in CATALOG["points"] if p["ibge"] == "3304557")
        cls.other = next(p for p in CATALOG["points"] if p["ibge"] == "3303302")
        first, _, _ = gsmap.cell_index(cls.point["lat"], cls.point["lon"])
        second, _, _ = gsmap.cell_index(cls.other["lat"], cls.other["lon"])
        assert first != second
        struct.pack_into("<f", grid, first, 2.75)
        struct.pack_into("<f", grid, second, -99.0)
        cls.path.write_bytes(gzip.compress(grid, compresslevel=1))

    @classmethod
    def tearDownClass(cls):
        cls.directory.cleanup()

    def test_rejects_unknown_future_or_stale_filename(self):
        for name in [
            "gsmap_nrt.20261117.1200.nc",
            "gsmap_nrt.20261117.1200.jpg",
            "gsmap_nrt.20261117.1200.dat",
            "gsmap_nrt.20261117.1260.dat.gz",
        ]:
            with self.assertRaises(ValueError):
                gsmap.parse_product_time(name)
        with self.assertRaises(ValueError):
            gsmap.validate_file(self.path, CATALOG,
                                datetime(2026, 11, 18, 8, tzinfo=timezone.utc))
        with self.assertRaises(ValueError):
            gsmap.validate_file(self.path, CATALOG,
                                datetime(2026, 11, 17, 11, tzinfo=timezone.utc))

    def test_grid_centers_and_missing_rain_are_never_zero_filled(self):
        report = gsmap.validate_file(self.path, CATALOG, WHEN)
        self.assertEqual(report["municipalityPoints"], 92)
        self.assertEqual(len(report["points"]), 92)
        by_id = {p["ibge"]: p for p in report["points"]}
        self.assertAlmostEqual(
            by_id[self.point["ibge"]]["estimatedRateMmPerHour"], 2.75
        )
        self.assertIsNone(by_id[self.other["ibge"]]["estimatedRateMmPerHour"])
        self.assertEqual(by_id[self.other["ibge"]]["valueStatus"], "NO_VALID_RETRIEVAL")
        self.assertEqual(report["nature"], "E")
        self.assertFalse(report["qualityFlagsVerified"])
        self.assertFalse(report["commercialDistributionApproved"])
        self.assertFalse(report["publishedToAndroid"])
        self.assertFalse(report["officialAlert"])
        self.assertEqual(report["status"], "UNPUBLISHED_INTERNAL_NUMERIC_AUDIT")

    def test_invalid_geography_or_wrong_file_size_is_rejected(self):
        bad_catalog = {**CATALOG, "points": CATALOG["points"][:91]}
        with self.assertRaises(ValueError):
            gsmap.validate_file(self.path, bad_catalog, WHEN)
        short = pathlib.Path(self.directory.name) / "gsmap_nrt.20261117.1100.dat.gz"
        short.write_bytes(gzip.compress(b"short synthetic fixture"))
        with self.assertRaises(ValueError):
            gsmap.validate_file(short, CATALOG, WHEN)


if __name__ == "__main__":
    unittest.main()
