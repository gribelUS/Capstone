import socket
import json
import time
import random
import threading
import argparse
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Optional


class TrafficSimulation:
    def __init__(self, config: dict = None):
        self.config = config or {}
        self.detector_map = self.config.get(
            "cv_to_detector_map",
            {
                "zone_1": "det_N_thru_1",
                "zone_2": "det_N_thru_2",
                "zone_3": "det_N_left",
                "zone_4": "det_S_thru_1",
                "zone_5": "det_S_thru_2",
                "zone_6": "det_S_left",
                "zone_7": "det_E_thru_1",
                "zone_8": "det_E_thru_2",
                "zone_9": "det_E_left",
                "zone_10": "det_W_thru_1",
                "zone_11": "det_W_thru_2",
                "zone_12": "det_W_left",
            },
        )

        self.vehicle_tracking = defaultdict(list)
        self.current_time = time.time()

        self.traffic_pattern = "balanced"
        self.simulation_speed = 1.0

        self.arrival_rates = {
            "N_thru": 0.3,
            "S_thru": 0.3,
            "E_thru": 0.3,
            "W_thru": 0.3,
            "N_left": 0.1,
            "S_left": 0.1,
            "E_left": 0.1,
            "W_left": 0.1,
        }

        self.phase_states = {
            "PHASE_1_N_S_THRU": False,
            "PHASE_2_N_S_LEFT": False,
            "PHASE_3_E_W_THRU": False,
            "PHASE_4_E_W_LEFT": False,
        }

    def set_traffic_pattern(self, pattern: str):
        patterns = {
            "balanced": {
                "N_thru": 0.3,
                "S_thru": 0.3,
                "E_thru": 0.3,
                "W_thru": 0.3,
                "N_left": 0.1,
                "S_left": 0.1,
                "E_left": 0.1,
                "W_left": 0.1,
            },
            "morning_rush": {
                "N_thru": 0.8,
                "S_thru": 0.2,
                "E_thru": 0.3,
                "W_thru": 0.3,
                "N_left": 0.3,
                "S_left": 0.05,
                "E_left": 0.1,
                "W_left": 0.1,
            },
            "evening_rush": {
                "N_thru": 0.2,
                "S_thru": 0.8,
                "E_thru": 0.3,
                "W_thru": 0.3,
                "N_left": 0.05,
                "S_left": 0.3,
                "E_left": 0.1,
                "W_left": 0.1,
            },
            "east_west_heavy": {
                "N_thru": 0.1,
                "S_thru": 0.1,
                "E_thru": 0.7,
                "W_thru": 0.7,
                "N_left": 0.05,
                "S_left": 0.05,
                "E_left": 0.3,
                "W_left": 0.3,
            },
            "north_south_heavy": {
                "N_thru": 0.7,
                "S_thru": 0.7,
                "E_thru": 0.1,
                "W_thru": 0.1,
                "N_left": 0.3,
                "S_left": 0.3,
                "E_left": 0.05,
                "W_left": 0.05,
            },
            "light_traffic": {
                "N_thru": 0.1,
                "S_thru": 0.1,
                "E_thru": 0.1,
                "W_thru": 0.1,
                "N_left": 0.02,
                "S_left": 0.02,
                "E_left": 0.02,
                "W_left": 0.02,
            },
            "heavy_traffic": {
                "N_thru": 0.9,
                "S_thru": 0.9,
                "E_thru": 0.9,
                "W_thru": 0.9,
                "N_left": 0.5,
                "S_left": 0.5,
                "E_left": 0.5,
                "W_left": 0.5,
            },
        }
        if pattern in patterns:
            self.traffic_pattern = pattern
            self.arrival_rates = patterns[pattern]
            print(f"[SIM] Traffic pattern set to: {pattern}")

    def set_active_phase(self, phase_name: str, is_green: bool):
        if phase_name in self.phase_states:
            self.phase_states[phase_name] = is_green

    def _get_lanes_for_phase(self, phase_name: str) -> list:
        phase_lane_map = {
            "PHASE_1_N_S_THRU": [
                "det_N_thru_1",
                "det_N_thru_2",
                "det_S_thru_1",
                "det_S_thru_2",
            ],
            "PHASE_2_N_S_LEFT": ["det_N_left", "det_S_left"],
            "PHASE_3_E_W_THRU": [
                "det_E_thru_1",
                "det_E_thru_2",
                "det_W_thru_1",
                "det_W_thru_2",
            ],
            "PHASE_4_E_W_LEFT": ["det_E_left", "det_W_left"],
        }
        return phase_lane_map.get(phase_name, [])

    def _get_approach_from_detector(self, detector_id: str) -> str:
        approach_map = {
            "det_N_thru_1": "N_thru",
            "det_N_thru_2": "N_thru",
            "det_N_left": "N_left",
            "det_S_thru_1": "S_thru",
            "det_S_thru_2": "S_thru",
            "det_S_left": "S_left",
            "det_E_thru_1": "E_thru",
            "det_E_thru_2": "E_thru",
            "det_E_left": "E_left",
            "det_W_thru_1": "W_thru",
            "det_W_thru_2": "W_thru",
            "det_W_left": "W_left",
        }
        return approach_map.get(detector_id, "")

    def _is_lane_green(self, detector_id: str) -> bool:
        for phase, is_green in self.phase_states.items():
            if is_green and detector_id in self._get_lanes_for_phase(phase):
                return True
        return False

    def update(self, dt: float = 1.0):
        current_time = time.time()
        dt = dt * self.simulation_speed

        for detector_id in self.detector_map.values():
            approach = self._get_approach_from_detector(detector_id)
            if not approach:
                continue

            arrival_prob = self.arrival_rates.get(approach, 0.1) * dt
            if random.random() < arrival_prob:
                vehicle_id = f"{detector_id}_{current_time}_{random.random()}"
                self.vehicle_tracking[detector_id].append(
                    {"id": vehicle_id, "arrival_time": current_time, "wait_time": 0.0}
                )

            is_green = self._is_lane_green(detector_id)
            departure_prob = 0.15 if is_green else 0.02
            if random.random() < departure_prob and self.vehicle_tracking[detector_id]:
                self.vehicle_tracking[detector_id].pop(0)

        for detector_id in self.vehicle_tracking:
            for vehicle in self.vehicle_tracking[detector_id]:
                vehicle["wait_time"] = current_time - vehicle["arrival_time"]

        self.current_time = current_time

    def get_detector_data(self) -> dict:
        result = {}
        for zone_key, detector_id in self.detector_map.items():
            vehicles = self.vehicle_tracking.get(detector_id, [])
            count = len(vehicles)
            if vehicles:
                avg_wait = sum(v["wait_time"] for v in vehicles) / count
            else:
                avg_wait = 0.0

            result[detector_id] = {"count": count, "wait_time": round(avg_wait, 1)}

        return result

    def get_zone_data(self) -> dict:
        result = {}
        for zone_key, detector_id in self.detector_map.items():
            vehicles = self.vehicle_tracking.get(detector_id, [])
            count = len(vehicles)
            if vehicles:
                avg_wait = sum(v["wait_time"] for v in vehicles) / count
            else:
                avg_wait = 0.0

            result[zone_key] = {"count": count, "wait_time": round(avg_wait, 1)}

        return result


