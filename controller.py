import argparse
import json
import os
import sys
import time
import datetime
import csv


try:
    from pycomm3 import LogixDriver
except ImportError:
    LogixDriver = None


SUMO_AVAILABLE = False
try:
    from sumo.sumo_interface import SUMOSimulation

    SUMO_AVAILABLE = True
except ImportError:
    print(
        "[CONTROLLER] SUMO interface not available. Use 'pip install traci sumolib' for SUMO support."
    )


class SystemConfig:
    def __init__(self, rules_path: str, hardware_path: str):
        self.rules = self._load_json(rules_path)
        self.hardware = self._load_json(hardware_path)
        self._validate_integrity()

    def _load_json(self, path: str) -> dict:
        try:
            with open(path, "r") as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"[FATAL] Config file missing: {path}")
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"[FATAL] Invalid JSON in {path}: {e}")
            sys.exit(1)

    def _validate_integrity(self):
        rules_phases = set(self.rules.get("phases", {}).keys())
        hw_phases = set(self.hardware.get("phases", {}).keys())

        missing_in_hw = rules_phases - hw_phases
        if missing_in_hw:
            print(
                f"[CONFIG ERROR] Rules reference phases not in hardware: {missing_in_hw}"
            )
            sys.exit(1)

        print("[SYSTEM] Configuration Integrity Check Passed.")


class PLCDriver:
    def __init__(self, hw_config: dict):
        self.cfg = hw_config
        self.ip = self.cfg.get("connection", {}).get("plc_ip", "192.168.1.54")
        self.driver = None
        self.connected = False

    def connect(self) -> bool:
        if LogixDriver is None:
            print("[PLC] Pycomm3 not found. Running in SIMULATION mode.")
            return False

        try:
            print(f"[PLC] Connecting to {self.ip}...")
            slot = self.cfg.get("connection", {}).get("plc_slot", 0)
            self.driver = LogixDriver(self.ip, slot=slot)
            self.driver.open()
            self.connected = True
            print("[PLC] Connected.")
            return True
        except Exception as e:
            print(f"[PLC] Connection Failed: {e}. Running in SIMULATION mode.")
            self.connected = False
            return False

    def disconnect(self):
        if self.driver:
            self.driver.close()
            self.connected = False

    def write_tag(self, tag_name: str, value: int):
        if self.connected and self.driver:
            try:
                self.driver.write(tag_name, value)
            except Exception as e:
                print(f"[PLC ERROR] Failed to write {tag_name}: {e}")

    def set_phase_green(self, phase_name: str):
        phase = self.cfg.get("phases", {}).get(phase_name, {})
        for tag in phase.get("green_tags", []):
            self.write_tag(tag, 1)
        for tag in phase.get("red_tags", []):
            self.write_tag(tag, 0)

    def set_phase_yellow(self, phase_name: str):
        phase = self.cfg.get("phases", {}).get(phase_name, {})
        for tag in phase.get("green_tags", []):
            self.write_tag(tag, 0)
        for tag in phase.get("yellow_tags", []):
            self.write_tag(tag, 1)

    def set_phase_red(self, phase_name: str):
        phase = self.cfg.get("phases", {}).get(phase_name, {})
        for tag in phase.get("green_tags", []):
            self.write_tag(tag, 0)
        for tag in phase.get("yellow_tags", []):
            self.write_tag(tag, 0)
        for tag in phase.get("red_tags", []):
            self.write_tag(tag, 1)

    def set_pedestrian_walk(self, ped_phase: str):
        phase = self.cfg.get("phases", {}).get(ped_phase, {})
        for tag in phase.get("walk_tags", []):
            self.write_tag(tag, 1)
        for tag in phase.get("clear_tags", []):
            self.write_tag(tag, 0)

    def set_pedestrian_clear(self, ped_phase: str):
        phase = self.cfg.get("phases", {}).get(ped_phase, {})
        for tag in phase.get("walk_tags", []):
            self.write_tag(tag, 0)
        for tag in phase.get("clear_tags", []):
            self.write_tag(tag, 1)

    def all_red(self):
        for phase_name, phase in self.cfg.get("phases", {}).items():
            if phase_name.startswith("PHASE_PED"):
                continue
            for tag in phase.get("green_tags", []):
                self.write_tag(tag, 0)
            for tag in phase.get("yellow_tags", []):
                self.write_tag(tag, 0)


