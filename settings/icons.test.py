import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops

root = Path(__file__).resolve().parents[2]
for record in json.loads((root / "Biliverse.github.io/settings/icons-manifest.json").read_text()):
    source = root / record["source"]
    assert hashlib.sha256(source.read_bytes()).hexdigest() == record["sha256"]
    light, dark = [Image.open(root / "Biliverse.github.io" / path).convert("RGBA") for path in record["outputs"]]
    assert light.size == dark.size == (256, 256)
    assert light.getchannel("A").tobytes() == dark.getchannel("A").tobytes()
    x0, y0, x1, y1 = light.getchannel("A").getbbox()
    assert 0 < x0 < x1 < 256 and 0 < y0 < y1 < 256
    body = record["subjectBounds"]
    crop = record["crop"]
    for axis in (0, 1):
        center = ((body[axis] + body[axis + 2]) / 2 - crop[axis]) * 256 / record["squareSize"]
        assert abs(center - 128) <= 1
    assert 0 in light.getchannel("A").getextrema()
    assert ImageChops.difference(light.convert("RGB"), dark.convert("RGB")).getbbox()
    print(record["name"], "subject centered, badge retained, paired themes; original SHA-256 unchanged")
