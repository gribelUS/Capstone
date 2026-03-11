import os
import xml.etree.ElementTree as ET
from pathlib import Path
import cv2

# 1. Setup Paths
base_path = Path(r"C:\Users\jpa00011\Capstone\CVModule\CV-Module\Datasets\UA-DETRAC")
xml_dir = base_path / "DETRAC-Train-Annotations-XML"
img_dir = base_path / "DETRAC-Images"
label_dir = base_path / "labels"
label_dir.mkdir(exist_ok=True)

print("🚀 Hunting for XMLs recursively...")

# 2. Find ALL XML files
xml_files = list(xml_dir.rglob("*.xml"))
print(f"📂 Found {len(xml_files)} sequence files.")

if len(xml_files) == 0:
    print("❌ Error: No XML files found. Check if the folder names match exactly.")
    exit()

# 3. Convert each XML sequence
for xml_file in xml_files:
    tree = ET.parse(xml_file)
    root = tree.getroot()
    sequence_name = xml_file.stem
    
    for frame in root.findall('frame'):
        frame_num = frame.get('num').zfill(5)
        # Sequence format: MVI_20011_img00001.txt
        yolo_file = label_dir / f"{sequence_name}_img{frame_num}.txt"
        
        with open(yolo_file, 'w') as f:
            for target in frame.find('target_list').findall('target'):
                box = target.find('box')
                # DETRAC XMLs use: left, top, width, height
                l = float(box.get('left'))
                t = float(box.get('top'))
                w = float(box.get('width'))
                h = float(box.get('height'))
                
                # Normalization (DETRAC images are typically 960x540)
                cx, cy = (l + w/2) / 960, (t + h/2) / 540
                nw, nh = w / 960, h / 540
                
                # YOLO format: class x_center y_center width height
                f.write(f"0 {max(0, min(1, cx)):.6f} {max(0, min(1, cy)):.6f} {max(0, min(1, nw)):.6f} {max(0, min(1, nh)):.6f}\n")

print(f"✅ Success! Check {label_dir} now—it should be full of .txt files.")