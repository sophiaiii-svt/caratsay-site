from PIL import Image
from pathlib import Path

INPUT_DIR = Path(r"C:\Users\EDY\Documents\xwechat_files\wxid_d2tswczcilzq12_ccac\temp\RWTemp\2026-08")
OUTPUT_DIR = Path(r"C:\Users\EDY\WorkBuddy\2026-07-28-16-16-02\app\public\signatures")

# 顺序：第 1 张团体，第 2-14 张依次为 S.Coups → Dino
FILES = [
    ("8b1dfe22971579e2baedd4afc7c31449.jpg", "group.png"),
    ("7aef612531529a66c242e472e2561ee1.jpg", "scoups.png"),
    ("abc350c347d7fd4d0451313b19bc259a.jpg", "jeonghan.png"),
    ("a3c191325f86bc37e181a0d6841c1d21.jpg", "joshua.png"),
    ("904f43e7d49ed0c861f8d0edf41e659f.jpg", "jun.png"),
    ("62a58bf8d812c90ae09b8cacf25781db.jpg", "hoshi.png"),
    ("d451e5f87b8484ce15fe2c03116f90da.jpg", "wonwoo.png"),
    ("9dc69510b9ee662aa2d428cc7eb670c2.jpg", "woozi.png"),
    ("1cecbe8d56131a1f74a545e77ac8bd22.jpg", "the8.png"),
    ("98e1abeb7fc989c9b3953fb5821e6535.jpg", "mingyu.png"),
    ("fcb923332e9c51166d45ff22ed742ad5.jpg", "dk.png"),
    ("56901bfdd84346df1ad5d27c985fc9d9.jpg", "seungkwan.png"),
    ("0b949d7e3aee1ac961eb0f2bf836b610.jpg", "vernon.png"),
    ("9d7ab49a654c89c925ee9e9dfa05a830.jpg", "dino.png"),
]

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def process(src: Path, dst: Path) -> None:
    img = Image.open(src).convert("RGBA")
    pixels = img.load()
    width, height = img.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # 以最大通道值作为“亮度”，越亮越透明；保留反锯齿灰度
            light = max(r, g, b)
            if light >= 250:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                # 把颜色压成黑，alpha 按亮度反比保留边缘过渡
                alpha = int(255 * (1 - light / 255))
                pixels[x, y] = (0, 0, 0, alpha)

    # 裁切到非透明区域，留 4px 边距
    bbox = img.getbbox()
    if bbox:
        left, top, right, bottom = bbox
        img = img.crop((max(0, left - 4), max(0, top - 4), right + 4, bottom + 4))

    img.save(dst, "PNG")
    print(f"Saved {dst.name}: {img.size}")


def main():
    for src_name, dst_name in FILES:
        src = INPUT_DIR / src_name
        dst = OUTPUT_DIR / dst_name
        if not src.exists():
            print(f"Missing {src}")
            continue
        process(src, dst)


if __name__ == "__main__":
    main()
