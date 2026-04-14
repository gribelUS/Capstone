import os
import shutil
from pathlib import Path

# 1. SETUP PATHS
# Point to your original data
original_path = Path(r'Datasets\traffic_final')
# Point to where you want the new 2-class dataset to live
new_dataset_path = Path(r'Datasets\traffic_2class')

# 2. CREATE THE BACKUP/COPY
if not new_dataset_path.exists():
    print(f"Creating backup at {new_dataset_path}...")
    shutil.copytree(original_path, new_dataset_path)
else:
    print(f"Dataset at {new_dataset_path} already exists. Skipping copy.")

# 3. DEFINE THE NEW MAPPING
# 0:car, 1:bus, 2:van, 3:truck
# Logic: Car/Van/Truck -> 0 (Light), Bus -> 1 (Heavy)
mapping = {
    '0': '0',  # Car -> Light
    '2': '0',  # Van -> Light
    '3': '0',  # Truck -> Light
    '1': '1'   # Bus -> Heavy
}

def refactor_labels(split):
    label_dir = new_dataset_path / 'labels' / split
    label_files = list(label_dir.glob('*.txt'))
    print(f"Refactoring {len(label_files)} files in {split}...")
    
    for file_path in label_files:
        with open(file_path, 'r') as f:
            lines = f.readlines()
        
        new_lines = []
        for line in lines:
            parts = line.split()
            if parts:
                # Update the Class ID (the first number)
                parts[0] = mapping.get(parts[0], parts[0])
                new_lines.append(" ".join(parts) + "\n")
        
        with open(file_path, 'w') as f:
            f.writelines(new_lines)

# 4. EXECUTE
for split in ['train', 'val', 'test']:
    refactor_labels(split)

print("\nSuccess! You now have a 2-class dataset in 'Datasets/traffic_2class'.")
print("Don't forget to create a new 'data_2class.yaml' pointing to this folder!")