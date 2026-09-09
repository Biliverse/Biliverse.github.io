"""按主体居中生成新图标，不改原图。
Center new icons on the main subject without modifying original PNGs.
"""
import hashlib
import json
import math
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
    # 粉色主体与蓝色徽标分离；项目总 logo 没有角标，使用完整图形。
    # Separate the pink subject from the blue badge; the project logo uses its whole unbadged shape.
    subject = Image.new("L", image.size)
    subject.putdata([255 if a > 32 and r > 180 and r > g * 1.3 and r > b * 1.2 else 0
                     for r, g, b, a in image.getdata()])
    body = bounds if name == "Biliverse" else subject.getbbox()
    if body is None:
        raise ValueError(f"No main subject found: {name}")
    cx, cy = (body[0] + body[2]) / 2, (body[1] + body[3]) / 2
    radius = math.ceil(max(cx - bounds[0], bounds[2] - cx, cy - bounds[1], bounds[3] - cy)) + 16
    side = radius * 2
    crop = (math.floor(cx - radius), math.floor(cy - radius), math.floor(cx - radius) + side, math.floor(cy - radius) + side)
    square = image.crop(crop)
    light = square.resize((256, 256), Image.Resampling.LANCZOS)
    # 暗色背景略微提亮，保持透明通道和白色细节。
    # Lift color channels for dark surfaces, retaining alpha and white details.
    channels = [channel.point(lambda value: round(value + (255 - value) * 0.12))
                for channel in light.split()[:3]]
    dark = Image.merge("RGBA", (*channels, light.getchannel("A")))
    destination = root / "settings/icons"
    destination.mkdir(parents=True, exist_ok=True)
    for mode, output in (("light", light), ("dark", dark)):
        output.save(destination / f"{name}_subject_{mode}.png", optimize=True)
    assert source.read_bytes() == original
    records.append({"name": name, "source": str(source.relative_to(root.parent)),
                    "sha256": hashlib.sha256(original).hexdigest(), "alphaBounds": bounds,
                    "subjectBounds": body, "center": [cx, cy], "crop": crop,
                    "squareSize": side, "outputSize": 256,
                    "outputs": [f"settings/icons/{name}_subject_{mode}.png" for mode in ("light", "dark")]})
(root / "settings/icons-manifest.json").write_text(json.dumps(records, indent=2) + "\n")
print(json.dumps(records, indent=2))
