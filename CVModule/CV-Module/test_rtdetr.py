from ultralytics import RTDETR

def run_detailed_test():
    # 1. Load your best weights
    model = RTDETR('runs/detect/runs/rtdetr/rtdetr_final/weights/best.pt')

    # 2. Run validation on the test split with 0.25 threshold
    # The 'conf=0.25' filters out the low-probability "ghost boxes"
    results = model.val(data='data_2class.yaml', split='val', imgsz=640, device=0, conf=0.25)

    # 3. Extract Metrics
    names = results.names
    metrics = results.box
    
    print("\n" + "="*65)
    print(f"{'CLASS':<20} | {'P':<8} | {'R':<8} | {'mAP50':<8} | {'mAP50-95':<8}")
    print("-" * 65)

    # 4. Corrected Loop
    # Precision and Recall are arrays: p[i], r[i]
    # mAP50 per class is in: ap50[i]
    # mAP50-95 per class is in: maps[i]
    for i, name in names.items():
        p = metrics.p[i]
        r = metrics.r[i]
        m50 = metrics.ap50[i]
        m95 = metrics.maps[i]
        
        print(f"{name:<20} | {p:.4f} | {r:.4f} | {m50:.4f} | {m95:.4f}")

    print("-" * 65)
    
    # 5. Print Overall Metrics
    print(f"{'OVERALL (Mean)':<20} | {metrics.mp:.4f} | {metrics.mr:.4f} | {metrics.map50:.4f} | {metrics.map:.4f}")
    print("="*65 + "\n")

if __name__ == "__main__":
    run_detailed_test()