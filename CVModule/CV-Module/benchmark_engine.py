from ultralytics import YOLO

if __name__ == '__main__':
    # 1. Load the engine
    model_path = r'runs\detect\runs\detect\yolo11n_training_2class\weights\best.engine'
    model = YOLO(model_path)

    # 2. Run val with workers=0 to prevent any child-process spawning on Windows
    results = model.val(
        data='data_2class.yaml', 
        split='test', 
        imgsz=640, 
        device=0,
        workers=0  # Force single-process for stability
    )

    # 3. ALL print statements MUST stay inside this indented block
    print("\n" + "="*45)
    print(f"{'TENSORRT BENCHMARK RESULTS':^45}")
    print("="*45)
    
    inf_speed = results.speed['inference']
    fps = 1000 / inf_speed
    
    print(f"Inference speed:   {inf_speed:.2f} ms per image")
    print(f"Calculated FPS:    {fps:.2f} FPS")
    print("="*45)
    print(f"Test mAP50:        {results.results_dict['metrics/mAP50(B)']*100:.2f}%")
    print(f"Test mAP50-95:     {results.results_dict['metrics/mAP50-95(B)']*100:.2f}%")