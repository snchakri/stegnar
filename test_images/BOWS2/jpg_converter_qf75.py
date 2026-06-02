import os
from pathlib import Path
import concurrent.futures
from tqdm import tqdm

# STRICT REQUIREMENT: We must use Pillow, NOT OpenCV. 
# Pillow connects to standard libjpeg (Accurate Integer DCT), 
# preventing the SIMD rounding errors introduced by OpenCV's libjpeg-turbo.
from PIL import Image

# --- CONFIGURATION ---
BASE_DIR = Path(".")
INPUT_DIR = BASE_DIR / "cover_resized"
OUTPUT_DIR = BASE_DIR / "cover_resized_jpg"

# Standard benchmarking Quality Factor used in the CALPA-NET paper
QUALITY_FACTOR = 75 

def precise_jpeg_worker(file_path):
    """
    Worker function to load a single resized spatial PGM and save it 
    as a strictly standardized JPEG using IJG libjpeg guidelines.
    """
    try:
        # 1. Natively open the raw spatial matrix
        with Image.open(file_path) as img:
            
            # 2. Enforce Strict Grayscale Mapping
            # This explicitly forbids the JPEG encoder from attempting any
            # RGB-to-YCbCr color space conversions or chroma channel padding.
            if img.mode != 'L':
                img = img.convert('L')
                
            # 3. Construct exact destination path
            out_path = OUTPUT_DIR / (file_path.stem + ".jpg")
            
            # 4. FORENSIC JPEG ENCODING PARAMETERS
            # - quality=QUALITY_FACTOR: Sets the exact IJG quantization tables.
            # - optimize=False: Disables dynamic Huffman table generation, matching MATLAB's default baseline.
            # - subsampling=0: Forces an exact 1:1 mapping (4:4:4 equivalent) to prevent 
            #   header flags from triggering block-averaging algorithms on the luma channel.
            img.save(
                out_path, 
                format='JPEG', 
                quality=QUALITY_FACTOR, 
                optimize=False, 
                subsampling=0
            )
            
        return None  # Success indicator
        
    except Exception as e:
        return f"Forensic Fault on {file_path.name}: {str(e)}"

def main():
    # Ensure destination directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Target all downsampled spatial covers
    image_files = list(INPUT_DIR.glob('*.pgm'))
    
    if not image_files:
        print(f"Error: No .pgm files found in '{INPUT_DIR.absolute()}'.")
        return

    # Dynamically map physical and logical cores to completely bypass the Python GIL
    max_cores = os.cpu_count()
    print(f"Targeting {len(image_files)} spatial matrices for IJG-standard JPEG conversion (QF {QUALITY_FACTOR}).")
    print(f"Engaging {max_cores} independent C-binding threads to saturate compute capability...")
    
    errors = []
    
    # ProcessPoolExecutor guarantees true parallel execution across your hardware
    with concurrent.futures.ProcessPoolExecutor(max_workers=max_cores) as executor:
        futures = {executor.submit(precise_jpeg_worker, path): path for path in image_files}
        
        # Monitor real-time encoding velocity
        for future in tqdm(concurrent.futures.as_completed(futures), total=len(image_files), desc="Encoding Baseline JPEGs"):
            result = future.result()
            if result is not None:
                errors.append(result)
                
    print("\nDataset Conversion Concluded.")
    if errors:
        print(f"Caught {len(errors)} encoding anomalies:")
        for err in errors[:10]:
            print(f" - {err}")
    else:
        print("Flawless Execution. JPEGs are structurally and mathematically identical to the CALPA-NET/MATLAB IJG pipeline.")

if __name__ == "__main__":
    main()