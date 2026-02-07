import argparse
import json
import os
import sys
import time


# ------------------------------------------------------------------
# CONFIGURATION LOADER
# ------------------------------------------------------------------
class SystemConfig:
    def __init__(self, rules_path, hardware_path):
        self.rules = self._load_json(rules_path)
        self.hardware = self._load_json(hardware_path)

        # Validation: Ensure every phase in Rules exists in Hardware
        self._validate_integrity()

    def _load_json(self, path):
        try:
            with open(path, "r") as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"[FATAL] Config file missing: {path}")
            sys.exit(1)

    def _validate_integrity(self):
        """Ensures logic rules don't ask for hardware that doesn't exist."""
        logic_phases = self.rules["logic_flow"]["phases"]
        hw_phases = self.hardware["io_mapping"].keys()

        for phase in logic_phases:
            if phase not in hw_phases:
                print(
                    f"[CONFIG ERROR] Logic asks for '{phase}', but it is not defined in hardware.json"
                )
                sys.exit(1)
        print("[SYSTEM] Configuration Integrity Check Passed.")


# ------------------------------------------------------------------
# PLC DRIVER (Hardware Layer)
# ------------------------------------------------------------------
try:
    from pycomm3 import LogixDriver
except ImportError:
    LogixDriver = None


class PLCDriver:
    def __init__(self, hw_config):
        self.cfg = hw_config
        self.ip = self.cfg["connection"]["plc_ip"]
        self.map = self.cfg["io_mapping"]
        self.driver = None
        self.connected = False

    def connect(self):
        if LogixDriver is None:
            print("[PLC] Pycomm3 not found. Running in SIMULATION mode.")
            return

        try:
            print(f"[PLC] Connecting to {self.ip}...")
            self.driver = LogixDriver(self.ip, slot=self.cfg["connection"]["plc_slot"])
            self.driver.open()
            self.connected = True
            print("[PLC] Connected.")
        except Exception as e:
            print(f"[PLC] Connection Failed: {e}. Running in SIMULATION mode.")
            self.connected = False

    def write_tag(self, tag_name, value):
        if self.connected:
            try:
                self.driver.write(tag_name, value)
            except Exception as e:
                print(f"[PLC ERROR] Failed to write {tag_name}: {e}")
        else:
            # Simulation Print
            # print(f"[SIM-IO] Write {tag_name} -> {value}")
            pass

    def activate_phase(self, phase_name):
        """Turns on Greens for a specific phase."""
        tags = self.map[phase_name]["green_tags"]
        for tag in tags:
            self.write_tag(tag, 1)

    def deactivate_phase_green(self, phase_name):
        """Turns off Greens for a specific phase."""
        tags = self.map[phase_name]["green_tags"]
        for tag in tags:
            self.write_tag(tag, 0)

    def activate_phase_yellow(self, phase_name):
        """Turns on Yellows for a specific phase."""
        tags = self.map[phase_name]["yellow_tags"]
        for tag in tags:
            self.write_tag(tag, 1)

    def deactivate_phase_yellow(self, phase_name):
        """Turns off Yellows for a specific phase."""
        tags = self.map[phase_name]["yellow_tags"]
        for tag in tags:
            self.write_tag(tag, 0)


# ------------------------------------------------------------------
# TRAFFIC CONTROLLER (Logic Layer)
# ------------------------------------------------------------------
class TrafficController:
    def __init__(self, rules_file, hardware_file):
        # Load Configs
        self.sys_config = SystemConfig(rules_file, hardware_file)
        self.rules = self.sys_config.rules

        # Initialize Hardware Driver
        self.plc = PLCDriver(self.sys_config.hardware)

        # State
        self.current_phase = self.rules["logic_flow"]["startup_phase"]
        self.phase_index = 0

    def run_sequence(self):
        self.plc.connect()
        print(f"[CONTROL] Starting Sequence. Initial Phase: {self.current_phase}")

        # Turn on initial phase
        self.plc.activate_phase(self.current_phase)

        try:
            while True:
                # 1. Wait for Green Duration (Simplification of your logic)
                # In real implementation, read your CV data here to decide when to break
                green_time = self.rules["timings"]["min_green"]
                print(
                    f"[LOGIC] Holding {self.current_phase} Green for {green_time}s..."
                )
                time.sleep(green_time)

                # 2. Determine Next Phase
                phase_list = self.rules["logic_flow"]["phases"]
                next_index = (phase_list.index(self.current_phase) + 1) % len(
                    phase_list
                )
                next_phase = phase_list[next_index]

                # 3. Transition Logic
                self._transition(self.current_phase, next_phase)

                # 4. Update State
                self.current_phase = next_phase

        except KeyboardInterrupt:
            print("\n[SYSTEM] Manual Override. Shutting down.")

    def _transition(self, old_phase, new_phase):
        print(f"[TRANSITION] {old_phase} -> {new_phase}")

        # Green -> Yellow
        self.plc.deactivate_phase_green(old_phase)
        self.plc.activate_phase_yellow(old_phase)

        time.sleep(self.rules["timings"]["yellow_duration"])

        # Yellow -> Red
        self.plc.deactivate_phase_yellow(old_phase)

        # All Red Clearance
        print("[TRANSITION] All Red Clearance")
        time.sleep(self.rules["timings"]["all_red_clearance"])

        # New Green
        self.plc.activate_phase(new_phase)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--rules", default="rules.json")
    parser.add_argument("--hardware", default="hardware.json")
    args = parser.parse_args()

    app = TrafficController(args.rules, args.hardware)
    app.run_sequence()
