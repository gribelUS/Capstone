import os
import sys
import time
import subprocess
from typing import Optional, Dict, Any, List

try:
    import traci
    import sumolib
except ImportError:
    print("[SUMO] ERROR: traci module not installed. Run: pip install traci sumolib")
    sys.exit(1)


DETECTOR_MAP = {
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

LANE_TO_DETECTOR = {
    "N_thru_1": "det_N_thru_1",
    "N_thru_2": "det_N_thru_2",
    "N_left": "det_N_left",
    "S_thru_1": "det_S_thru_1",
    "S_thru_2": "det_S_thru_2",
    "S_left": "det_S_left",
    "E_thru_1": "det_E_thru_1",
    "E_thru_2": "det_E_thru_2",
    "E_left": "det_E_left",
    "W_thru_1": "det_W_thru_1",
    "W_thru_2": "det_W_thru_2",
    "W_left": "det_W_left",
}

PHASE_MAP = {
    "PHASE_1_N_S_THRU": 0,
    "PHASE_2_N_S_LEFT": 2,
    "PHASE_3_E_W_THRU": 4,
    "PHASE_4_E_W_LEFT": 6,
}

STOP_LINE_LANES = {
    "det_N_thru_1": ("N_thru_1", -2.0),
    "det_N_thru_2": ("N_thru_2", -2.0),
    "det_N_left": ("N_left", -2.0),
    "det_S_thru_1": ("S_thru_1", -2.0),
    "det_S_thru_2": ("S_thru_2", -2.0),
    "det_S_left": ("S_left", -2.0),
    "det_E_thru_1": ("E_thru_1", -2.0),
    "det_E_thru_2": ("E_thru_2", -2.0),
    "det_E_left": ("E_left", -2.0),
    "det_W_thru_1": ("W_thru_1", -2.0),
    "det_W_thru_2": ("W_thru_2", -2.0),
    "det_W_left": ("W_left", -2.0),
}


class SUMOClient:
    def __init__(
        self,
        sumo_home: str = None,
        config_file: str = "sumo/config/intersection.sumocfg",
        demand_file: str = "sumo/demand/balanced.rou.xml",
        port: int = 8813,
        gui: bool = True,
    ):
        self.sumo_home = sumo_home or os.environ.get("SUMO_HOME", "/usr/share/sumo")
        self.config_file = config_file
        self.demand_file = demand_file
        self.port = port
        self.gui = gui
        self.connected = False
        self.process: Optional[subprocess.Popen] = None
        self.step_count = 0
        self.vehicle_data: Dict[str, Dict] = {}
        self.current_phase = None

    def connect(self) -> bool:
        config_path = os.path.abspath(self.config_file)
        demand_path = os.path.abspath(self.demand_file)

        if not os.path.exists(config_path):
            print(f"[SUMO] ERROR: Config file not found: {config_path}")
            return False

        cfg_dir = os.path.dirname(config_path)
        net_path = os.path.join(cfg_dir, "..", "network", "intersection.net.xml")
        net_path = os.path.abspath(net_path)

        cfg_name = os.path.basename(config_path)

        with open(config_path, "r") as f:
            content = f.read()
            content = content.replace("demand/balanced.rou.xml", demand_path)
            content = content.replace("network/intersection.net.xml", net_path)

        temp_cfg = os.path.join(cfg_dir, "temp_" + cfg_name)
        with open(temp_cfg, "w") as f:
            f.write(content)

        cmd = []
        if self.gui:
            cmd.append("sumo-gui")
        else:
            cmd.append("sumo")

        cmd.extend(
            [
                "-c",
                temp_cfg,
                "--remote-port",
                str(self.port),
                "--step-length",
                "1.0",
                "--no-step-log",
                "--quit-on-end",
            ]
        )

        try:
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            time.sleep(2)

            traci.init(port=self.port, numRetries=30)
            self.connected = True
            print(
                f"[SUMO] Connected to SUMO {'GUI' if self.gui else 'server'} on port {self.port}"
            )
            return True

        except Exception as e:
            print(f"[SUMO] ERROR: Failed to connect: {e}")
            return False

    def disconnect(self):
        if self.connected:
            try:
                traci.close()
                self.connected = False
                print("[SUMO] Disconnected from SUMO")
            except Exception as e:
                print(f"[SUMO] Error during disconnect: {e}")

        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            self.process = None

    def _get_lane_position(self, lane_id: str) -> float:
        try:
            lane_edges = traci.lane.getShape(lane_id)
            if lane_edges:
                return lane_edges[0][0]
        except:
            pass
        return 0.0

    def step(self, delta_time: float = 1.0):
        if not self.connected:
            return

        traci.simulationStep()
        self.step_count += 1
        self._update_vehicle_data()

    def _update_vehicle_data(self):
        self.vehicle_data = {}
        current_time = traci.simulation.getTime()

        for veh_id in traci.vehicle.getIDList():
            try:
                lane_id = traci.vehicle.getLaneID(veh_id)
                if not lane_id or lane_id == "":
                    continue

                base_lane = lane_id.split("_")[0]
                if base_lane not in LANE_TO_DETECTOR:
                    continue

                detector_id = LANE_TO_DETECTOR[base_lane]
                speed = traci.vehicle.getSpeed(veh_id)
                position = traci.vehicle.getPosition(veh_id)[0]

                if detector_id not in self.vehicle_data:
                    self.vehicle_data[detector_id] = {
                        "count": 0,
                        "vehicles": [],
                        "total_wait": 0.0,
                    }

                self.vehicle_data[detector_id]["count"] += 1
                self.vehicle_data[detector_id]["vehicles"].append(
                    {
                        "id": veh_id,
                        "speed": speed,
                    }
                )

            except Exception as e:
                continue

    def get_detector_data(self) -> Dict[str, Dict]:
        result = {}
        current_time = traci.simulation.getTime()

        for detector_id in LANE_TO_DETECTOR.values():
            if detector_id in self.vehicle_data:
                data = self.vehicle_data[detector_id]
                vehicle_count = data["count"]

                avg_wait = 0.0
                if vehicle_count > 0:
                    for veh_id in traci.vehicle.getIDList():
                        try:
                            lane = traci.vehicle.getLaneID(veh_id)
                            if lane and lane.startswith(
                                detector_id.split("_")[1][:1].lower()
                            ):
                                wait_time = traci.vehicle.getWaitingTime(veh_id)
                                avg_wait += wait_time
                        except:
                            pass
                    avg_wait /= vehicle_count

                result[detector_id] = {
                    "count": vehicle_count,
                    "wait_time": round(avg_wait, 1),
                }
            else:
                result[detector_id] = {
                    "count": 0,
                    "wait_time": 0.0,
                }

        return result

    def get_zone_data(self) -> Dict[str, Dict]:
        detector_data = self.get_detector_data()
        result = {}

        for zone_key, detector_id in DETECTOR_MAP.items():
            if detector_id in detector_data:
                result[zone_key] = detector_data[detector_id]
            else:
                result[zone_key] = {"count": 0, "wait_time": 0.0}

        return result

    def set_traffic_light_phase(self, phase_name: str, state: str):
        if not self.connected:
            return

        try:
            tls_id = "center"
            current_phase = traci.trafficlight.getPhase(tls_id)

            target_phase = PHASE_MAP.get(phase_name)
            if target_phase is None:
                return

            if state == "green":
                traci.trafficlight.setPhase(tls_id, target_phase)
            elif state == "yellow":
                traci.trafficlight.setPhase(tls_id, target_phase + 1)
            elif state == "red":
                all_red_phases = [3, 7, 11]
                traci.trafficlight.setPhase(tls_id, all_red_phases[0])

            self.current_phase = phase_name

        except Exception as e:
            print(f"[SUMO] Error setting traffic light: {e}")

    def set_active_phase(self, phase_name: str):
        if not self.connected:
            return

        if "N_S" in phase_name and "LEFT" not in phase_name:
            self.set_traffic_light_phase("PHASE_1_N_S_THRU", "green")
        elif "N_S" in phase_name and "LEFT" in phase_name:
            self.set_traffic_light_phase("PHASE_2_N_S_LEFT", "green")
        elif "E_W" in phase_name and "LEFT" not in phase_name:
            self.set_traffic_light_phase("PHASE_3_E_W_THRU", "green")
        elif "E_W" in phase_name and "LEFT" in phase_name:
            self.set_traffic_light_phase("PHASE_4_E_W_LEFT", "green")

    def has_demand(self, detector_ids: List[str]) -> bool:
        data = self.get_detector_data()
        for det_id in detector_ids:
            if data.get(det_id, {}).get("count", 0) > 0:
                return True
        return False

    def get_total_demand(self, detector_ids: List[str]) -> int:
        data = self.get_detector_data()
        return sum(data.get(det_id, {}).get("count", 0) for det_id in detector_ids)

    def load_demand_file(self, demand_file: str):
        if not self.connected:
            return False

        try:
            traci.route.load(os.path.abspath(demand_file))
            print(f"[SUMO] Loaded new demand file: {demand_file}")
            return True
        except Exception as e:
            print(f"[SUMO] Error loading demand file: {e}")
            return False


class SUMOSimulation:
    def __init__(self, config: dict = None):
        self.config = config or {}
        self.sumo_client: Optional[SUMOClient] = None

    def connect(
        self, demand_file: str = "sumo/demand/balanced.rou.xml", gui: bool = False
    ) -> bool:
        config_file = self.config.get("sumo_config", "sumo/config/intersection.sumocfg")
        self.sumo_client = SUMOClient(
            config_file=config_file,
            demand_file=demand_file,
            gui=gui,
        )
        return self.sumo_client.connect()

    def disconnect(self):
        if self.sumo_client:
            self.sumo_client.disconnect()

    def step(self, delta_time: float = 1.0):
        if self.sumo_client:
            self.sumo_client.step(delta_time)

    def get_detector_data(self) -> Dict[str, Dict]:
        if self.sumo_client:
            return self.sumo_client.get_detector_data()
        return {}

    def get_zone_data(self) -> Dict[str, Dict]:
        if self.sumo_client:
            return self.sumo_client.get_zone_data()
        return {}

    def set_active_phase(self, phase_name: str):
        if self.sumo_client:
            self.sumo_client.set_active_phase(phase_name)

    def has_demand(self, detector_ids: List[str]) -> bool:
        if self.sumo_client:
            return self.sumo_client.has_demand(detector_ids)
        return False

    def get_total_demand(self, detector_ids: List[str]) -> int:
        if self.sumo_client:
            return self.sumo_client.get_total_demand(detector_ids)
        return 0


def main():
    import argparse

    parser = argparse.ArgumentParser(description="SUMO Traffic Simulation")
    parser.add_argument("--config", default="sumo/config/intersection.sumocfg")
    parser.add_argument(
        "--demand",
        default="sumo/demand/balanced.rou.xml",
        choices=[
            "sumo/demand/balanced.rou.xml",
            "sumo/demand/morning_rush.rou.xml",
            "sumo/demand/evening_rush.rou.xml",
            "sumo/demand/east_west_heavy.rou.xml",
            "sumo/demand/north_south_heavy.rou.xml",
            "sumo/demand/light_traffic.rou.xml",
        ],
    )
    parser.add_argument("--nogui", action="store_true", help="Run without GUI")
    parser.add_argument("--port", type=int, default=8813)
    args = parser.parse_args()

    client = SUMOClient(
        config_file=args.config,
        demand_file=args.demand,
        port=args.port,
        gui=not args.nogui,
    )

    if client.connect():
        print("[SUMO] Simulation started. Press Ctrl+C to stop.")
        try:
            while True:
                client.step(1.0)
                data = client.get_detector_data()
                print(f"\rStep {client.step_count}: {data}", end="", flush=True)
                time.sleep(0.1)
        except KeyboardInterrupt:
            print("\n[SUMO] Stopping simulation...")
        finally:
            client.disconnect()
    else:
        print("[SUMO] Failed to connect to SUMO")


if __name__ == "__main__":
    main()
