import os
import torch
import cv2
import numpy as np
from torch.utils.data import Dataset, DataLoader
from torchvision.models.detection import ssdlite320_mobilenet_v3_large

# --- STEP 1: TOP-LEVEL FUNCTIONS ---
def ssd_collate_fn(batch):
    return tuple(zip(*batch))

# --- STEP 2: DATA BRIDGE ---
class TrafficSSDDataset(Dataset):
    def __init__(self, root, split, imgsz=320): 
        self.img_dir = os.path.join(root, 'images', split)
        # THE FIX: Pointing to the correct YOLO label directory
        self.lbl_dir = os.path.join(root, 'labels', split) 
        self.imgsz = imgsz
        self.img_files = [f for f in os.listdir(self.img_dir) if f.endswith('.jpg')]

    def __len__(self):
        return len(self.img_files)

    def __getitem__(self, idx):
        img_name = self.img_files[idx]
        img_path = os.path.join(self.img_dir, img_name)
        
        img = cv2.imread(img_path)
        if img is None:
            return torch.zeros((3, self.imgsz, self.imgsz)), {"boxes": torch.zeros((0, 4)), "labels": torch.zeros((0,), dtype=torch.int64)}
            
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, (self.imgsz, self.imgsz)) / 255.0

        lbl_path = os.path.join(self.lbl_dir, img_name.replace('.jpg', '.txt'))
        boxes, labels = [], []
        
        if os.path.exists(lbl_path):
            with open(lbl_path, 'r') as f:
                for line in f:
                    parts = line.strip().split()
                    if len(parts) != 5:
                        continue
                        
                    # YOLO Format: class, x_center, y_center, width, height (normalized 0-1)
                    c, cx, cy, w, h = map(float, parts)
                    
                    # --- STRICT CLASS MAPPING ---
                    # 0 in YOLO -> 1 in SSD (Heavy_HOV)
                    # 1 in YOLO -> 2 in SSD (Light_Vehicle)
                    class_id = int(c)
                    if class_id == 0:
                        ssd_class = 1
                    elif class_id == 1:
                        ssd_class = 2
                    else:
                        continue # Failsafe for unexpected classes
                    
                    # --- YOLO TO PASCAL VOC MATH ---
                    xmin = (cx - (w / 2)) * self.imgsz
                    ymin = (cy - (h / 2)) * self.imgsz
                    xmax = (cx + (w / 2)) * self.imgsz
                    ymax = (cy + (h / 2)) * self.imgsz
                    
                    # --- BOUNDARY CLAMPING ---
                    # Prevents CUDA asserts from boxes bleeding off the 320x320 canvas
                    xmin = max(0.0, xmin)
                    ymin = max(0.0, ymin)
                    xmax = min(float(self.imgsz), xmax)
                    ymax = min(float(self.imgsz), ymax)
                    
                    # Prevent corrupted boxes where min/max overlap
                    if xmax <= xmin or ymax <= ymin:
                        continue
                        
                    boxes.append([xmin, ymin, xmax, ymax])
                    labels.append(ssd_class)

        if len(boxes) == 0:
            target = {
                "boxes": torch.zeros((0, 4), dtype=torch.float32),
                "labels": torch.zeros((0,), dtype=torch.int64)
            }
        else:
            target = {
                "boxes": torch.as_tensor(boxes, dtype=torch.float32),
                "labels": torch.as_tensor(labels, dtype=torch.int64)
            }
        
        img_tensor = torch.as_tensor(img).permute(2, 0, 1).float()
        return img_tensor, target

# --- STEP 3: TRAINING ENGINE ---
def train_ssd():
    device = torch.device('cuda') if torch.cuda.is_available() else torch.device('cpu')
    print(f"Hardware Check: Using {device} ({torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'})")

    # num_classes=3 (0: Background, 1: Heavy_HOV, 2: Light_Vehicle)
    model = ssdlite320_mobilenet_v3_large(num_classes=3, weights_backbone='DEFAULT')
    model.to(device)

    train_ds = TrafficSSDDataset("Datasets/traffic_2class", "train", imgsz=320)
    train_loader = DataLoader(
        train_ds, 
        batch_size=32, 
        shuffle=True, 
        num_workers=4, 
        collate_fn=ssd_collate_fn, 
        pin_memory=True
    )

    optimizer = torch.optim.SGD(model.parameters(), lr=0.005, momentum=0.9, weight_decay=0.0005)

    num_epochs = 50 
    model.train()
    
    print(f"Starting interrupt-safe training for {num_epochs} epochs...")
    
    try:
        for epoch in range(num_epochs):
            epoch_loss = 0
            for i, (images, targets) in enumerate(train_loader):
                images = list(image.to(device) for image in images)
                targets = [{k: v.to(device) for k, v in t.items()} for t in targets]
                
                loss_dict = model(images, targets)
                losses = sum(loss for loss in loss_dict.values())

                optimizer.zero_grad()
                losses.backward()
                optimizer.step()
                epoch_loss += losses.item()

                if i % 20 == 0:
                    print(f"Epoch [{epoch}/{num_epochs}] Iter [{i}/{len(train_loader)}] Loss: {losses.item():.4f}")

            avg_loss = epoch_loss / len(train_loader)
            print(f"--- Epoch {epoch} Average Loss: {avg_loss:.4f} ---")

            if epoch % 10 == 0 and epoch > 0:
                torch.save(model.state_dict(), f"ssdlite_checkpoint_epoch_{epoch}.pth")
                print(f"Checkpoint saved: epoch {epoch}")

    except KeyboardInterrupt:
        print("\n[!] Manual stop detected. Running final save...")
    
    finally:
        torch.save(model.state_dict(), "ssdlite_traffic_final.pth")
        print("Success: Model weights saved to ssdlite_traffic_final.pth")

# --- STEP 4: WINDOWS GUARD ---
if __name__ == "__main__":
    train_ssd()