import argparse
import csv
import datetime
import json
import os
import random
import time

from pycomm3 import LogixDriver

# --- Configuration ---
LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)


# --------------------------------------------------------------------------
# Data Logging Class
# --------------------------------------------------------------------------
class DataLogger:
    """Handles writing simulation metrics to a CSV file."""

    def __init__(self, filename):
        self.filepath = os.path.join(LOG_DIR, filename)
        self.file = open(self.filepath, "w", newline="")
        self.writer = csv.writer(self.file)
        self.headers = [
            "timestamp",
            "current_phase",
            "duration_served",
            "queue_W",
            "queue_E",
            "queue_WL",
            "queue_ER",
            "queue_NL",
            "queue_NR",
            "decision_type",
        ]
        self.writer.writerow(self.headers)
        print(f"[LOGGER]: Log file created at {self.filepath}")

    def log_cycle(self, timestamp, phase, duration, counts, decision):
        row = [
            timestamp.isoformat(),
            phase,
            duration,
            counts.get("W", 0),
            counts.get("E", 0),
            counts.get("WL", 0),
            counts.get("ER", 0),
            counts.get("NL", 0),
            counts.get("NR", 0),
            decision,
        ]
        self.writer.writerow(row)
        self.file.flush()  # Ensure data is written immediately

    def close(self):
        self.file.close()
        print(f"[LOGGER]: Log file closed.")


# --------------------------------------------------------------------------
# PLC Communication Class (PLC module is considered complete)
# --------------------------------------------------------------------------
class PLC:
    """
    Represents a PLC
    """

    def __init__(self, ip_address):
        self.ip_address = ip_address
        self.driver = None

    def connect(self):
        """
        Establishes a connection to the PLC
        :return: True on success, False on failure
        """
        try:
            self.driver = LogixDriver(self.ip_address)
            self.driver.open()
            print(f"PLC: Connected to {self.ip_address}")
            return True
        except Exception as e:
            print(f"PLC: Failed to connect to {self.ip_address}: {e}")
            return False

    def write_tag(self, tag_name: str, value):
        """
        Writes a value to PLC tag
        """
        if self.driver is None:
            # Simulate success if disconnected to allow algorithm testing
            # print(f"PLC: Not connected to {self.ip_address} to write (Simulated success).")
            return True
        try:
            response = self.driver.write(tag_name, value)
            if response and response.is_success:
                return True
            print(
                f"PLC: Write failed for tag {tag_name} - Status: {response.error if response else 'N/A'}"
            )
            return False
        except Exception as e:
            print(f"PLC: Exception during write of {self.ip_address}: {e}")
            return False

    def close(self):
        """
        Closes the connection to the PLC
        """
        if self.driver:
            self.driver.close()
            print(f"PLC: Connection to {self.ip_address} closed.")


