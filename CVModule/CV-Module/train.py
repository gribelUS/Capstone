from ultralytics import YOLO


if __name__ == '__main__':
    # Load the pre-trained weights
    model = YOLO('yolo11n.pt')

    # Start the training
    model.train(
        data='data.yaml', 
        epochs=100, 
        imgsz=640, 
        device=0, 
        batch=32, 
        workers=8,
        project='runs/detect',
        name='yolo11n_training_v1'
    )