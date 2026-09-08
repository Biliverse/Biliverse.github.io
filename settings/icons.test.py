import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops

root = Path(__file__).resolve().parents[2]
for record in json.loads((root / "Biliverse.github.io/settings/icons-manifest.json").read_text()):
    source = root / record["source"]
    assert hashlib.sha256(source.read_bytes()).hexdigest() == record["sha256"]
    prefix = record["name"] if record["name"] == "Enhanced" else "logo" if record["name"] == "Biliverse" else "icon"
    directory = root / "Biliverse.github.io/settings/icons" if record["name"] == "Enhanced" else source.parent
    light = Image.open(directory / f"{prefix}_settings_light.png").convert("RGBA")
    dark = Image.open(directory / f"{prefix}_settings_dark.png").convert("RGBA")
    assert light.size == dark.size == (256, 256)
    assert light.getchannel("A").tobytes() == dark.getchannel("A").tobytes()
    x0, y0, x1, y1 = light.getchannel("A").getbbox()
    assert max(x1 - x0, y1 - y0) == 256
    assert abs(x0 - (256 - x1)) <= 1 and abs(y0 - (256 - y1)) <= 1
    assert 0 in light.getchannel("A").getextrema()
    assert ImageChops.difference(light.convert("RGB"), dark.convert("RGB")).getbbox()
    print(record["name"], "square, centered, transparent, paired themes; original SHA-256 unchanged")
