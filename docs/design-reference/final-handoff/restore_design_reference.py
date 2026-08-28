from __future__ import annotations

import base64
import hashlib
import io
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXPECTED_SHA256 = "87ebcd073cec6631bca88824a9293820d0dacb58fc7f485cdd164b10966bdcad"

parts = sorted(ROOT.glob("bundle.part*.b64"))
if not parts:
    raise SystemExit("No bundle.part*.b64 files found beside this script.")

encoded = "".join(part.read_text(encoding="utf-8").strip() for part in parts)
bundle = base64.b64decode(encoded, validate=True)
actual = hashlib.sha256(bundle).hexdigest()
if actual != EXPECTED_SHA256:
    raise SystemExit(f"Visual-reference bundle checksum mismatch: {actual}")

source_dir = ROOT / "source"
if source_dir.exists():
    shutil.rmtree(source_dir)
source_dir.mkdir(parents=True)

with zipfile.ZipFile(io.BytesIO(bundle)) as archive:
    archive.extractall(source_dir)

print(f"Restored exact Needle design handoff to: {source_dir}")
print("Open source/design_handoff_needle_redesign/Needle Handoff Spec.dc.html first.")
print("Then open source/design_handoff_needle_redesign/Needle Redesign.dc.html for the visual mockups.")
