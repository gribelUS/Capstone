import os
import shutil

# --- CONFIGURATION ---
# Point these to where you downloaded UA-DETRAC
raw_data_dir = './datasets/UA-DETRAC' 
# This is where your new "Information-Dense" set will live
output_base = './datasets/sifted_ua_detrac'

def build_replicated_set(interval=20):
    img_out = os.path.join(output_base, 'images')
    lbl_out = os.path.join(output_base, 'labels')
    
    # This creates the 'datasets/sifted_ua_detrac/images' and '/labels' folders
    os.makedirs(img_out, exist_ok=True)
    os.makedirs(lbl_out, exist_ok=True)

    # Assumes UA-DETRAC is organized by sequence folders (MVI_XXXXX)
    sequences = [d for d in os.listdir(raw_data_dir) if os.path.isdir(os.path.join(raw_data_dir, d))]
    
    total_kept = 0
    for seq in sequences:
        seq_path = os.path.join(raw_data_dir, seq)
        # Replicating the 1-in-20 "Key Frame" strategy to boost Recall
        frames = sorted([f for f in os.listdir(seq_path) if f.endswith('.jpg')])
        
        for i in range(0, len(frames), interval):
            img_name = frames[i]
            lbl_name = img_name.replace('.jpg', '.txt')
            
            # Paths for labels (assuming they match image names)
            src_img = os.path.join(seq_path, img_name)
            src_lbl = os.path.join(raw_data_dir, 'labels', lbl_name) # Adjust based on your label path
            
            if os.path.exists(src_img) and os.path.exists(src_lbl):
                shutil.copy(src_img, os.path.join(img_out, f"{seq}_{img_name}"))
                shutil.copy(src_lbl, os.path.join(lbl_out, f"{seq}_{lbl_name}"))
                total_kept += 1

    print(f"Success! Created {output_base} with {total_kept} unique frames.")

build_replicated_set()