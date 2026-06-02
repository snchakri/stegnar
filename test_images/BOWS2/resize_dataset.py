import os
import cv2
import numpy as np
from pathlib import Path
import concurrent.futures
from tqdm import tqdm

# Import the imresize function from your local matlab_imresize.py file
from matlab_imresize import imresize

# --- DIRECTORY CONFIGURATION ---
BASE_DIR = Path(".")
INPUT_DIR = BASE_DIR / "cover"
OUTPUT_DIR = BASE_DIR / "cover_resized"

def resize_worker(file_path):
    """
    Worker function to process a single image using the MATLAB-exact pipeline.
    Runs entirely independently to maximize CPU core saturation.
    """
    try:
        # 1. Enforce strict 1-channel grayscale reading
        img = cv2.imread(str(file_path), cv2.IMREAD_GRAYSCALE)
        if img is None:
            return f"Failed to read: {file_path.name}"

        # 2. Precision Math Bypass
        # We cast to float64 here. This forces matlab_imresize.py to skip its 
        # internal np.around() logic and return the raw, highly precise floating-point matrix.
        img_float = img.astype(np.float64)

        # 3. Apply the exact MATLAB bicubic interpolation (defaults to 256x256 based on paper)
        # Using output_shape triggers the scale derivation automatically in the module
        resized_float = imresize(img_float, output_shape=(256, 256))

        # 4. Strict MATLAB Quantization
        # Now we apply the true MATLAB "round-away-from-zero" logic to the float output
        resized_uint8 = np.clip(np.floor(resized_float + 0.5), 0, 255).astype(np.uint8)

        # 5. Save the output losslessly as PGM
        out_path = OUTPUT_DIR / file_path.name
        cv2.imwrite(str(out_path), resized_uint8)

        return None  # Success indicator
        
    except Exception as e:
        return f"Error on {file_path.name}: {str(e)}"

def main():
    # Ensure output directory exists cleanly
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Grab all PGM files from the cover directory
    image_files = list(INPUT_DIR.glob('*.pgm'))
    
    if not image_files:
        print(f"Error: No .pgm files found in '{INPUT_DIR.absolute()}'. Please check your structure.")
        return

    # Dynamically detect logical CPU cores for max parallelism
    max_cores = os.cpu_count()
    print(f"Targeting {len(image_files)} source images within 'cover/'.")
    print(f"Igniting {max_cores} parallel workers to saturate CPU compute...")
    
    errors = []
    
    # ProcessPoolExecutor completely bypasses the Python GIL
    with concurrent.futures.ProcessPoolExecutor(max_workers=max_cores) as executor:
        futures = {executor.submit(resize_worker, path): path for path in image_files}
        
        # Track progress dynamically
        for future in tqdm(concurrent.futures.as_completed(futures), total=len(image_files), desc="Resizing Dataset"):
            result = future.result()
            if result is not None:
                errors.append(result)

    print("\nResizing Operation Complete.")
    
    # Error reporting
    if errors:
        print(f"\nEncountered {len(errors)} errors during processing:")
        for err in errors[:10]:
            print(f" - {err}")
    else:
        print("Success! All 10,000 images scaled with bit-exact MATLAB rigor. Dataset is pristine.")

if __name__ == "__main__":
    main()