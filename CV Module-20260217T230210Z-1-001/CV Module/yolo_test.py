import socket
import json
import time
import threading
from collections import defaultdict
from ultralytics import YOLO
import cv2


class YOLOTrafficMonitor:
    def __init__(
        self,
        model_path="yolov8n.pt",
        video_path=None,
        output_host="127.0.0.1",
        output_port=5555,
    ):
        self.model = YOLO(model_path)
        self.video_path = video_path
        self.output_host = output_host
        self.output_port = output_port
        self.server_socket = None
        self.running = False

        self.vehicle_history = defaultdict(list)
        self.current_counts = {f"zone_{i}": 0 for i in range(1, 13)}
        self.wait_times = {f"zone_{i}": 0.0 for i in range(1, 13)}
        self.current_time = time.time()

        self.zone_definitions = {
            "zone_1": {"x_min": 0, "x_max": 160, "y_min": 300, "y_max": 400},
            "zone_2": {"x_min": 160, "x_max": 320, "y_min": 300, "y_max": 400},
            "zone_3": {"x_min": 320, "x_max": 420, "y_min": 280, "y_max": 380},
            "zone_4": {"x_min": 640, "x_max": 800, "y_min": 300, "y_max": 400},
            "zone_5": {"x_min": 800, "x_max": 960, "y_min": 300, "y_max": 400},
            "zone_6": {"x_min": 960, "x_max": 1060, "y_min": 280, "y_max": 380},
            "zone_7": {"x_min": 0, "x_max": 160, "y_min": 100, "y_max": 200},
            "zone_8": {"x_min": 160, "x_max": 320, "y_min": 100, "y_max": 200},
            "zone_9": {"x_min": 320, "x_max": 420, "y_min": 120, "y_max": 220},
            "zone_10": {"x_min": 640, "x_max": 800, "y_min": 100, "y_max": 200},
            "zone_11": {"x_min": 800, "x_max": 960, "y_min": 100, "y_max": 200},
            "zone_12": {"x_min": 960, "x_max": 1060, "y_min": 120, "y_max": 220},
        }

    def start_server(self):
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            self.server_socket.bind((self.output_host, self.output_port))
            self.server_socket.listen(1)
            self.running = True
            print(f"[YOLO Server] Listening on {self.output_host}:{self.output_port}")
        except OSError as e:
            print(f"[YOLO Server] Failed to bind: {e}")
            return

        while self.running:
            try:
                self.server_socket.settimeout(1.0)
                client, addr = self.server_socket.accept()
                threading.Thread(target=self._handle_client, args=(client,)).start()
            except socket.timeout:
                continue
            except OSError:
                break

    def stop_server(self):
        self.running = False
        if self.server_socket:
            self.server_socket.close()

    def _handle_client(self, client_socket):
        try:
            data = client_socket.recv(1024).decode("utf-8")
            if "GET_DATA" in data:
                response = self._get_traffic_data()
                client_socket.sendall(json.dumps(response).encode("utf-8"))
        except Exception as e:
            print(f"[YOLO Server] Error: {e}")
        finally:
            client_socket.close()

    def _get_traffic_data(self) -> dict:
        result = {}
        for zone in range(1, 13):
            zone_key = f"zone_{zone}"
            result[zone_key] = {
                "count": self.current_counts[zone_key],
                "wait_time": self.wait_times[zone_key],
            }
        return result

    def process_video(self, frame_skip=5):
        if not self.video_path:
            print("[YOLO] No video path specified. Use --video")
            return

        cap = cv2.VideoCapture(self.video_path)
        if not cap.isOpened():
            print(f"[YOLO] Error: Could not open video {self.video_path}")
            return

        frame_count = 0
        print(f"[YOLO] Processing video: {self.video_path}")

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1
            if frame_count % frame_skip != 0:
                continue

            h, w = frame.shape[:2]
            self._update_zone_definitions(w, h)

            results = self.model(frame, classes=[2, 3, 5, 7], conf=0.3)

            counts = {f"zone_{i}": 0 for i in range(1, 13)}
            current_time = time.time()

            for box in results[0].boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                center_x = (x1 + x2) / 2
                center_y = (y1 + y2) / 2

                for zone_num in range(1, 13):
                    zone_key = f"zone_{zone_num}"
                    z = self.zone_definitions[zone_key]
                    if (
                        z["x_min"] <= center_x <= z["x_max"]
                        and z["y_min"] <= center_y <= z["y_max"]
                    ):
                        counts[zone_key] += 1
                        vehicle_id = f"{zone_key}_{frame_count}"
                        if vehicle_id not in self.vehicle_history[zone_key]:
                            self.vehicle_history[zone_key].append(
                                {
                                    "id": vehicle_id,
                                    "first_seen": current_time,
                                    "last_seen": current_time,
                                }
                            )

            self._cleanup_history(current_time)

            for zone_key in counts:
                self.current_counts[zone_key] = counts[zone_key]
                if self.vehicle_history[zone_key]:
                    wait_times = [
                        current_time - v["first_seen"]
                        for v in self.vehicle_history[zone_key]
                    ]
                    self.wait_times[zone_key] = (
                        sum(wait_times) / len(wait_times) if wait_times else 0.0
                    )
                else:
                    self.wait_times[zone_key] = 0.0

            annotated = results[0].plot()
            cv2.putText(
                annotated,
                f"Frame: {frame_count}",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 255, 0),
                2,
            )
            cv2.imshow("YOLO Traffic Detection", cv2.resize(annotated, (960, 540)))

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

        cap.release()
        cv2.destroyAllWindows()

    def _update_zone_definitions(self, width, height):
        pass

    def _cleanup_history(self, current_time, max_age=10.0):
        for zone_key in self.vehicle_history:
            self.vehicle_history[zone_key] = [
                v
                for v in self.vehicle_history[zone_key]
                if current_time - v["last_seen"] < max_age
            ]

    def run_dual_mode(self, frame_skip=5):
        server_thread = threading.Thread(target=self.start_server)
        server_thread.daemon = True
        server_thread.start()

        print("[YOLO] Running in dual mode (server + inference)")
        self.process_video(frame_skip)
        self.stop_server()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="YOLO Traffic Monitor")
    parser.add_argument("--model", default="yolov8n.pt", help="Path to YOLO model")
    parser.add_argument("--video", type=str, help="Path to video file")
    parser.add_argument("--host", default="127.0.0.1", help="Output server host")
    parser.add_argument("--port", type=int, default=5555, help="Output server port")
    parser.add_argument(
        "--frame-skip", type=int, default=5, help="Process every N frames"
    )
    parser.add_argument(
        "--server-only", action="store_true", help="Run as server only (no inference)"
    )
    args = parser.parse_args()

    monitor = YOLOTrafficMonitor(args.model, args.video, args.host, args.port)

    if args.server_only:
        monitor.start_server()
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            monitor.stop_server()
    else:
        monitor.run_dual_mode(args.frame_skip)