class DecisionEngine:
    def __init__(self, rules_config: dict, hw_config: dict):
        self.rules = rules_config
        self.hardware = hw_config
        self.phases = rules_config.get("phases", {})
        self.decision_logic = rules_config.get("decision_logic", {})
        self.ring_barrier = rules_config.get("ring_barrier", {})
        self.timings = rules_config.get("timings", {})

    def _is_left_phase(self, phase_name: str) -> bool:
        movements = self.phases.get(phase_name, {}).get("movements", [])
        return bool(movements) and all(movement.endswith("left") for movement in movements)

    def _get_queue_threshold(self, phase_name: str) -> int:
        pressure_cfg = self.decision_logic.get("phase_pressure", {})
        if self._is_left_phase(phase_name):
            return pressure_cfg.get(
                "left_queue_threshold",
                self.decision_logic.get("demand_waiting_threshold", 1),
            )
        return pressure_cfg.get(
            "through_queue_threshold", self.decision_logic.get("queue_threshold", 2)
        )

    def _get_phase_metrics(self, phase_name: str, cv_interface) -> dict:
        phase_config = self.phases.get(phase_name, {})
        detectors = phase_config.get("detectors", [])
        demand = cv_interface.get_total_demand(detectors)
        total_wait = 0.0

        if hasattr(cv_interface, "get_total_wait"):
            total_wait = cv_interface.get_total_wait(detectors)

        pressure_cfg = self.decision_logic.get("phase_pressure", {})
        vehicle_weight = pressure_cfg.get(
            "left_weight" if self._is_left_phase(phase_name) else "through_weight", 1.0
        )
        wait_weight = pressure_cfg.get("wait_time_weight", 0.0)
        pressure = (demand * vehicle_weight) + (total_wait * wait_weight)

        return {
            "phase": phase_name,
            "demand": demand,
            "total_wait": total_wait,
            "pressure": pressure,
            "queue_threshold": self._get_queue_threshold(phase_name),
            "recall": phase_config.get("recall"),
            "ring": phase_config.get("ring"),
            "sequence": phase_config.get("sequence", 0),
        }

    def _phase_is_service_eligible(self, metrics: dict) -> bool:
        return metrics["demand"] >= metrics["queue_threshold"] or metrics["recall"] == "min_green"

    def _get_service_candidates(self, current_phase: str, cv_interface) -> list[dict]:
        candidates = []

        for phase_name in self.phases:
            if phase_name == current_phase:
                continue

            metrics = self._get_phase_metrics(phase_name, cv_interface)
            if self._phase_is_service_eligible(metrics):
                candidates.append(metrics)

        return candidates

    def _get_best_candidate_phase(self, current_phase: str, cv_interface) -> dict | None:
        candidates = self._get_service_candidates(current_phase, cv_interface)
        if not candidates:
            return None

        candidates.sort(
            key=lambda metrics: (
                metrics["pressure"],
                metrics["demand"],
                -metrics["sequence"],
            ),
            reverse=True,
        )

        return candidates[0]

    def _get_competing_phase_metrics(self, current_phase: str, cv_interface) -> dict | None:
        current_ring = self.phases.get(current_phase, {}).get("ring", 1)
        current_sequence = self.phases.get(current_phase, {}).get("sequence", 1)
        same_ring_next = None
        other_ring_best = None

        for metrics in self._get_service_candidates(current_phase, cv_interface):
            if metrics["ring"] == current_ring:
                if metrics["sequence"] > current_sequence:
                    if same_ring_next is None or metrics["sequence"] < same_ring_next["sequence"]:
                        same_ring_next = metrics
                continue

            if other_ring_best is None or metrics["demand"] > other_ring_best["demand"]:
                other_ring_best = metrics

        if same_ring_next and other_ring_best:
            if same_ring_next["demand"] >= other_ring_best["demand"]:
                return same_ring_next
            return other_ring_best

        return same_ring_next or other_ring_best

    def evaluate_phase(
        self, current_phase: str, phase_start_time: float, cv_interface
    ) -> tuple[str, str]:
        current_time = time.time()
        duration = current_time - phase_start_time
        phase_config = self.phases.get(current_phase)

        if not phase_config:
            return "HOLD", "unknown_phase"

        min_green = phase_config.get("min_green", 15)
        max_green = phase_config.get("max_green", 60)
        passage_time = phase_config.get(
            "passage_time",
            self.decision_logic.get("gap_out", {}).get("gap_threshold_sec", 3.0),
        )
        current_metrics = self._get_phase_metrics(current_phase, cv_interface)
        demand = current_metrics["demand"]
        hold_threshold = self.decision_logic.get(
            "current_phase_hold_threshold",
            self.decision_logic.get("demand_waiting_threshold", 1),
        )
        has_call = demand >= hold_threshold

        if duration < min_green:
            if phase_config.get("recall") == "min_green" or has_call:
                return "HOLD", "min_green_not_met"
            else:
                return "CHANGE", "no_demand"

        if duration >= max_green:
            return "CHANGE", "max_green_reached"

        if self.decision_logic.get("gap_out", {}).get("enabled"):
            if not has_call and duration > (min_green + passage_time):
                return "CHANGE", "gap_out"

        competing_metrics = self._get_competing_phase_metrics(current_phase, cv_interface)
        if competing_metrics and duration > min_green:
            reallocation_margin = self.decision_logic.get(
                "reallocation_margin",
                self.decision_logic.get("queue_threshold", 2),
            )
            if competing_metrics["demand"] >= demand + reallocation_margin:
                return "CHANGE", "other_phase_demand"

            if competing_metrics["demand"] >= competing_metrics["queue_threshold"] and not has_call:
                return "CHANGE", "other_phase_demand"

        return "EXTEND", "continuing"

    def get_next_phase(self, current_phase: str, cv_interface) -> str:
        best_candidate = self._get_best_candidate_phase(current_phase, cv_interface)
        if best_candidate:
            return best_candidate["phase"]

        current_ring = self.phases.get(current_phase, {}).get("ring", 1)
        barrier_1_phases = self.ring_barrier.get("barrier_1", [])
        barrier_2_phases = self.ring_barrier.get("barrier_2", [])

        if current_ring == 1:
            fallback = barrier_2_phases[0] if barrier_2_phases else current_phase
        else:
            fallback = barrier_1_phases[0] if barrier_1_phases else current_phase

        return fallback


