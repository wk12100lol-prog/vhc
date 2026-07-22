"""Generuje ikony PWA dla VHC"""
from PIL import Image, ImageDraw, ImageFont
import os

os.makedirs('icons', exist_ok=True)

def make_icon(size):
    img = Image.new('RGBA', (size, size), (10, 14, 23, 255))
    draw = ImageDraw.Draw(img)
    # gradient tla
    for y in range(size):
        r = int(10 + (0 - 10) * y / size)
        g = int(14 + (212 - 14) * y / size)
        b = int(23 + (170 - 23) * y / size)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))
    # kolo
    cx, cy = size // 2, size // 2
    r = size // 3
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(0, 212, 170, 255))
    # litera V
    draw.text((cx, cy), 'V', fill='white', anchor='mm',
              font=ImageFont.truetype("arial.ttf", size=int(size * 0.4)))
    img.save(f'icons/icon-{size}.png')
    print(f'icon-{size}.png')

make_icon(192)
make_icon(512)
