#!/usr/bin/env python3
"""Regression tests for Dora SHA-256; never download voice assets."""
import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("prepare-dora-voice.py")
spec = importlib.util.spec_from_file_location("prepare_dora_voice", SCRIPT)
voice = importlib.util.module_from_spec(spec)
spec.loader.exec_module(voice)


class DigestTests(unittest.TestCase):
    def test_empty_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "empty.bin"
            path.write_bytes(b"")
            self.assertEqual(voice.digest(path), hashlib.sha256(b"").hexdigest())

    def test_large_file_and_modified_content(self):
        content = (b"Blaise V6 RJ SHA256 regression.\x00\xff" * 80_000)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "large.bin"
            path.write_bytes(content)
            self.assertEqual(voice.digest(path), hashlib.sha256(content).hexdigest())
            with path.open("ab") as stream:
                stream.write(b"tampered")
            self.assertNotEqual(voice.digest(path), hashlib.sha256(content).hexdigest())


if __name__ == "__main__":
    unittest.main()
