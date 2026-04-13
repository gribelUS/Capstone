import xml.etree.ElementTree as ET
import os
from tqdm import tqdm

# Configuration
XML_DIR = r'Datasets/UA-DETRAC/Annotations'
IMG_DIR = r'Datasets/UA-DETRAC/images'
OUT_DIR = r'Datasets/UA-DETRAC/labels'

# UA-DETRAC Native Resolution
IMG_W = 960
IMG_H = 540

# Class Mapping: Adjust these IDs to match your data.yaml
# We are prioritizing Bus (1) and Truck (3) for your recall fix
CLASS_MAP = {
    'car': 0,
    'bus': 1,
    'van': 2,
    'truck': 3
}

def convert_box(left, top, width, height):
    """Converts UA-DETRAC (left, top, w, h) to YOLO (x_center, y_center, w, h) normalized."""
    dw = 1. / IMG_W
    dh = 1. / IMG_H
    x = (left + width / 2.0) * dw
    y = (top + height / 2.0) * dh
    w = width * dw
    h = height * dh
    return (x, y, w, h)

def process_xml(xml_path):
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    # The sequence name (e.g., MVI_20011)
    seq_name = root.get('name')
    seq_label_dir = os.path.join(OUT_DIR, seq_name)
    os.makedirs(seq_label_dir, exist_ok=True)

    # Iterate through each frame in the XML
    for frame in root.findall('frame'):
        frame_num = frame.get('num').zfill(5) # img00001 format
        label_file = os.path.join(seq_label_dir, f"img{frame_num}.txt")
        
        with open(label_file, 'w') as f:
            target_list = frame.find('target_list')
            if target_list is not None:
                for target in target_list.findall('target'):
                    # Get Bounding Box
                    box = target.find('box')
                    left = float(box.get('left'))
                    top = float(box.get('top'))
                    width = float(box.get('width'))
                    height = float(box.get('height'))
                    
                    # Get Vehicle Type
                    v_attr = target.find('attribute')
                    v_type = v_attr.get('vehicle_type')
                    
                    if v_type in CLASS_MAP:
                        class_id = CLASS_MAP[v_type]
                        yolo_box = convert_box(left, top, width, height)
                        f.write(f"{class_id} {' '.join([f'{a:.6f}' for a in yolo_box])}\n")

if __name__ == "__main__":
    if not os.path.exists(OUT_DIR):
        os.makedirs(OUT_DIR)
        
    xml_files = [f for f in os.listdir(XML_DIR) if f.endswith('.xml')]
    print(f"Found {len(xml_files)} XML sequences. Starting conversion...")
    
    for xml_file in tqdm(xml_files):
        process_xml(os.path.join(XML_DIR, xml_file))
        
    print(f"\nSuccess! YOLO labels generated in: {OUT_DIR}")