"""Draw the Hapa Versus app icon procedurally (no external art): a dusk tile with two facing
banners (seat A gold, seat B coral) over a board grid. Writes desktop/icons/hapa-versus.icns.
Run: python3 tools/hapa/make-icon.py (needs Pillow and macOS iconutil)."""
import os, subprocess, tempfile
from PIL import Image, ImageDraw

def draw(n):
    s = 1024
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = 200
    d.rounded_rectangle([40, 40, s - 40, s - 40], r, fill=(28, 22, 34, 255))
    for i in range(40, s - 40, 4):  # dusk gradient
        t = (i - 40) / (s - 80)
        d.line([(60, i), (s - 60, i)], fill=(int(40 + 70 * t), int(30 + 30 * t), int(60 - 20 * t), 255))
    mask = Image.new('L', (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([40, 40, s - 40, s - 40], r, fill=255)
    bg = Image.new('RGBA', (s, s), (0, 0, 0, 0)); bg.paste(im, (0, 0), mask); im = bg; d = ImageDraw.Draw(im)
    # board grid in perspective-free plan view
    for k in range(5):
        y = 600 + k * 70
        d.line([(170, y), (854, y)], fill=(240, 214, 160, 90), width=6)
    for k in range(7):
        x = 170 + k * 114
        d.line([(x, 600), (x, 880)], fill=(240, 214, 160, 90), width=6)
    # two banners facing each other
    d.polygon([(250, 170), (470, 220), (470, 520), (360, 470), (250, 520)], fill=(232, 182, 72, 255))
    d.polygon([(774, 170), (554, 220), (554, 520), (664, 470), (774, 520)], fill=(232, 106, 92, 255))
    d.rectangle([236, 150, 262, 560], fill=(245, 236, 214, 255))
    d.rectangle([762, 150, 788, 560], fill=(245, 236, 214, 255))
    return im.resize((n, n), Image.LANCZOS)

root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out = os.path.join(root, 'desktop', 'icons')
with tempfile.TemporaryDirectory() as t:
    iconset = os.path.join(t, 'hapa-versus.iconset'); os.makedirs(iconset)
    for n in (16, 32, 64, 128, 256, 512):
        draw(n).save(os.path.join(iconset, f'icon_{n}x{n}.png'))
        draw(n * 2).save(os.path.join(iconset, f'icon_{n}x{n}@2x.png'))
    subprocess.run(['iconutil', '-c', 'icns', iconset, '-o', os.path.join(out, 'hapa-versus.icns')], check=True)
draw(512).save(os.path.join(out, 'hapa-versus.png'))
print('wrote', os.path.join(out, 'hapa-versus.icns'))
