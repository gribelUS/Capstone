import os
import shutil
import yaml
from ultralytics import YOLO

def run_stock_baseline_val():
    # --- CONFIGURATION ---
    # Paths relative to your root
    base_dir = r'Datasets\traffic_2class'
    
    # FIX: Point directly to the 'val' split folders
    original_images_dir = os.path.join(base_dir, 'images', 'val')
    original_labels_dir = os.path.join(base_dir, 'labels', 'val')
    
    # New temp directory for stock validation to avoid cache conflicts
    stock_val_dir = r'Datasets\stock_val_temp'
    stock_images_dir = os.path.join(stock_val_dir, 'images')
    stock_labels_dir = os.path.join(stock_val_dir, 'labels')
    
    yaml_path = 'stock_baseline.yaml'

    # 1. Prepare Clean Directory Structure
    if os.path.exists(stock_val_dir):
        shutil.rmtree(stock_val_dir)
    os.makedirs(stock_images_dir)
    os.makedirs(stock_labels_dir)

    print("--- REMAPPING LABELS: Custom(0,1) -> COCO(2,5) ---")
    mapping = {'0': '2', '1': '5'}

    # 2. Remap Labels and "Link" Images
    # We copy the labels and images to a temp folder so YOLO finds them together
    for filename in os.listdir(original_labels_dir):
        if filename.endswith('.txt'):
            # Remap the label
            with open(os.path.join(original_labels_dir, filename), 'r') as f:
                lines = f.readlines()
            
            new_lines = []
            for line in lines:
                parts = line.split()
                if parts[0] in mapping:
                    parts[0] = mapping[parts[0]]
                    new_lines.append(" ".join(parts) + "\n")
            
            with open(os.path.join(stock_labels_dir, filename), 'w') as f:
                f.writelines(new_lines)

    # Note: We just point YOLO to the existing image folder to save space
    print("--- SYNCING VALIDATION IMAGES (This may take a moment) ---")
    for img_file in os.listdir(original_images_dir):
        shutil.copy2(os.path.join(original_images_dir, img_file), os.path.join(stock_images_dir, img_file))

    # 3. Initialize Model and Create YAML
    model = YOLO('yolo11n.pt')
    
    yaml_data = {
        'path': os.path.abspath(stock_val_dir),
        'train': 'images', 
        'val': 'images',
        'test': 'images',
        'nc': 80,
        'names': model.names
    }

    with open(yaml_path, 'w') as f:
        yaml.dump(yaml_data, f)

    print("--- STARTING VALIDATION (VAL SET) ---")

    # 4. Run Validation
    # workers=0 is the key for Windows stability in scripts
    results = model.val(
        data=yaml_path,
        split='val',
        imgsz=640,
        conf=0.25,
        classes=[2, 5], 
        device=0,
        workers=0,  # Prevents the Multiprocessing RuntimeError
        plots=False # Bypasses the Matplotlib FileNotFoundError crash
    )

    # 5. Report Results
    inf_time = results.speed['inference']
    print("\n" + "═"*50)
    print("      STOCK BASELINE (VAL SET): COCO RESULTS      ")
    print("═"*50)
    print(f"Overall mAP @ 0.5:       {results.box.map50:.4f}")
    print(f"Mean Precision (P):      {results.box.mp:.4f}")
    print(f"Mean Recall (R):         {results.box.mr:.4f}")
    print(f"Inference Latency:       {inf_time:.2f}ms")
    print("═"*50)

# The "Guard" that prevents the crash
if __name__ == '__main__':
    run_stock_baseline_val()