class DataLogger:
    def __init__(self, log_dir: str = "logs", run_label: str | None = None):
        os.makedirs(log_dir, exist_ok=True)
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"traffic_log_{timestamp}.csv"

        if run_label:
            safe_label = "".join(
                ch if ch.isalnum() or ch in {"-", "_"} else "_" for ch in run_label
            )
            filename = f"traffic_log_{safe_label}_{timestamp}.csv"

        self.filepath = os.path.join(log_dir, filename)
        self.file = open(self.filepath, "w", newline="")
        self.writer = csv.writer(self.file)
        self.writer.writerow(
            [
                "timestamp",
                "phase",
                "duration_s",
                "decision",
                "reason",
                "N_thru_count",
                "S_thru_count",
                "E_thru_count",
                "W_thru_count",
                "N_left_count",
                "S_left_count",
                "E_left_count",
                "W_left_count",
            ]
        )
        print(f"[LOGGER] Log file: {self.filepath}")

    def log(
        self,
        phase: str,
        duration: float,
        decision: str,
        reason: str,
        traffic_data,
        rules_config,
    ):
        if hasattr(traffic_data, "get_vehicle_counts"):
            counts = traffic_data.get_vehicle_counts()
        else:
            counts = {}

        hw = rules_config.get("cv_to_detector_map", {})

        row = [
            datetime.datetime.now().isoformat(),
            phase,
            round(duration, 1),
            decision,
            reason,
            counts.get("det_N_thru_1", 0) + counts.get("det_N_thru_2", 0),
            counts.get("det_S_thru_1", 0) + counts.get("det_S_thru_2", 0),
            counts.get("det_E_thru_1", 0) + counts.get("det_E_thru_2", 0),
            counts.get("det_W_thru_1", 0) + counts.get("det_W_thru_2", 0),
            counts.get("det_N_left", 0),
            counts.get("det_S_left", 0),
            counts.get("det_E_left", 0),
            counts.get("det_W_left", 0),
        ]
        self.writer.writerow(row)
        self.file.flush()

    def close(self):
        self.file.close()


