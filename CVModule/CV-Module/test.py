from ultralytics import YOLO

if __name__ == '__main__':
    # 1. Load your best weights
    model = YOLO(r'runs\detect\runs\detect\yolo11n_training_v1\weights\best.pt')

    # 2. Run the full validation function with all your flags
    results = model.val(
        data='data.yaml', 
        split='test',      # Crucial: uses the test set, not validation set
        imgsz=640,         # Keeps resolution consistent with training
        device=0,          # Forces the 4080 SUPER to do the work
        save_json=True,    # Saves coco_predictions.json for your final report
        plots=True         # Generates the test-specific confusion matrix
    )

    # 3. Extract the exact metrics you asked for
    # These are pulled directly from the results object
    p = results.box.mp         # Mean Precision
    r = results.box.mr         # Mean Recall
    map50 = results.box.map50  # mAP at 0.5 IoU
    map95 = results.box.map    # mAP at 0.5:0.95 IoU

    # 4. The Senior Design Printout
    print("\n" + "═"*50)
    print("      FINAL BENCHMARK: EVANSDALE 2050      ")
    print("═"*50)
    print(f"Mean Precision (P):   {p:.4f}")
    print(f"Mean Recall (R):      {r:.4f}")
    print(f"mAP @ 0.5:            {map50:.4f}")
    print(f"mAP @ 0.5-0.95:       {map95:.4f}")
    print("─"*50)
    print(f"Inference Latency:    {results.speed['inference']:.2f}ms")
    print("═"*50)