import os
import shutil
from tqdm import tqdm

# Configuration
SOURCE_IMG_DIR = r'Datasets/UA-DETRAC/images'
SOURCE_LBL_DIR = r'Datasets/UA-DETRAC/labels'
SIFTED_DIR = r'Datasets/sifted_ua_detrac'

# Sifting rate: Take every Nth frame
N = 20 

def sift_data():
    if not os.path.exists(SIFTED_DIR):
        os.makedirs(os.path.join(SIFTED_DIR, 'images'))
        os.makedirs(os.path.join(SIFTED_DIR, 'labels'))

    # Get all sequence folders (MVI_XXXXX)
    sequences = [d for d in os.listdir(SOURCE_IMG_DIR) if os.path.isdir(os.path.join(SOURCE_IMG_DIR, d))]
    
    print(f"Sifting {len(sequences)} sequences (Every {N}th frame)...")
    
    total_copied = 0

    for seq in tqdm(sequences):
        img_seq_path = os.path.join(SOURCE_IMG_DIR, seq)
        lbl_seq_path = os.path.join(SOURCE_LBL_DIR, seq)
        
        # Ensure we have labels for this sequence
        if not os.path.exists(lbl_seq_path):
            continue

        # Get all image files in the sequence
        images = sorted([f for f in os.listdir(img_seq_path) if f.endswith('.jpg')])
        
        for i, img_name in enumerate(images):
            if i % N == 0:
                # Construct file names
                base_name = os.path.splitext(img_name)[0]
                label_name = base_name + '.txt'
                
                src_img = os.path.join(img_seq_path, img_name)
                src_lbl = os.path.join(lbl_seq_path, label_name)
                
                # New unique filename to prevent overwrites (e.g., MVI_20011_img00001.jpg)
                unique_name = f"{seq}_{img_name}"
                unique_lbl = f"{seq}_{label_name}"
                
                dst_img = os.path.join(SIFTED_DIR, 'images', unique_name)
                dst_lbl = os.path.join(SIFTED_DIR, 'labels', unique_lbl)
                
                # Copy files if the label exists
                if os.path.exists(src_lbl):
                    shutil.copy2(src_img, dst_img)
                    shutil.copy2(src_lbl, dst_lbl)
                    total_copied += 1

    print(f"\nSifting complete! {total_copied} key-frames moved to {SIFTED_DIR}")

if __name__ == "__main__":
    sift_data()