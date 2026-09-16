from PIL import Image, ImageFilter
import sys
from collections import deque


def remove_bg_keep_figure(input_path, output_path, crop_watermark=True):
    """
    Remove white background AND ground shadow, keep only the mascot figure.
    Uses color seeds + region growing + hole filling for a clean silhouette.
    """
    img = Image.open(input_path).convert("RGBA")

    if crop_watermark:
        width, height = img.size
        crop_h = min(45, height // 25)
        crop_w = min(140, width // 7)
        img = img.crop((0, 0, width - crop_w, height - crop_h))

    width, height = img.size
    px = img.load()

    def avg_rgb(r, g, b):
        return (r + g + b) / 3

    def spread(r, g, b):
        return max(r, g, b) - min(r, g, b)

    def saturation(r, g, b):
        mx = max(r, g, b)
        return 0 if mx == 0 else spread(r, g, b) / mx

    def is_definite_object(r, g, b):
        """Seeds: colored or dark pixels that are definitely part of the mascot."""
        s = saturation(r, g, b)
        a = avg_rgb(r, g, b)
        # Dark eyes / strong features
        if a < 110:
            return True
        # Strongly colored: pink hair, cheeks, mint crystal, blue shirt
        if s > 0.16:
            return True
        # Mint-green-ish crystal
        if g > 190 and r < 220 and b > 150 and g > r + 20:
            return True
        return False

    def can_be_object(r, g, b):
        """Region-growing constraint: exclude pure white bg and gray shadow."""
        a = avg_rgb(r, g, b)
        sp = spread(r, g, b)
        # Pure white background
        if a > 248 and sp < 8:
            return False
        # Gray shadow (light, desaturated)
        if a > 215 and sp < 6:
            return False
        return True

    # Step 1: initial object mask from seeds
    mask = Image.new("L", (width, height), 0)
    mp = mask.load()
    queue = deque()
    for y in range(height):
        for x in range(width):
            r, g, b, _ = px[x, y]
            if is_definite_object(r, g, b):
                mp[x, y] = 255
                queue.append((x, y))

    print(f"Seed pixels: {len(queue)}")

    # Step 2: region grow to fill body/face
    visited = bytearray(width * height)
    for x, y in queue:
        visited[y * width + x] = 1

    while queue:
        x, y = queue.popleft()
        r0, g0, b0, _ = px[x, y]
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height:
                ni = ny * width + nx
                if visited[ni]:
                    continue
                r, g, b, _ = px[nx, ny]
                if can_be_object(r, g, b):
                    visited[ni] = 1
                    mp[nx, ny] = 255
                    queue.append((nx, ny))

    # Step 3: hole filling (interior background regions become object)
    mask_data = list(mask.getdata())
    exterior = bytearray(width * height)
    q = deque()
    for x in range(width):
        for y in (0, height - 1):
            idx = y * width + x
            if mask_data[idx] == 0 and not exterior[idx]:
                exterior[idx] = 1
                q.append(idx)
    for y in range(height):
        for x in (0, width - 1):
            idx = y * width + x
            if mask_data[idx] == 0 and not exterior[idx]:
                exterior[idx] = 1
                q.append(idx)
    while q:
        idx = q.popleft()
        cx, cy = idx % width, idx // width
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < width and 0 <= ny < height:
                ni = ny * width + nx
                if not exterior[ni] and mask_data[ni] == 0:
                    exterior[ni] = 1
                    q.append(ni)
    for i in range(len(mask_data)):
        if mask_data[i] == 0 and not exterior[i]:
            mp[i % width, i // width] = 255

    # Step 4: keep largest connected component
    mask_data = list(mask.getdata())
    visited = bytearray(width * height)
    comps = []
    for y in range(height):
        for x in range(width):
            idx = y * width + x
            if visited[idx] or mask_data[idx] < 255:
                continue
            comp = []
            q2 = deque([idx])
            visited[idx] = 1
            while q2:
                ci = q2.popleft()
                comp.append(ci)
                cx, cy = ci % width, ci // width
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < width and 0 <= ny < height:
                        ni = ny * width + nx
                        if not visited[ni] and mask_data[ni] == 255:
                            visited[ni] = 1
                            q2.append(ni)
            comps.append(comp)

    comps.sort(key=len, reverse=True)
    keep = set(comps[0]) if comps else set()
    print(f"Components: {len(comps)}, kept size {len(keep)}, removed {sum(len(c) for c in comps[1:])}")

    alpha_data = [255 if i in keep else 0 for i in range(len(mask_data))]
    alpha_img = Image.new("L", (width, height))
    alpha_img.putdata(alpha_data)

    # Step 5: feather edges for natural look
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=0.8))

    out = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    out.paste(img, (0, 0), alpha_img)
    out.save(output_path)
    print(f"Saved to {output_path}")


if __name__ == "__main__":
    input_path = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\EDY\WorkBuddy\2026-07-28-16-16-02\app\public\images\bongbong-3d-original.png"
    output_path = sys.argv[2] if len(sys.argv) > 2 else r"C:\Users\EDY\WorkBuddy\2026-07-28-16-16-02\app\public\images\bongbong-3d.png"
    remove_bg_keep_figure(input_path, output_path)
