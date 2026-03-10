import os
import yaml
from pathlib import Path
from ultralytics import YOLO

# 1. Setup DYNAMIC Paths
model = YOLO("yolo11n.pt")

# This finds the directory where the script is currently running
script_dir = Path(__file__).parent.resolve()

# Build the path relative to the script's location
benchmark_dir = script_dir / "Datasets" / "Platinum-Benchmark"
yaml_path = benchmark_dir / "platinum-benchmark.yaml"
label_dir = benchmark_dir / 'labels'

# --- THE PATH SURGEON ---
# This fixes the 'opt/homebrew/datasets' error by updating the YAML to the current machine's path
print(f"🛠️  Syncing YAML path to: {benchmark_dir}")
with open(yaml_path, 'r') as f:
    config = yaml.safe_load(f)

# Update the 'path' key to the absolute path of the benchmark folder
config['path'] = str(benchmark_dir)

with open(yaml_path, 'w') as f:
    yaml.dump(config, f)

# Purge the old cache to force YOLO to see the new paths
cache_file = benchmark_dir / "labels.cache"
if cache_file.exists():
    cache_file.unlink()
# ------------------------------

# 2. THE "DATA SURGEON" LOGIC
print("Aligning labels to Stock COCO 'Car' (ID 2)...")
for label_file in label_dir.glob('*.txt'):
    with open(label_file, 'r') as f:
        lines = f.readlines()
    
    new_lines = []
    for line in lines:
        parts = line.strip().split()
        if parts:
            parts[0] = '2' # Match Stock COCO Car ID
            new_lines.append(" ".join(parts) + "\n")
            
    with open(label_file, 'w') as f:
        f.writelines(new_lines)

# 3. Run Validation
results = model.val(
    data=str(yaml_path),
    classes=[2], 
    imgsz=640,
    device='mps', # Use your M2 GPU for speed
    plots=False,
    save_json=False,
    verbose=False
)

# 4. Extract Metrics
precision = results.results_dict.get('metrics/precision(B)', 0)
recall = results.results_dict.get('metrics/recall(B)', 0)
f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0

print("\n" + "-"*45)
print("PLATINUM BENCHMARK: STOCK YOLOv11n")
print("-"*45)
print(f"  PRECISION: {precision:.4f} ({precision:.1%})")
print(f"  RECALL:    {recall:.4f} ({recall:.1%})")
print(f"  F1-SCORE:  {f1_score:.4f}")
print("-"*45 + "\n")
