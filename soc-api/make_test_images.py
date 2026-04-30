from PIL import Image
import struct
import random
import os

BOSS_DIR = "C:/Users/AYESHA/Downloads/stegnar-tbp/stegnar-tbp/test_images/BOSSbase_1.01"
OUT_DIR  = "C:/Users/AYESHA/Downloads"

def pgm_to_png(pgm_path, png_path):
    img = Image.open(pgm_path).convert("RGB")
    img.save(png_path)
    print(f"Converted: {pgm_path} -> {png_path}")
    return img

def embed_lsb_payload(img, message="STEGNAR_TEST_PAYLOAD_SECRET_DATA_EXFILTRATION"):
    """Embed a hidden text message into image LSBs — this is what CALPA detects."""
    pixels = list(img.getdata())
    binary = ''.join(format(ord(c), '08b') for c in message)
    binary += '00000000'  # null terminator

    if len(binary) > len(pixels) * 3:
        raise ValueError("Message too long for image")

    new_pixels = []
    bit_idx = 0
    for px in pixels:
        r, g, b = px[0], px[1], px[2]
        if bit_idx < len(binary):
            r = (r & 0xFE) | int(binary[bit_idx]); bit_idx += 1
        if bit_idx < len(binary):
            g = (g & 0xFE) | int(binary[bit_idx]); bit_idx += 1
        if bit_idx < len(binary):
            b = (b & 0xFE) | int(binary[bit_idx]); bit_idx += 1
        new_pixels.append((r, g, b))

    stego_img = Image.new("RGB", img.size)
    stego_img.putdata(new_pixels)
    return stego_img

def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # Use image 1.pgm as cover (clean image)
    cover_pgm = os.path.join(BOSS_DIR, "1.pgm")
    cover_png = os.path.join(OUT_DIR, "test_cover.png")
    cover_img = pgm_to_png(cover_pgm, cover_png)
    print(f"✅ Clean image saved: {cover_png}")

    # Use image 2.pgm and embed a hidden message to create stego
    stego_pgm  = os.path.join(BOSS_DIR, "2.pgm")
    stego_path = os.path.join(OUT_DIR, "test_stego.png")

    base_img   = Image.open(stego_pgm).convert("RGB")
    stego_img  = embed_lsb_payload(base_img,
        "CLASSIFIED:EXFIL:TARGET_IP:93.184.216.34:PAYLOAD:AES256:KEY:xK9mP2qR7nL4wE8v")
    stego_img.save(stego_path)
    print(f"✅ Stego image saved: {stego_path}")

    print()
    print("=" * 60)
    print("TEST IMAGES READY:")
    print(f"  Clean:  {cover_png}")
    print(f"         → Upload this → expect: NO HIDDEN DATA FOUND")
    print(f"  Stego:  {stego_path}")
    print(f"         → Upload this → expect: STEGANOGRAPHY DETECTED")
    print("=" * 60)
    print()
    print("NOTE: CALPA is a trained neural network. Results depend on")
    print("whether CALPA was trained to detect LSB-type steganography.")
    print("If CALPA shows CLEAN for both, try uploading a BOSSbase")
    print("stego image directly (the dataset contains pre-embedded stego).")

if __name__ == "__main__":
    main()