from PIL import Image, ImageFilter, ImageChops
import sys

def remove_background(input_path, output_path):
    """Remove checkered/white background from centered mascot via edge flood-fill + hole filling."""
    img = Image.open(input_path).convert('RGBA')
    w, h = img.size
    px = img.load()

    # Downscale for speed
    scale = 2
    small = img.resize((w // scale, h // scale), Image.Resampling.LANCZOS)
    sw, sh = small.size
    spx = small.load()

    def is_bg_like(r, g, b):
        # Catches white and light-gray checkered background
        return (r > 210 and g > 210 and b > 210) or (max(r, g, b) - min(r, g, b) < 10 and r > 170)

    # Step 1: Flood fill background from edges
    bg = [[False] * sh for _ in range(sw)]
    stack = []
    for x in range(sw):
        for y in [0, sh - 1]:
            if not bg[x][y] and is_bg_like(*spx[x, y][:3]):
                stack.append((x, y))
                bg[x][y] = True
    for y in range(sh):
        for x in [0, sw - 1]:
            if not bg[x][y] and is_bg_like(*spx[x, y][:3]):
                stack.append((x, y))
                bg[x][y] = True

    while stack:
        x, y = stack.pop()
        r0, g0, b0 = spx[x, y][:3]
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < sw and 0 <= ny < sh and not bg[nx][ny]:
                r, g, b = spx[nx, ny][:3]
                if is_bg_like(r, g, b) and abs(r - r0) < 45 and abs(g - g0) < 45 and abs(b - b0) < 45:
                    bg[nx][ny] = True
                    stack.append((nx, ny))

    # Step 2: Fill holes in background (background regions not touching edge are inside mascot)
    # Flood fill background from edges again on a cleaned mask to identify true background
    bg_filled = [[False] * sh for _ in range(sw)]
    stack = []
    for x in range(sw):
        for y in [0, sh - 1]:
            if bg[x][y] and not bg_filled[x][y]:
                stack.append((x, y))
                bg_filled[x][y] = True
    for y in range(sh):
        for x in [0, sw - 1]:
            if bg[x][y] and not bg_filled[x][y]:
                stack.append((x, y))
                bg_filled[x][y] = True

    while stack:
        x, y = stack.pop()
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < sw and 0 <= ny < sh and not bg_filled[nx][ny] and bg[nx][ny]:
                bg_filled[nx][ny] = True
                stack.append((nx, ny))

    # Step 3: Mascot mask = not background_filled
    mask = Image.new('L', (sw, sh), 0)
    mp = mask.load()
    for x in range(sw):
        for y in range(sh):
            if not bg_filled[x][y]:
                mp[x, y] = 255

    # Scale up, feather
    mask = mask.resize((w, h), Image.Resampling.LANCZOS)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=0.6))

    # Apply
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
    remove_background(input_path, output_path)
