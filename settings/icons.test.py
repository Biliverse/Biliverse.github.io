import hashlib
import json
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parents[2]
for record in json.loads((root / "Biliverse.github.io/settings/icons-manifest.json").read_text()):
    source = root / record["source"]
    assert hashlib.sha256(source.read_bytes()).hexdigest() == record["sha256"]
    assert len(record["outputs"]) == 1
    image = Image.open(root / "Biliverse.github.io" / record["outputs"][0]).convert("RGBA")
    assert image.size == (256, 256)
    x0, y0, x1, y1 = image.getchannel("A").getbbox()
    assert 0 < x0 < x1 < 256 and 0 < y0 < y1 < 256
    body = record["subjectBounds"]
    crop = record["crop"]
    for axis in (0, 1):
        center = ((body[axis] + body[axis + 2]) / 2 - crop[axis]) * 256 / record["squareSize"]
        assert abs(center - 128) <= 1
    assert 0 in image.getchannel("A").getextrema()
    print(record["name"], "subject centered, badge retained, single transparent asset; original SHA-256 unchanged")