class TrafficDataWrapper:
    def __init__(self, controller):
        self.controller = controller
        self.rules = controller.rules
        self.cv_to_detector = self.rules.get("cv_to_detector_map", {})
        self._cached_data = None

    def _get_data(self) -> dict:
        if self._cached_data is not None:
            return self._cached_data

        if self.controller.simulate:
            self._cached_data = self.controller._get_traffic_data()
        else:
            self._cached_data = self.controller.cv.request_data()

        return self._cached_data

    def _resolve_detector_id(self, source_key: str) -> str | None:
        if source_key in self.cv_to_detector:
            return self.cv_to_detector[source_key]
        if source_key in self.cv_to_detector.values():
            return source_key
        return None

    def _map_zones_to_detectors(self, zone_data: dict) -> dict:
        result = {}
        for zone_key, detections in zone_data.items():
            detector_id = self._resolve_detector_id(zone_key)
            if detector_id:
                result[detector_id] = detections
        return result

    def get_vehicle_counts(self) -> dict:
        data = self._get_data()
        result = {}
        
        for zone_key, zone_data in data.items():
            detector_id = self._resolve_detector_id(zone_key)
            if detector_id:
                if isinstance(zone_data, dict):
                    result[detector_id] = zone_data.get("count", 0)
                elif isinstance(zone_data, int):
                    result[detector_id] = zone_data
                else:
                    result[detector_id] = 0
        
        return result

    def get_wait_times(self) -> dict:
        data = self._get_data()
        result = {}

        for zone_key, zone_data in data.items():
            detector_id = self._resolve_detector_id(zone_key)
            if detector_id:
                if isinstance(zone_data, dict):
                    result[detector_id] = zone_data.get("wait_time", 0.0)
                else:
                    result[detector_id] = 0.0

        return result

    def has_demand(self, detector_ids: list) -> bool:
        counts = self.get_vehicle_counts()
        return any(counts.get(det_id, 0) > 0 for det_id in detector_ids)

    def get_total_demand(self, detector_ids: list) -> int:
        counts = self.get_vehicle_counts()
        return sum(counts.get(det_id, 0) for det_id in detector_ids)

    def get_total_wait(self, detector_ids: list) -> float:
        counts = self.get_vehicle_counts()
        waits = self.get_wait_times()
        return sum(counts.get(det_id, 0) * waits.get(det_id, 0.0) for det_id in detector_ids)


