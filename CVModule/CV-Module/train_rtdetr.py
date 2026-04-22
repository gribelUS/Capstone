from ultralytics import RTDETR
import torch

def train_traffic_rtdetr():
    # 1. Hardware Check
    device = 0 if torch.cuda.is_available() else 'cpu'
    print(f"Hardware Check: {torch.cuda.get_device_name(0)}")

    # 2. Load the latest RT-DETR (v2 is the 2026 default for this string)
    model = RTDETR('rtdetr-l.pt') 

    # 3. Fine-tuning Config
    model.train(
        data='data_2class.yaml',      # Your existing dataset config
        epochs=100,                   # Aligned with YOLO11 and SSD baseline
        imgsz=640,                    # Native resolution
        batch=16,                     # VRAM-safe batch size
        workers=8,                    # Leveraging your CPU threads
        device=device,
        optimizer='AdamW',            # Critical for Transformer stability
        lr0=0.0001,                   # Transformers prefer lower LR
        cos_lr=True,                  # Smooth cosine annealing
        project='runs/rtdetr',
        name='rtdetr_final',
        plots=True,
        save=True
    )

    print("\nTraining Complete.")
    print("Transformer weights saved to: runs/rtdetr/rtdetr_final/weights/best.pt")

if __name__ == "__main__":
    train_traffic_rtdetr()