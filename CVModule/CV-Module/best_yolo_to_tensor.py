from ultralytics import YOLO

# Load your 2-class best weights
model = YOLO(r'runs\detect\runs\detect\yolo11n_training_2class\weights\best.pt')

# Export to TensorRT
# format='engine' is the TensorRT trigger
# half=True enables FP16 optimization
path = model.export(format='engine', device=0, half=True)

print(f"TensorRT export complete! File saved at: {path}")