class SimulationServer:
    def __init__(self, host: str = "127.0.0.1", port: int = 5556, config: dict = None):
        self.host = host
        self.port = port
        self.simulation = TrafficSimulation(config)
        self.server_socket: Optional[socket.socket] = None
        self.running = False
        self.update_thread: Optional[threading.Thread] = None

    def start(self):
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind((self.host, self.port))
        self.server_socket.listen(1)
        self.running = True

        self.update_thread = threading.Thread(target=self._update_loop)
        self.update_thread.daemon = True
        self.update_thread.start()

        print(f"[SIM Server] Listening on {self.host}:{self.port}")
        print(f"[SIM Server] Traffic pattern: {self.simulation.traffic_pattern}")

        while self.running:
            try:
                self.server_socket.settimeout(1.0)
                client, addr = self.server_socket.accept()
                threading.Thread(target=self._handle_client, args=(client,)).start()
            except socket.timeout:
                continue
            except OSError:
                break

    def stop(self):
        self.running = False
        if self.server_socket:
            self.server_socket.close()
        print("[SIM Server] Stopped")

    def set_traffic_pattern(self, pattern: str):
        self.simulation.set_traffic_pattern(pattern)

    def notify_phase_change(self, phase_name: str, is_green: bool):
        self.simulation.set_active_phase(phase_name, is_green)

    def _update_loop(self):
        while self.running:
            self.simulation.update(dt=1.0)
            time.sleep(1.0)

    def _handle_client(self, client_socket: socket.socket):
        try:
            data = client_socket.recv(1024).decode("utf-8")
            if "GET_DATA" in data:
                response = self.simulation.get_zone_data()
                client_socket.sendall(json.dumps(response).encode("utf-8"))
            elif "SET_PATTERN" in data:
                try:
                    pattern = data.split(":")[1].strip()
                    self.simulation.set_traffic_pattern(pattern)
                    client_socket.sendall(
                        json.dumps({"status": "ok", "pattern": pattern}).encode("utf-8")
                    )
                except:
                    client_socket.sendall(
                        json.dumps({"status": "error"}).encode("utf-8")
                    )
            elif "SET_PHASE" in data:
                try:
                    parts = data.split(":")[1].strip().split(",")
                    phase = parts[0]
                    green = parts[1].strip().lower() == "green"
                    self.simulation.set_active_phase(phase, green)
                    client_socket.sendall(json.dumps({"status": "ok"}).encode("utf-8"))
                except:
                    client_socket.sendall(
                        json.dumps({"status": "error"}).encode("utf-8")
                    )
        except Exception as e:
            print(f"[SIM Server] Error: {e}")
        finally:
            client_socket.close()


