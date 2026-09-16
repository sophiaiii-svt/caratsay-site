from PIL import Image, ImageFilter
import sys


def extract_bongbong(input_path, output_path):
    """
    Extract the bongbong mascot from a screenshot that contains
    a checkered/light background and a red arrow annotation.
    """
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    px = img.load()

    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    opx = out.load()

    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            avg = (r + g + b) / 3
            spread = max(r, g, b) - min(r, g, b)
            # Red arrow: high red, low green/blue
            is_red_arrow = r > 180 and g < 100 and b < 100 and r - g > 80
            # Background: very light and low saturation (includes checkered gray/white)
            is_bg = avg > 230 and spread < 25
            if is_red_arrow or is_bg:
                opx[x, y] = (0, 0, 0, 0)
            else:
                opx[x, y] = (r, g, b, 255)

    # Clean up tiny specks via connected component keep-largest
    alpha = out.split()[-1]
    alpha_data = list(alpha.getdata())
    visited = bytearray(width * height)
    from collections import deque
    comps = []
    for y in range(height):
        for x in range(width):
            idx = y * width + x
            if visited[idx] or alpha_data[idx] < 128:
                continue
            comp = []
            q = deque([idx])
            visited[idx] = 1
            while q:
                ci = q.popleft()
                comp.append(ci)
                cx, cy = ci % width, ci // width
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < width and 0 <= ny < height:
                        ni = ny * width + nx
                        if not visited[ni] and alpha_data[ni] >= 128:
                            visited[ni] = 1
                            q.append(ni)
            comps.append(comp)

    if comps:
        comps.sort(key=len, reverse=True)
        keep = set(comps[0])
        new_alpha = [255 if i in keep else 0 for i in range(len(alpha_data))]
        alpha.putdata(new_alpha)
        alpha = alpha.filter(ImageFilter.GaussianBlur(radius=0.5))
        out.putalpha(alpha)

    # Scale up for crispness on site
    out = out.resize((out.width * 6, out.height * 6), Image.LANCZOS)
    out.save(output_path)
    print(f"Extracted bongbong saved to {output_path}")


if __name__ == "__main__":
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    extract_bongbong(input_path, output_path)
