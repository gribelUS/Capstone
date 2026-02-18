import json
import socket
import time
import threading
from typing import Optional


class CVInterface:
    def __init__(self, config: dict, host: str = "127.0.0.1", port: int = 5555):
        self.detector_map = config.get("cv_to_detector_map", {})
        self.host = host
        self.port = port
        self.socket: Optional[socket.socket] = None
        self.connected = False
        self.last_data = {}
        self.last_update_time = 0
        self.timeout = 1.0
        self._lock = threading.Lock()

    def connect(self) -> bool:
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(self.timeout)
            self.socket.connect((self.host, self.port))
            self.connected = True
            print(f"[CV] Connected to CV module at {self.host}:{self.port}")
            return True
        except (socket.error, socket.timeout) as e:
            print(f"[CV] Connection failed: {e}. Running in SIMULATION mode.")
            self.connected = False
            return False

    def disconnect(self):
        if self.socket:
            self.socket.close()
            self.socket = None
        self.connected = False

    def request_data(self) -> dict:
        if not self.connected or self.socket is None:
            return self._generate_simulated_data()

        try:
            self.socket.sendall(b"GET_DATA\n")
            response = self.socket.recv(4096).decode("utf-8")
            data = json.loads(response)
            with self._lock:
                self.last_data = self._map_zones_to_detectors(data)
                self.last_update_time = time.time()
            return self.last_data
        except (socket.timeout, socket.error, json.JSONDecodeError) as e:
            print(f"[CV] Error receiving data: {e}. Using cached data.")
            return self.last_data if self.last_data else self._generate_simulated_data()

    def _map_zones_to_detectors(self, zone_data: dict) -> dict:
        result = {}
        for zone_key, detections in zone_data.items():
            zone_num = zone_key.replace("zone_", "")
            detector_id = self.detector_map.get(f"zone_{zone_num}")
            if detector_id:
                result[detector_id] = detections
        return result

    def get_detector_states(self) -> dict:
        if not self.last_data:
            self.request_data()
        return self.last_data

    def get_wait_times(self) -> dict:
        with self._lock:
            result = {}
            for detector_id, data in self.last_data.items():
                if isinstance(data, dict):
                    result[detector_id] = data.get("wait_time", 0.0)
                else:
                    result[detector_id] = 0.0
            return result

    def get_vehicle_counts(self) -> dict:
        with self._lock:
            result = {}
            for detector_id, data in self.last_data.items():
                if isinstance(data, dict):
                    result[detector_id] = data.get("count", 0)
                elif isinstance(data, int):
                    result[detector_id] = data
                else:
                    result[detector_id] = 0
            return result

    def has_demand(self, detector_ids: list) -> bool:
        counts = self.get_vehicle_counts()
        for det_id in detector_ids:
            if counts.get(det_id, 0) > 0:
                return True
        return False

    def get_total_demand(self, detector_ids: list) -> int:
        counts = self.get_vehicle_counts()
        return sum(counts.get(det_id, 0) for det_id in detector_ids)

    def _generate_simulated_data(self) -> dict:
        import random

        detectors = list(self.detector_map.values())
        simulated = {}
        for det_id in detectors:
            count = random.randint(0, 5)
            wait_time = random.uniform(0, 30) if count > 0 else 0.0
            simulated[det_id] = {"count": count, "wait_time": wait_time}
        return simulated


class CVServer:
    def __init__(self, host: str = "127.0.0.1", port: int = 5555):
        self.host = host
        self.port = port
        self.server_socket: Optional[socket.socket] = None
        self.running = False
        self.vehicle_history = {}

    def start(self):
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind((self.host, self.port))
        self.server_socket.listen(1)
        self.running = True
        print(f"[CV Server] Listening on {self.host}:{self.port}")

        while self.running:
            try:
                self.server_socket.settimeout(1.0)
                client_socket, address = self.server_socket.accept()
                threading.Thread(
                    target=self._handle_client, args=(client_socket,)
                ).start()
            except socket.timeout:
                continue
            except OSError:
                break

    def stop(self):
        self.running = False
        if self.server_socket:
            self.server_socket.close()

    def _handle_client(self, client_socket: socket.socket):
        try:
            data = client_socket.recv(1024).decode("utf-8")
            if "GET_DATA" in data:
                response = self._get_current_data()
                client_socket.sendall(json.dumps(response).encode("utf-8"))
        finally:
            client_socket.close()

    def _get_current_data(self) -> dict:
        return {"zone_1": 0, "zone_2": 0}


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="CV Interface Module")
    parser.add_argument("--mode", choices=["client", "server"], default="client")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5555)
    args = parser.parse_args()

    if args.mode == "server":
        server = CVServer(args.host, args.port)
        server.start()
    else:
        config = {"cv_to_detector_map": {"zone_1": "det_N_thru_1"}}
        cv = CVInterface(config, args.host, args.port)
        cv.connect()
        while True:
            data = cv.request_data()
            print(f"Detector states: {data}")
            time.sleep(1)
