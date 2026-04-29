from PIL import Image
import os

folder = "test_images"
for f in os.listdir(folder):
    if f.endswith(".jpg"):
        try:
            img = Image.open(os.path.join(folder, f))
            print(f"{f}: {img.size}")
        except:
            print(f"{f}: FAILED")