# --------------------------------------------------------------------------
# Traffic Control Algorithm
# --------------------------------------------------------------------------
class TrafficController:
    def __init__(self, plc: PLC, rules_filepath: str, log_filename: str):
        if not plc or not plc.driver:
            # Allow initialization without connection for testing purposes
            print("WARNING: PLC connection is not active. Running in simulation mode.")

        self.plc = plc
        self.rules = self._load_rules(rules_filepath)

        # Initialize state
        self.current_phase = "WE"  # Initial phase
        self.phase_start_time = time.time()
        self.movements = ["W", "E", "WL", "ER", "NL", "NR"]  # All tracked movements

        # Load timing and phase maps from rules
        self.timing = self.rules["timing"]
        self.phase_tags = self.rules["phases"]
        self.all_light_tags = set(
            tag for tags in self.phase_tags.values() for tag in tags
        )

        # Initialize Logger
        self.logger = DataLogger(log_filename)

        # Set initial light state
        self._set_phase(self.current_phase)
        print(f"Controller Initialized. Starting with phase: {self.current_phase}")
        print("-" * 50)

    def _load_rules(self, filepath: str) -> dict:
        """Loads and validates the ruleset from a JSON file."""
        try:
            with open(filepath, "r") as f:
                rules = json.load(f)
                print(
                    f"[INFO]: Ruleset loaded successfully from {filepath} (Version: {rules.get('version')})."
                )
                return rules
        except FileNotFoundError:
            print(f"[FATAL]: Rules file not found at {filepath}. Exiting.")
            exit(1)
        except json.JSONDecodeError:
            print(f"[FATAL]: Invalid JSON format in {filepath}. Exiting.")
            exit(1)

    def _set_phase(self, new_phase: str):
        """Changes the traffic light state with required safety steps."""

        if self.current_phase == new_phase:
            # No change needed, just continue timing
            return

        # 1. Safety First: Turn OFF all lights (All Red Phase)
        print(
            f"\n[PLC]: Changing phase to {new_phase}. Entering ALL-RED for {self.timing['all_red_delay']}s."
        )
        for tag in self.all_light_tags:
            self.plc.write_tag(tag, 0)
        time.sleep(self.timing["all_red_delay"])

        # 2. Turn ON the lights for the specified phase.
        tags_to_activate = self.phase_tags.get(new_phase)
        if tags_to_activate:
            print(f"[PLC]: Activating {new_phase} tags: {tags_to_activate}")
            for tag in tags_to_activate:
                self.plc.write_tag(tag, 1)

        # Update Controller State
        self.current_phase = new_phase
        self.phase_start_time = time.time()
        print(f"--- Phase '{self.current_phase}' is now GREEN ---")

    def _get_queue_counts(self) -> dict:
        """Simulates Camera/CV input (Placeholder for real CV module)."""
        counts = {direction: random.randint(0, 15) for direction in self.movements}
        # print(f"[Camera]: Counts: {counts}") # Keep logging minimal to avoid clutter
        return counts

    def _get_time_of_day_priority(self, now: datetime.datetime) -> list:
        """Determines the priority list based on time-of-day rules."""
        day_of_week = now.weekday()
        hour = now.hour
        is_weekday = 0 <= day_of_week <= 4

        # Check rush hour rules
        for name, rule in self.rules["time_priorities"].items():
            if (
                name != "default"
                and is_weekday
                and rule["start_hour"] <= hour < rule["end_hour"]
            ):
                print(f"[LOGIC]: Applying rule: {name.upper()}")
                return rule["priority_order"]

        # Default rule
        return self.rules["time_priorities"]["default"]["priority_order"]

    def _get_phase_timing_params(self, phase: str) -> tuple:
        """Returns (min_green, max_green) for the current phase."""
        if phase in ["W", "E", "WE"]:
            return self.timing["ew_min_green"], self.timing["ew_max_green"]
        elif phase in ["NL", "NR", "NLNR"]:
            return self.timing["ns_min_green"], self.timing["ns_max_green"]
        else:  # Default for all others
            return 10, 40

    def _evaluate_phase(self, phase_served: str, counts: dict) -> str:
        """Determines if the current phase should extend or change."""

        # Use the first movement in the phase as the key for checking traffic persistence
        primary_movement = (
            phase_served.split("+")[0] if "+" in phase_served else phase_served
        )

        # Determine if the queue is cleared (using primary movement as proxy)
        queue_cleared = counts.get(primary_movement, 0) == 0

        # Determine if another movement has significant demand
        demand_waiting = any(
            counts.get(m, 0) > 3 for m in self.movements if m not in primary_movement
        )

        # Get timing parameters
        min_green, max_green = self._get_phase_timing_params(phase_served)
        duration_served = time.time() - self.phase_start_time

        # --- Decision Logic ---

        # 1. Check Max Time (Safety/Fairness Override)
        if duration_served >= max_green:
            print(f"[DECISION]: MAX TIME HIT ({max_green}s). Force change.")
            return "CHANGE"

        # 2. Check Min Time (Cannot change yet)
        if duration_served < min_green:
            print(f"[DECISION]: MIN TIME ({min_green}s) not met. Holding.")
            return "HOLD"

        # 3. Check Actuated Extension Conditions
        if queue_cleared or not demand_waiting:
            # If queue is cleared OR no one is waiting on the other side
            print(
                f"[DECISION]: Queue cleared ({int(duration_served)}s). Changing phase."
            )
            return "CHANGE"

        # 4. If duration > min, queue is NOT cleared, and demand IS waiting, EXTEND
        if duration_served < max_green and not queue_cleared:
            print(
                f"[DECISION]: Queue active, extending by {self.timing['extension_interval']}s."
            )
            return "EXTEND"

        return "HOLD"  # Default safety catch

    def run_control_cycle(self):
        """
        Executes one cycle of the traffic control logic, checking if the current phase needs to change.
        """
        now = datetime.datetime.now()
        counts = self._get_queue_counts()
        duration_served = time.time() - self.phase_start_time

        # 1. Evaluate current phase status
        decision = self._evaluate_phase(self.current_phase, counts)

        if decision == "CHANGE":
            # Find the next phase with traffic demand based on priority
            priority_list = self._get_time_of_day_priority(now)
            next_phase_found = None

            # Map movement names to phase names (e.g., 'W' -> 'WE')
            # This is simplified; real logic would be more complex.
            phase_map = {
                "W": "WE",
                "E": "WE",
                "WL": "WL",
                "ER": "ER",
                "NL": "NLNR",
                "NR": "NLNR",
            }

            for movement in priority_list:
                if counts.get(movement, 0) > 0:
                    next_phase_found = phase_map.get(movement)
                    break

            if next_phase_found:
                self._set_phase(next_phase_found)
            else:
                print(
                    f"[INFO]: No traffic detected on any line. Holding current phase: {self.current_phase}."
                )
                decision = "HOLD"  # Revert decision to HOLD if no one else is waiting

        elif decision == "EXTEND":
            # The current phase remains active for the duration of the extension interval
            pass  # Phase change handled by the main loop sleep time

        elif decision == "HOLD":
            # Phase is held until min_green is met or conditions change
            pass

        # Log the state before waiting
        self.logger.log_cycle(
            now, self.current_phase, duration_served, counts, decision
        )

        # Wait for the next check interval (extension interval for actuated control)
        # We check roughly every 3 seconds to allow for extensions
        time.sleep(self.timing["extension_interval"])

    def start_simulation(self):
        """Starts the continuous traffic control simulation loop."""
        print("Starting traffic control simulation. Press Ctrl+C to stop.")
        try:
            # Set initial state (All Red -> First Green) is done in __init__
            while True:
                self.run_control_cycle()
        except KeyboardInterrupt:
            print("\nSimulation stopped by user.")
        finally:
            self.logger.close()
            # Ensure the connection is closed and lights are set to safety default
            print(
                "\n[System]: Shutting down. Turning all lights off as a final safety measure."
            )
            for tag_name in self.all_light_tags:
                self.plc.write_tag(tag_name, 0)
            self.plc.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Evansdale 2050 Traffic Controller Simulation"
    )
    parser.add_argument(
        "--rules",
        type=str,
        required=True,
        help="Path to the ruleset JSON file (e.g., rules_v1.json)",
    )
    parser.add_argument(
        "--log_name",
        type=str,
        default=f"sim_log_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
        help="Filename for the output CSV log.",
    )
    parser.add_argument(
        "--plc_ip", type=str, default="192.168.1.10", help="IP address of the Lab PLC."
    )

    args = parser.parse_args()

    # 1. Create and connect to the PLC
    my_plc = PLC(args.plc_ip)

    # Start the controller only if the PLC connection is successful OR if we are testing (driver is None)
    if my_plc.connect() or my_plc.driver is None:
        try:
            controller = TrafficController(
                plc=my_plc, rules_filepath=args.rules, log_filename=args.log_name
            )
            controller.start_simulation()
        except ValueError as e:
            print(f"FATAL ERROR: {e}")

    else:
        print("\n[System]: Could not connect to PLC. Exiting program.")
