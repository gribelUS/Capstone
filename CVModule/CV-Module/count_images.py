import os

# Set your path here
dataset_path = "Datasets/traffic_2class/images"
splits = ["train", "val", "test"]

print("-" * 30)
for split in splits:
    path = os.path.join(dataset_path, split)
    if os.path.exists(path):
        # Counts only files, ignoring directories or hidden files
        count = len([f for f in os.listdir(path) if os.path.isfile(os.path.join(path, f))])
        print(f"{split.upper():<10} | {count} images")
    else:
        print(f"{split.upper():<10} | Folder not found")
print("-" * 30)