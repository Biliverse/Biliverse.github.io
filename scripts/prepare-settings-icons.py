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


def main_subject_bounds(image):
    """返回最大粉色连通区域，避免右下角角标影响主体居中。
    Return the largest connected pink region so a lower-right badge does not shift the subject.
    """
    width, height = image.size
    mask = bytearray(width * height)
    for index, (red, green, blue, alpha) in enumerate(image.get_flattened_data()):
        mask[index] = alpha > 32 and red > 150 and red > green * 1.15 and red > blue * 1.05
    seen = bytearray(width * height)
    largest = None
    for index, visible in enumerate(mask):
        if not visible or seen[index]:
            continue
        seen[index] = 1
        stack = [index]
        count = 0
        x0 = x1 = index % width
        y0 = y1 = index // width
        while stack:
            pixel = stack.pop()
            x, y = pixel % width, pixel // width
            count += 1
            x0, x1 = min(x0, x), max(x1, x)
            y0, y1 = min(y0, y), max(y1, y)
            for neighbor in (pixel - 1, pixel + 1, pixel - width, pixel + width):
                if neighbor < 0 or neighbor >= len(mask) or seen[neighbor] or not mask[neighbor]:
                    continue
                nx, ny = neighbor % width, neighbor // width
                if abs(nx - x) + abs(ny - y) != 1:
                    continue
                seen[neighbor] = 1
                stack.append(neighbor)
        if largest is None or count > largest[0]:
            largest = (count, (x0, y0, x1 + 1, y1 + 1))
    return largest[1] if largest else None


records = []
for name, source in sources.items():
    original = source.read_bytes()
    image = Image.open(source).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    # 项目总 logo 没有角标，使用完整图形；模块图标按最大粉色主体居中。
    # The project logo is unbadged; module icons center their largest pink subject.
    body = bounds if name == "Biliverse" else main_subject_bounds(image)
    if body is None:
        raise ValueError(f"No main subject found: {name}")
    cx, cy = (body[0] + body[2]) / 2, (body[1] + body[3]) / 2
    radius = math.ceil(max(cx - bounds[0], bounds[2] - cx, cy - bounds[1], bounds[3] - cy)) + 16
    side = radius * 2
    crop = (math.floor(cx - radius), math.floor(cy - radius), math.floor(cx - radius) + side, math.floor(cy - radius) + side)
    square = image.crop(crop)
    output = square.resize((256, 256), Image.Resampling.LANCZOS)
    destination = root / "settings/icons"
    destination.mkdir(parents=True, exist_ok=True)
    output.save(destination / f"{name}_subject.png", optimize=True)
    assert source.read_bytes() == original
    records.append({"name": name, "source": str(source.relative_to(root.parent)),
                    "sha256": hashlib.sha256(original).hexdigest(), "alphaBounds": bounds,
                    "subjectBounds": body, "center": [cx, cy], "crop": crop,
                    "squareSize": side, "outputSize": 256,
                    "outputs": [f"settings/icons/{name}_subject.png"]})
(root / "settings/icons-manifest.json").write_text(json.dumps(records, indent=2) + "\n")
print(json.dumps(records, indent=2))
