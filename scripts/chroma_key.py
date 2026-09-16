from PIL import Image, ImageFilter, ImageChops
import sys

def chroma_key(input_path, output_path):
    """Remove bright green screen background while preserving mint/cyan crystal."""
    img = Image.open(input_path).convert('RGBA')
    w, h = img.size
    px = img.load()

    mask = Image.new('L', (w, h), 0)
    mp = mask.load()

    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            # Bright green screen detection
            # Screen green: G is high, R and B moderate-low, G dominates strongly
            is_screen_green = (g > 180 and r < 140 and b < 120 and (g - r) > 50 and (g - b) > 50)
            if is_screen_green:
                mp[x, y] = 0
            else:
                mp[x, y] = 255

    # Feather edges to remove green fringe
    mask = mask.filter(ImageFilter.GaussianBlur(radius=1.2))

    # Apply mask
    r, g, b, a = img.split()
    combined = ImageChops.multiply(a, mask)
    img.putalpha(combined)

    # Crop
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    pad = 20
    out = Image.new('RGBA', (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    out.paste(img, (pad, pad), img)
    out.save(output_path)
    print(f"Saved {output_path} ({out.size})")

if __name__ == '__main__':
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    chroma_key(input_path, output_path)