class SimulationClient:
    def __init__(self, host: str = "127.0.0.1", port: int = 5556):
        self.host = host
        self.port = port
        self.socket: Optional[socket.socket] = None
        self.connected = False

    def connect(self) -> bool:
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(2.0)
            self.socket.connect((self.host, self.port))
            self.connected = True
            print(
                f"[SIM Client] Connected to simulation server at {self.host}:{self.port}"
            )
            return True
        except (socket.error, socket.timeout) as e:
            print(f"[SIM Client] Connection failed: {e}")
            self.connected = False
            return False

    def disconnect(self):
        if self.socket:
            self.socket.close()
            self.socket = None
        self.connected = False

    def request_data(self) -> dict:
        if not self.connected or self.socket is None:
            return {}

        try:
            self.socket.sendall(b"GET_DATA\n")
            response = self.socket.recv(4096).decode("utf-8")
            return json.loads(response)
        except (socket.timeout, socket.error, json.JSONDecodeError) as e:
            print(f"[SIM Client] Error: {e}")
            return {}

    def set_pattern(self, pattern: str) -> bool:
        if not self.connected:
            return False
        try:
            self.socket.sendall(f"SET_PATTERN:{pattern}\n".encode("utf-8"))
            response = self.socket.recv(1024).decode("utf-8")
            return "ok" in response
        except:
            return False

    def notify_phase(self, phase_name: str, is_green: bool) -> bool:
        if not self.connected:
            return False
        try:
            status = "green" if is_green else "red"
            self.socket.sendall(f"SET_PHASE:{phase_name},{status}\n".encode("utf-8"))
            response = self.socket.recv(1024).decode("utf-8")
            return "ok" in response
        except:
            return False


class DirectSimulation:
    def __init__(self, config: dict = None):
        self.simulation = TrafficSimulation(config)
        self.active_phase = None

    def set_active_phase(self, phase_name: str):
        if self.active_phase:
            self.simulation.set_active_phase(self.active_phase, False)
        self.simulation.set_active_phase(phase_name, True)
        self.active_phase = phase_name

    def update(self):
        self.simulation.update(dt=1.0)

    def get_detector_data(self) -> dict:
        return self.simulation.get_detector_data()

    def get_zone_data(self) -> dict:
        return self.simulation.get_zone_data()

    def set_traffic_pattern(self, pattern: str):
        self.simulation.set_traffic_pattern(pattern)

    def has_demand(self, detector_ids: list) -> bool:
        data = self.simulation.get_detector_data()
        for det_id in detector_ids:
            if data.get(det_id, {}).get("count", 0) > 0:
                return True
        return False

    def get_total_demand(self, detector_ids: list) -> int:
        data = self.simulation.get_detector_data()
        return sum(data.get(det_id, {}).get("count", 0) for det_id in detector_ids)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Traffic Simulation Module")
    parser.add_argument(
        "--mode", choices=["server", "client", "direct"], default="server"
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5556)
    parser.add_argument(
        "--pattern",
        default="balanced",
        choices=[
            "balanced",
            "morning_rush",
            "evening_rush",
            "east_west_heavy",
            "north_south_heavy",
            "light_traffic",
            "heavy_traffic",
        ],
    )
    parser.add_argument("--cv-port", type=int, default=5555)
    args = parser.parse_args()

    config = {
        "cv_to_detector_map": {
            "zone_1": "det_N_thru_1",
            "zone_2": "det_N_thru_2",
            "zone_3": "det_N_left",
            "zone_4": "det_S_thru_1",
            "zone_5": "det_S_thru_2",
            "zone_6": "det_S_left",
            "zone_7": "det_E_thru_1",
            "zone_8": "det_E_thru_2",
            "zone_9": "det_E_left",
            "zone_10": "det_W_thru_1",
            "zone_11": "det_W_thru_2",
            "zone_12": "det_W_left",
        }
    }

    if args.mode == "server":
        server = SimulationServer(args.host, args.port, config)
        server.set_traffic_pattern(args.pattern)
        try:
            server.start()
        except KeyboardInterrupt:
            server.stop()

    elif args.mode == "client":
        client = SimulationClient(args.host, args.port)
        if client.connect():
            while True:
                data = client.request_data()
                print(f"Detector data: {data}")
                time.sleep(1)

    elif args.mode == "direct":
        sim = DirectSimulation(config)
        sim.set_traffic_pattern(args.pattern)
        print(f"[SIM] Direct simulation started. Pattern: {args.pattern}")
        print(
            "Type 'pattern <name>' to change pattern, 'phase <name>' to set active phase, 'quit' to exit"
        )

        active_phase = "PHASE_1_N_S_THRU"
        sim.set_active_phase(active_phase)

        try:
            while True:
                sim.update()
                data = sim.get_detector_data()
                print(f"\r{args.pattern}: {data}", end="", flush=True)
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n[SIM] Stopped")
