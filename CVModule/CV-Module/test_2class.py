from ultralytics import YOLO

if __name__ == '__main__':
    # 1. Load the "Golden Weights"
    model_path = r'runs\detect\runs\detect\yolo11n_training_2class\weights\best.pt'
    model = YOLO(model_path)

    # 2. Run validation on the TEST split
    # We set conf=0.25 to match the industry standard benchmark you mentioned
    results = model.val(
        data='data_2class.yaml', 
        split='test', 
        imgsz=640, 
        device=0,
        conf=0.44  
    )

    # 3. Extract and Format Metrics
    stats = results.results_dict
    precision = stats['metrics/precision(B)'] * 100
    recall = stats['metrics/recall(B)'] * 100
    mAP50 = stats['metrics/mAP50(B)'] * 100
    mAP50_95 = stats['metrics/mAP50-95(B)'] * 100

    print("\n" + "="*45)
    print(f"{'EVANSDALE 2050 - FINAL TEST RESULTS':^45}")
    print("="*45)
    print(f"Precision (P):    {precision:>10.2f}%")
    print(f"Recall (R):       {recall:>10.2f}%")
    print(f"mAP@50:           {mAP50:>10.2f}%")
    print(f"mAP@50-95:        {mAP50_95:>10.2f}%")
    print("="*45)