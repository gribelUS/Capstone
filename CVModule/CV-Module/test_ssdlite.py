import os
import torch
import numpy as np
from torch.utils.data import DataLoader
from torchvision.models.detection import ssdlite320_mobilenet_v3_large
from torchmetrics.detection import MeanAveragePrecision

# Import existing classes/functions from your training script
from train_ssdlite import TrafficSSDDataset, ssd_collate_fn 

def evaluate_test_performance():
    # 1. Setup Device & Model
    device = torch.device('cuda') if torch.cuda.is_available() else torch.device('cpu')
    print(f"Benchmark Hardware: {torch.cuda.get_device_name(0)}")

    # Initialize model with 3 classes (0: Background, 1: Heavy_HOV, 2: Light_Vehicle)
    model = ssdlite320_mobilenet_v3_large(num_classes=3)
    
    # Load the trained weights
    model_path = "ssdlite_traffic_final.pth"
    if not os.path.exists(model_path):
        print(f"Error: {model_path} not found. Ensure the training run completed.")
        return
        
    model.load_state_dict(torch.load(model_path))
    model.to(device)
    model.eval()

    # 2. Setup Test Dataset
    test_ds = TrafficSSDDataset("Datasets/traffic_2class", "val", imgsz=320)
    test_loader = DataLoader(
        test_ds, 
        batch_size=1, 
        shuffle=False, 
        collate_fn=ssd_collate_fn
    )

    # 3. Setup DUAL Metrics (The Fix)
    # metric_main tracks the overall stats and strict 50-95 per-class stats
    metric_main = MeanAveragePrecision(iou_type="bbox", class_metrics=True)
    # metric_50 specifically isolates the 50% IoU threshold to get per-class AP50
    metric_50 = MeanAveragePrecision(iou_type="bbox", class_metrics=True, iou_thresholds=[0.5])
    latencies = []

    # 4. GPU Warmup
    print("Performing CUDA warmup...")
    dummy_input = torch.randn(1, 3, 320, 320).to(device)
    for _ in range(20):
        _ = model(dummy_input)

    print(f"Evaluating {len(test_ds)} test images (this will take a few minutes)...")

    # 5. Evaluation Loop
    with torch.no_grad():
        for images, targets in test_loader:
            images = [img.to(device) for img in images]
            
            # --- Precision Latency measurement ---
            start_event = torch.cuda.Event(enable_timing=True)
            end_event = torch.cuda.Event(enable_timing=True)
            
            start_event.record()
            outputs = model(images)
            end_event.record()
            
            torch.cuda.synchronize() 
            latencies.append(start_event.elapsed_time(end_event))
            
            # --- Metric Accumulation ---
            res = [{k: v.to('cpu') for k, v in t.items()} for t in outputs]
            tg = [{k: v.to('cpu') for k, v in t.items()} for t in targets]
            
            # Feed data to both trackers
            metric_main.update(res, tg)
            metric_50.update(res, tg)

    # 6. Final Results Calculation
    stats_main = metric_main.compute()
    stats_50 = metric_50.compute()
    avg_latency = np.mean(latencies)
    
    classes = ["Heavy_HOV", "Light_Vehicle"]

    print("\n" + "="*75)
    print("      EVANSDALE INTERSECTION: SSDLite DETAILED PERFORMANCE      ")
    print("="*75)
    print(f"{'Class':<15} | {'Precision (AP50)':<16} | {'Recall':<10} | {'mAP50':<10} | {'mAP50-95':<10}")
    print("-" * 75)
    
    # Extract and format Per-Class Metrics
    for i, class_name in enumerate(classes):
        # Because metric_50 is locked to 0.5 IoU, its 'map_per_class' is exactly AP50
        ap50 = stats_50['map_per_class'][i].item() 
        recall = stats_main['mar_100_per_class'][i].item()
        map50_95 = stats_main['map_per_class'][i].item()
        
        print(f"{class_name:<15} | {ap50*100:>15.1f}% | {recall*100:>9.1f}% | {ap50*100:>9.1f}% | {map50_95*100:>9.1f}%")

    print("-" * 75)
    
    # Extract and format Overall Metrics
    overall_ap50 = stats_main['map_50'].item()
    overall_recall = stats_main['mar_100'].item()
    overall_map50_95 = stats_main['map'].item()
    
    print(f"{'Overall':<15} | {overall_ap50*100:>15.1f}% | {overall_recall*100:>9.1f}% | {overall_ap50*100:>9.1f}% | {overall_map50_95*100:>9.1f}%")
    print("="*75)
    print(f"Inference Latency: {avg_latency:.2f}ms")
    print(f"Throughput:        {1000/avg_latency:.1f} FPS")
    print("="*75)
    print("Evaluation Complete. Data is ready for the Capstone Report.")

if __name__ == "__main__":
    evaluate_test_performance()