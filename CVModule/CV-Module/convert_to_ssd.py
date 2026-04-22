import os
import cv2

def convert_yolo_to_ssd(base_path):
    # Sets based on your structure: images/train, labels/train, etc.
    sets = ['train', 'val', 'test']
    
    for folder in sets:
        # Corrected paths based on your current setup
        img_dir = os.path.join(base_path, 'images', folder)
        lbl_dir = os.path.join(base_path, 'labels', folder)
        
        # Creating a separate folder for SSD labels so we don't mess up your YOLO labels
        out_dir = os.path.join(base_path, 'labels_ssd', folder)
        os.makedirs(out_dir, exist_ok=True)

        # Safety check: if the images folder doesn't exist, skip it
        if not os.path.exists(img_dir):
            print(f"Skipping {folder}: {img_dir} not found.")
            continue

        print(f"Processing {folder} set...")

        for filename in os.listdir(img_dir):
            if not filename.endswith('.jpg'): continue
            
            # 1. Get image dimensions (YOLO is normalized, SSD needs pixels)
            img_path = os.path.join(img_dir, filename)
            img = cv2.imread(img_path)
            if img is None: continue
            h, w, _ = img.shape
            
            # 2. Match image to label file
            label_file = filename.replace('.jpg', '.txt')
            label_path = os.path.join(lbl_dir, label_file)
            out_path = os.path.join(out_dir, label_file)

            if os.path.exists(label_path):
                with open(label_path, 'r') as f, open(out_path, 'w') as out:
                    for line in f.readlines():
                        # Parse YOLO format
                        cls, x, y, bw, bh = map(float, line.split())
                        
                        # 3. Conversion Math
                        # YOLO (xc, yc, w, h) -> SSD (xmin, ymin, xmax, ymax)
                        xmin = (x - bw/2) * w
                        xmax = (x + bw/2) * w
                        ymin = (y - bh/2) * h
                        ymax = (y + bh/2) * h
                        
                        # 4. SSD Class Shift (0 is background, so 0->1, 1->2)
                        ssd_cls = int(cls) + 1
                        out.write(f"{ssd_cls} {xmin:.2f} {ymin:.2f} {xmax:.2f} {ymax:.2f}\n")

    print("\nConversion Complete!")
    print(f"Check: {os.path.join(base_path, 'labels_ssd')} for your new labels.")

if __name__ == "__main__":
    # Pointing to the root of your traffic_2class data
    convert_yolo_to_ssd("Datasets/traffic_2class")