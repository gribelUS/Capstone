from ultralytics import YOLO
import torch

if __name__ == '__main__':
    # 1. Clear the GPU cache just to be safe
    torch.cuda.empty_cache()

    # 2. Load the LAST saved checkpoint (not the best one)
    # This will be in your latest runs folder
    model = YOLO(r'runs\detect\runs\detect\yolo11n_training_2class\weights\last.pt')

    # 3. Resume with a smaller batch size to avoid the OOM spike
    # Setting resume=True ensures it picks up at Epoch 90/100
    model.train(
        resume=True, 
        batch=32, 
        device=0
    )