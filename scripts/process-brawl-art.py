#!/usr/bin/env python3
import sys
import os
from PIL import Image

ROLES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../apps/web/public/art/roles"))

def process_role_art(source_path: str, role_prefix: str):
    if not os.path.exists(source_path):
        print(f"Error: Source file not found: {source_path}")
        sys.exit(1)

    im = Image.open(source_path).convert("RGB")
    width, height = im.size

    # Crop to 1:1 square centered
    min_dim = min(width, height)
    left = (width - min_dim) // 2
    top = (height - min_dim) // 2
    right = left + min_dim
    bottom = top + min_dim
    im_square = im.crop((left, top, right, bottom))

    os.makedirs(ROLES_DIR, exist_ok=True)

    # 1. 640x640 High Res Portrait
    im_640 = im_square.resize((640, 640), Image.Resampling.LANCZOS)
    path_640 = os.path.join(ROLES_DIR, f"{role_prefix}-640.webp")
    im_640.save(path_640, "WEBP", quality=82, method=6)
    size_640 = os.path.getsize(path_640)

    # 2. 160x160 Avatar
    im_160 = im_square.resize((160, 160), Image.Resampling.LANCZOS)
    path_160 = os.path.join(ROLES_DIR, f"{role_prefix}-160.webp")
    im_160.save(path_160, "WEBP", quality=80, method=6)
    size_160 = os.path.getsize(path_160)

    print(f"Processed {role_prefix}:")
    print(f"  640x640: {path_640} ({size_640 / 1024:.1f} KB)")
    print(f"  160x160: {path_160} ({size_160 / 1024:.1f} KB)")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 process-brawl-art.py <source_image_path> <role_prefix>")
        sys.exit(1)
    process_role_art(sys.argv[1], sys.argv[2])
