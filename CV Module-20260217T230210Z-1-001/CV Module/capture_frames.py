import cv2
import os

# --- Configuration ---
video_path = "firstfootagewvdot.mp4"
output_folder = "ValidationImages"
num_frames_to_capture = 50

# Create the output folder if it doesn't exist
os.makedirs(output_folder, exist_ok=True)

# Open the video
cap = cv2.VideoCapture(video_path)

if not cap.isOpened():
    print(f"Error: Could not open video file {video_path}")
    exit()

# Get total frame count to calculate spacing
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
frame_interval = total_frames // num_frames_to_capture

print(f"Video has {total_frames} frames.")
print(f"Capturing 1 frame every {frame_interval} frames to get {num_frames_to_capture} total.")

count = 0
saved_count = 0

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        break

    # Save frame if it matches the interval
    if count % frame_interval == 0 and saved_count < num_frames_to_capture:
        # Construct a clean filename (e.g., frame_001.jpg)
        filename = f"frame_{saved_count:03d}.jpg"
        filepath = os.path.join(output_folder, filename)
        
        cv2.imwrite(filepath, frame)
        print(f"Saved: {filename}")
        saved_count += 1

    count += 1

cap.release()
print(f"Done! Check the '{output_folder}' folder.")