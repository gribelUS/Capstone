import os
import shutil
import random

# Configuration
SOURCE_DIR = r'Datasets/sifted_ua_detrac'
FINAL_DIR = r'Datasets/traffic_final'

# The 40 official Test Sequences from UA-DETRAC
# (We use the prefix to identify them)
TEST_IDS = [
    'MVI_39031', 'MVI_39051', 'MVI_39211', 'MVI_39271', 'MVI_39311', 
    'MVI_39361', 'MVI_39371', 'MVI_39401', 'MVI_39501', 'MVI_39511', 
    'MVI_40701', 'MVI_40711', 'MVI_40712', 'MVI_40714', 'MVI_40742', 
    'MVI_40743', 'MVI_40761', 'MVI_40762', 'MVI_40763', 'MVI_40771', 
    'MVI_40772', 'MVI_40773', 'MVI_40774', 'MVI_40775', 'MVI_40792', 
    'MVI_40793', 'MVI_40851', 'MVI_40852', 'MVI_40853', 'MVI_40854', 
    'MVI_40855', 'MVI_40863', 'MVI_40864', 'MVI_40891', 'MVI_40892', 
    'MVI_40901', 'MVI_40902', 'MVI_40903', 'MVI_40904', 'MVI_40905'
]

def setup_dirs():
    for split in ['train', 'val', 'test']:
        os.makedirs(os.path.join(FINAL_DIR, 'images', split), exist_ok=True)
        os.makedirs(os.path.join(FINAL_DIR, 'labels', split), exist_ok=True)

def split_data():
    setup_dirs()
    
    all_images = [f for f in os.listdir(os.path.join(SOURCE_DIR, 'images')) if f.endswith('.jpg')]
    
    # Identify which sequences are training sequences
    all_seqs = list(set([f.split('_img')[0] for f in all_images]))
    train_val_seqs = [s for s in all_seqs if s not in TEST_IDS]
    
    # Split the 60 training sequences into Train (50) and Val (10)
    random.shuffle(train_val_seqs)
    val_cutoff = int(len(train_val_seqs) * 0.15) # 15% for validation
    val_seqs = train_val_seqs[:val_cutoff]
    train_seqs = train_val_seqs[val_cutoff:]

    print(f"Assigning {len(train_seqs)} seqs to Train, {len(val_seqs)} to Val, and {len(TEST_IDS)} to Test...")

    for img_name in all_images:
        seq_id = img_name.split('_img')[0]
        label_name = img_name.replace('.jpg', '.txt')
        
        # Determine destination
        if seq_id in TEST_IDS:
            split = 'test'
        elif seq_id in val_seqs:
            split = 'val'
        else:
            split = 'train'
            
        # Copy Image
        shutil.copy2(os.path.join(SOURCE_DIR, 'images', img_name), 
                     os.path.join(FINAL_DIR, 'images', split, img_name))
        # Copy Label
        shutil.copy2(os.path.join(SOURCE_DIR, 'labels', label_name), 
                     os.path.join(FINAL_DIR, 'labels', split, label_name))

    print(f"Successfully moved files to {FINAL_DIR}")

if __name__ == "__main__":
    split_data()