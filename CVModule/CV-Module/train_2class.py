from ultralytics import YOLO

if __name__ == '__main__':
    # Load the pre-trained weights
    model = YOLO('yolo11n.pt')

    # Start the training for Iteration 3 (2-Class Model)
    model.train(
        data='data_2class.yaml',      # Updated for the 2-class refactor
        epochs=100, 
        imgsz=640, 
        device=0, 
        batch=64,                     # Bumping this for the 4080 SUPER
        workers=8,                    # Keeping your manual worker count
        project='runs/detect',
        name='yolo11n_training_2class', # New name to stay organized
        exist_ok=True                 # Safety flag
    )