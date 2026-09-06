"""Create new settings icons without modifying their original PNG sources."""
import hashlib
import json
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parents[1]
sources = {"Biliverse": root / "settings/logo.png"}
sources.update({name: root.parent / name / "src/assets/icon.png"
                for name in ("Enhanced", "Global", "Redirect", "ADBlock")})
records = []
for name, source in sources.items():
    original = source.read_bytes()
    image = Image.open(source).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    cropped = image.crop(bounds)
    side = max(cropped.size)
    square = Image.new("RGBA", (side, side))
    square.paste(cropped, ((side - cropped.width) // 2, (side - cropped.height) // 2))
    light = square.resize((256, 256), Image.Resampling.LANCZOS)
    # Lift color channels slightly for dark surfaces; retain the alpha and white details.
    channels = [channel.point(lambda value: round(value + (255 - value) * 0.12))
                for channel in light.split()[:3]]
    dark = Image.merge("RGBA", (*channels, light.getchannel("A")))
    prefix = "logo" if name == "Biliverse" else "icon"
    for mode, output in (("light", light), ("dark", dark)):
        output.save(source.parent / f"{prefix}_settings_{mode}.png", optimize=True)
    assert source.read_bytes() == original
    records.append({"name": name, "source": str(source.relative_to(root.parent)),
                    "sha256": hashlib.sha256(original).hexdigest(), "alphaBounds": bounds,
                    "squareSize": side, "outputSize": 256})
(root / "settings/icons-manifest.json").write_text(json.dumps(records, indent=2) + "\n")
print(json.dumps(records, indent=2))