class TrafficController:
    def __init__(
        self,
        rules_path: str,
        hardware_path: str,
        cv_host: str = "127.0.0.1",
        cv_port: int = 5555,
        simulate: bool = False,
        sim_host: str = "127.0.0.1",
        sim_port: int = 5556,
        sim_type: str = "internal",
        sim_pattern: str = "balanced",
        sumo_demand: str = "balanced",
        sumo_port: int = 8813,
    ):
        self.sys_config = SystemConfig(rules_path, hardware_path)
        self.rules = self.sys_config.rules
        self.hardware = self.sys_config.hardware
        self.simulate = simulate
        self.sim_type = sim_type
        self.sim_pattern = sim_pattern
        self.sumo_demand = sumo_demand

        if simulate:
            if sim_type == "sumo" and SUMO_AVAILABLE:
                print(f"[CONTROL] Starting SUMO simulation with demand: {sumo_demand}")
                self.sumo_sim = SUMOSimulation(self.rules)
                demand_file = f"sumo/demand/{sumo_demand}.rou.xml"
                if self.sumo_sim.connect(demand_file, gui=True, port=sumo_port):
                    self.use_sumo = True
                    print("[CONTROL] SUMO connected successfully")
                else:
                    print(
                        "[CONTROL] SUMO connection failed, falling back to internal simulation"
                    )
                    self.use_sumo = False
                    from simulation import DirectSimulation

                    self.direct_sim = DirectSimulation(self.rules)
                    self.direct_sim.set_traffic_pattern(sim_pattern)
                self.cv = None
                self.sim_client = None
                self.use_direct_sim = False
            else:
                from simulation import SimulationClient, DirectSimulation

                self.use_sumo = False
                self.sumo_sim = None
                self.use_direct_sim = False
                try:
                    self.sim_client = SimulationClient(sim_host, sim_port)
                    if self.sim_client.connect():
                        print("[CONTROL] Connected to external simulation server")
                        self.use_direct_sim = False
                    else:
                        print("[CONTROL] Starting internal simulation")
                        self.use_direct_sim = True
                        self.direct_sim = DirectSimulation(self.rules)
                        self.direct_sim.set_traffic_pattern(sim_pattern)
                except Exception as e:
                    print(f"[CONTROL] External sim unavailable, using internal: {e}")
                    self.use_direct_sim = True
                    self.direct_sim = DirectSimulation(self.rules)
                    self.direct_sim.set_traffic_pattern(sim_pattern)

                self.cv = None
        else:
            from cv_interface import CVInterface

            self.cv = CVInterface(self.rules, cv_host, cv_port)
            self.cv.connect()
            self.sim_client = None
            self.direct_sim = None
            self.sumo_sim = None
            self.use_sumo = False
            self.use_direct_sim = False

        self.plc = PLCDriver(self.hardware)
        self.plc.connect()

        self.decision_engine = DecisionEngine(self.rules, self.hardware)

        phase_order = list(self.rules.get("phases", {}).keys())
        self.current_phase = phase_order[0] if phase_order else "PHASE_1_N_S_THRU"
        self.phase_start_time = time.time()

        run_label = None
        if self.simulate:
            if self.sim_type == "sumo":
                run_label = self.sumo_demand
            else:
                run_label = self.sim_pattern

        self.logger = DataLogger(run_label=run_label)
        self.running = False

    def _get_traffic_data(self):
        if self.simulate:
            if self.use_sumo and self.sumo_sim:
                self.sumo_sim.step(1.0)
                return self.sumo_sim.get_zone_data()
            elif not self.use_direct_sim and self.sim_client:
                return self.sim_client.request_data()
            elif self.direct_sim:
                self.direct_sim.update()
                return self.direct_sim.get_zone_data()
            return {}
        else:
            return self.cv.request_data()

    def _has_demand(self, detector_ids: list) -> bool:
        if self.simulate:
            if self.use_sumo and self.sumo_sim:
                return self.sumo_sim.has_demand(detector_ids)
            elif not self.use_direct_sim and self.sim_client:
                data = self.sim_client.request_data()
            elif self.direct_sim:
                return self.direct_sim.has_demand(detector_ids)
            return False
        else:
            return self.cv.has_demand(detector_ids)

    def _get_total_demand(self, detector_ids: list) -> int:
        if self.simulate:
            if self.use_sumo and self.sumo_sim:
                return self.sumo_sim.get_total_demand(detector_ids)
            elif not self.use_direct_sim and self.sim_client:
                data = self.sim_client.request_data()
                total = 0
                hw = self.rules.get("cv_to_detector_map", {})
                for zone_key, count in data.items():
                    if isinstance(count, dict):
                        c = count.get("count", 0)
                    else:
                        c = count
                    for det_id in detector_ids:
                        if hw.get(zone_key) == det_id:
                            total += c
                            break
                return total
            elif self.direct_sim:
                return self.direct_sim.get_total_demand(detector_ids)
            return 0
        else:
            return self.cv.get_total_demand(detector_ids)

    def _notify_sim_phase(self, phase_name: str, is_green: bool):
        if self.simulate:
            if self.use_sumo and self.sumo_sim:
                if is_green:
                    self.sumo_sim.set_active_phase(phase_name)
            elif not self.use_direct_sim and self.sim_client:
                self.sim_client.notify_phase(phase_name, is_green)
            elif self.direct_sim:
                self.direct_sim.set_active_phase(phase_name)

    def start(self):
        self.running = True
        print(f"[CONTROL] Starting Traffic Controller")
        print(f"[CONTROL] Initial Phase: {self.current_phase}")

        self._activate_phase(self.current_phase)

        try:
            while self.running:
                self._control_cycle()
        except KeyboardInterrupt:
            print("\n[SYSTEM] Manual Override. Shutting down.")
        finally:
            self.shutdown()

    def _control_cycle(self):
        traffic_wrapper = TrafficDataWrapper(self)
        decision, reason = self.decision_engine.evaluate_phase(
            self.current_phase, self.phase_start_time, traffic_wrapper
        )

        duration = time.time() - self.phase_start_time

        self.logger.log(
            self.current_phase, duration, decision, reason, traffic_wrapper, self.rules
        )

        if decision == "CHANGE":
            next_phase = self.decision_engine.get_next_phase(
                self.current_phase, traffic_wrapper
            )
            print(
                f"[DECISION] {decision}: {reason} | {self.current_phase} -> {next_phase}"
            )
            self._transition_to(next_phase)
        elif decision == "EXTEND":
            print(f"[DECISION] {decision}: {reason} | Extending {self.current_phase}")
            time.sleep(self.rules.get("timings", {}).get("extension_interval", 2.0))
        else:
            time.sleep(self.rules.get("timings", {}).get("extension_interval", 2.0))

    def _activate_phase(self, phase_name: str):
        print(f"[PHASE] Activating {phase_name}")
        self.plc.set_phase_green(phase_name)
        self._notify_sim_phase(phase_name, True)

        phase_config = self.rules.get("phases", {}).get(phase_name, {})
        ped_phase = phase_config.get("ped_phase")
        if ped_phase:
            self._run_pedestrian_phase(ped_phase)

    def _run_pedestrian_phase(self, ped_phase: str):
        timings = self.rules.get("timings", {})
        walk_time = timings.get("ped_walk", 7.0)
        clear_time = timings.get("ped_clear", 15.0)

        print(f"[PEDESTRIAN] Walk phase {ped_phase} for {walk_time}s")
        self.plc.set_pedestrian_walk(ped_phase)
        time.sleep(walk_time)

        print(f"[PEDESTRIAN] Clearance phase for {clear_time}s")
        self.plc.set_pedestrian_clear(ped_phase)

    def _transition_to(self, new_phase: str):
        timings = self.rules.get("timings", {})
        yellow_time = timings.get("yellow", 4.0)
        all_red_time = timings.get("all_red", 2.0)

        print(f"[TRANSITION] {self.current_phase} -> {new_phase}")

        self.plc.set_phase_yellow(self.current_phase)
        self._notify_sim_phase(self.current_phase, False)
        time.sleep(yellow_time)

        self.plc.set_phase_red(self.current_phase)
        print(f"[TRANSITION] All Red Clearance ({all_red_time}s)")
        time.sleep(all_red_time)

        self.current_phase = new_phase
        self.phase_start_time = time.time()
        self._activate_phase(new_phase)

    def shutdown(self):
        print("[SYSTEM] Shutting down...")
        self.running = False
        self.plc.all_red()
        self.plc.disconnect()
        if self.simulate:
            if self.use_sumo and self.sumo_sim:
                self.sumo_sim.disconnect()
            if self.sim_client:
                self.sim_client.disconnect()
        else:
            if self.cv:
                self.cv.disconnect()
        self.logger.close()
        print("[SYSTEM] Shutdown complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Traffic Signal Controller")
    parser.add_argument("--rules", default="rules.json", help="Path to rules.json")
    parser.add_argument(
        "--hardware", default="hardware.json", help="Path to hardware.json"
    )
    parser.add_argument("--cv-host", default="127.0.0.1", help="CV module host")
    parser.add_argument("--cv-port", type=int, default=5555, help="CV module port")
    parser.add_argument(
        "--simulate", action="store_true", help="Use simulation instead of CV module"
    )
    parser.add_argument(
        "--sim-host", default="127.0.0.1", help="Simulation server host"
    )
    parser.add_argument(
        "--sim-port", type=int, default=5556, help="Simulation server port"
    )
    parser.add_argument(
        "--sim-type",
        default="internal",
        choices=["internal", "sumo"],
        help="Simulation type: internal (built-in) or sumo (SUMO traffic simulation)",
    )
    parser.add_argument(
        "--sumo-demand",
        default="balanced",
        choices=[
            "balanced",
            "morning_rush",
            "evening_rush",
            "east_west_heavy",
            "north_south_heavy",
            "light_traffic",
        ],
        help="Traffic pattern for SUMO simulation",
    )
    parser.add_argument(
        "--sumo-port",
        type=int,
        default=8813,
        help="TraCI port for SUMO. Use different ports for parallel SUMO runs.",
    )
    parser.add_argument(
        "--sim-pattern",
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
        help="Traffic pattern for internal simulation",
    )
    args = parser.parse_args()

    if args.simulate:
        print(f"[CONTROL] Running in SIMULATION mode (type: {args.sim_type})")
        if args.sim_type == "sumo":
            print(f"[CONTROL] SUMO demand pattern: {args.sumo_demand}")
        else:
            print(f"[CONTROL] Internal simulation pattern: {args.sim_pattern}")

    controller = TrafficController(
        args.rules,
        args.hardware,
        args.cv_host,
        args.cv_port,
        simulate=args.simulate,
        sim_host=args.sim_host,
        sim_port=args.sim_port,
        sim_type=args.sim_type,
        sim_pattern=args.sim_pattern,
        sumo_demand=args.sumo_demand,
        sumo_port=args.sumo_port,
    )
    controller.start()
