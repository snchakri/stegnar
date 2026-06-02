import os
from pathlib import Path
import concurrent.futures
from tqdm import tqdm

# Import Pillow instead of OpenCV for mathematically rigorous libjpeg standard
from PIL import Image

# --- DIRECTORY CONFIGURATION ---
BASE_DIR = Path(".")
INPUT_DIR = BASE_DIR / "cover_resized"

OUTPUT_PNG_DIR = BASE_DIR / "cover_resized_png"
OUTPUT_JPG75_DIR = BASE_DIR / "cover_resized_jpg75"
OUTPUT_JPG95_DIR = BASE_DIR / "cover_resized_jpg95"

def convert_worker(file_path):
    """
    Worker function to load a single resized PGM and save it 
    into PNG, JPEG QF75, and JPEG QF95 formats using standard libjpeg.
    """
    try:
        # 1. Open the image natively
        with Image.open(file_path) as img:
            
            # 2. Enforce strict 8-bit Grayscale Mode ('L' in Pillow)
            # This ensures no 3-channel (RGB) chroma subsampling logic is triggered 
            # by the JPEG encoder, matching MATLAB's grayscale handling.
            if img.mode != 'L':
                img = img.convert('L')
                
            base_name = file_path.stem
            
            # 3. Lossless PNG Export
            # No compression optimization to maintain pristine pixel states
            png_path = OUTPUT_PNG_DIR / f"{base_name}.png"
            img.save(png_path, format='PNG')
            
            # 4. JPEG Quality Factor 75 Export
            # - optimize=False: Mirrors MATLAB (disables dynamic Huffman tables)
            # - subsampling=0: Forces 4:4:4 equivalent (even though it's grayscale) to prevent IJG header flags from shifting
            jpg75_path = OUTPUT_JPG75_DIR / f"{base_name}.jpg"
            img.save(jpg75_path, format='JPEG', quality=75, optimize=False, subsampling=0)
            
            # 5. JPEG Quality Factor 95 Export
            jpg95_path = OUTPUT_JPG95_DIR / f"{base_name}.jpg"
            img.save(jpg95_path, format='JPEG', quality=95, optimize=False, subsampling=0)
            
        return None  # Success
        
    except Exception as e:
        return f"Error processing {file_path.name}: {str(e)}"

def main():
    # Initialize all target subdirectories cleanly
    OUTPUT_PNG_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_JPG75_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_JPG95_DIR.mkdir(parents=True, exist_ok=True)
    
    # Locate all downsampled spatial PGM files
    image_files = list(INPUT_DIR.glob('*.pgm'))
    
    if not image_files:
        print(f"Error: No processed images found in folder '{INPUT_DIR.absolute()}'.")
        print("Please run your resizing script first.")
        return

    # Dynamically detect logical cores for max parallelism
    max_cores = os.cpu_count()
    print(f"Loaded {len(image_files)} source files from '{INPUT_DIR.name}'.")
    print(f"Saturating CPU utilization via {max_cores} parallel Pillow workers...")
    
    errors = []
    
    # Fully bypass the Python GIL by spawning separate OS-level processes
    with concurrent.futures.ProcessPoolExecutor(max_workers=max_cores) as executor:
        futures = {executor.submit(convert_worker, path): path for path in image_files}
        
        # Monitor real-time performance
        for future in tqdm(concurrent.futures.as_completed(futures), total=len(image_files), desc="Precision Formatting"):
            result = future.result()
            if result is not None:
                errors.append(result)
                
    print("\nDataset Conversion Completed.")
    if errors:
        print(f"Encountered {len(errors)} conversion anomalies:")
        for err in errors[:10]:
            print(f" - {err}")
    else:
        print("Success! Your standard target folders are built. JPEGs are structurally identical to MATLAB's IJG pipeline.")

if __name__ == "__main__":
    main()