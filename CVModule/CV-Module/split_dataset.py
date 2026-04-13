import os
import random
import shutil

# --- CONFIG ---
base_path = './datasets/sifted_ua_detrac'
output_path = './datasets/traffic_final'
split_ratio = [0.7, 0.1, 0.2] # Train, Val, Test

def split_data():
    img_dir = os.path.join(base_path, 'images')
    lbl_dir = os.path.join(base_path, 'labels')
    
    files = [f for f in os.listdir(img_dir) if f.endswith('.jpg')]
    random.shuffle(files)

    # Calculate split indices
    train_end = int(len(files) * split_ratio[0])
    val_end = train_end + int(len(files) * split_ratio[1])

    splits = {
        'train': files[:train_end],
        'val': files[train_end:val_end],
        'test': files[val_end:]
    }

    for phase, f_list in splits.items():
        # Create YOLO-standard folders
        os.makedirs(os.path.join(output_path, 'images', phase), exist_ok=True)
        os.makedirs(os.path.join(output_path, 'labels', phase), exist_ok=True)
        
        for f in f_list:
            # Move images
            shutil.copy(os.path.join(img_dir, f), os.path.join(output_path, 'images', phase, f))
            # Move corresponding label
            lbl = f.replace('.jpg', '.txt')
            if os.path.exists(os.path.join(lbl_dir, lbl)):
                shutil.copy(os.path.join(lbl_dir, lbl), os.path.join(output_path, 'labels', phase, lbl))

    print(f"Split complete: {len(splits['train'])} Train, {len(splits['val'])} Val, {len(splits['test'])} Test.")

split_data()