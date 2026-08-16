"""
Cortexion — mmWave Sensor Simulator

Generates realistic Waveshare HMMD 24GHz mmWave sensor data
for dashboard development and testing without physical hardware.

Publishes to MQTT at 10 Hz matching the real sensor's 100ms refresh rate.
Supports multiple scenarios: person entering, stationary, leaving, empty room.

Usage:
    python mmwave_simulator.py                   # Interactive with MQTT
    python mmwave_simulator.py --dry-run          # Print to console only
    python mmwave_simulator.py --scenario walk_in  # Specific scenario
"""

import json
import math
import random
import time
import argparse
import sys

try:
    import paho.mqtt.client as mqtt
    HAS_MQTT = True
except ImportError:
    HAS_MQTT = False


# ── mmWave Sensor Constants ──────────────────────────────────────
NUM_GATES = 16
GATE_WIDTH_M = 0.70  # Each gate covers 0.70 meters
MAX_RANGE_M = NUM_GATES * GATE_WIDTH_M  # 11.2 meters
REFRESH_RATE_HZ = 10
REFRESH_INTERVAL_S = 1.0 / REFRESH_RATE_HZ


# ── Scenario Definitions ────────────────────────────────────────

def generate_empty_room():
    """No human present — baseline noise only."""
    energies = [random.randint(0, 15) for _ in range(NUM_GATES)]
    return {
        "present": False,
        "targetDistMm": 0,
        "gateEnergy": energies,
        "motionState": "none",
    }


def generate_stationary_person(distance_m=3.0, t=0):
    """Person sitting still at a fixed distance — micro-motion fluctuations."""
    gate_idx = min(int(distance_m / GATE_WIDTH_M), NUM_GATES - 1)
    energies = [random.randint(0, 20) for _ in range(NUM_GATES)]

    # Strong energy at target gate ± 1, with micro-motion fluctuation
    base_energy = 800 + int(200 * math.sin(t * 0.3))  # Breathing-like oscillation
    energies[gate_idx] = base_energy + random.randint(-50, 50)
    if gate_idx > 0:
        energies[gate_idx - 1] = int(base_energy * 0.3) + random.randint(-20, 20)
    if gate_idx < NUM_GATES - 1:
        energies[gate_idx + 1] = int(base_energy * 0.25) + random.randint(-20, 20)

    dist_mm = int(distance_m * 1000) + random.randint(-100, 100)

    return {
        "present": True,
        "targetDistMm": max(0, dist_mm),
        "gateEnergy": [max(0, min(4095, e)) for e in energies],
        "motionState": "micro_motion",
    }


def generate_walking_person(t, start_distance=8.0, end_distance=2.0, duration=10.0):
    """Person walking toward the sensor over time."""
    progress = min(t / duration, 1.0)
    current_distance = start_distance + (end_distance - start_distance) * progress
    gate_idx = min(int(current_distance / GATE_WIDTH_M), NUM_GATES - 1)

    energies = [random.randint(0, 25) for _ in range(NUM_GATES)]

    # Moving target — higher energy, broader spread
    peak_energy = 1200 + random.randint(-100, 100)
    energies[gate_idx] = peak_energy
    if gate_idx > 0:
        energies[gate_idx - 1] = int(peak_energy * 0.5) + random.randint(-30, 30)
    if gate_idx > 1:
        energies[gate_idx - 2] = int(peak_energy * 0.15) + random.randint(-10, 10)
    if gate_idx < NUM_GATES - 1:
        energies[gate_idx + 1] = int(peak_energy * 0.4) + random.randint(-30, 30)

    dist_mm = int(current_distance * 1000) + random.randint(-150, 150)

    return {
        "present": True,
        "targetDistMm": max(0, dist_mm),
        "gateEnergy": [max(0, min(4095, e)) for e in energies],
        "motionState": "moving",
    }


def generate_walking_away(t, start_distance=2.0, end_distance=9.0, duration=8.0):
    """Person walking away from the sensor."""
    progress = min(t / duration, 1.0)
    current_distance = start_distance + (end_distance - start_distance) * progress

    if progress >= 1.0:
        return generate_empty_room()

    gate_idx = min(int(current_distance / GATE_WIDTH_M), NUM_GATES - 1)
    energies = [random.randint(0, 20) for _ in range(NUM_GATES)]

    # Signal weakens as person moves away
    peak_energy = int(1200 * (1 - progress * 0.5)) + random.randint(-80, 80)
    energies[gate_idx] = peak_energy
    if gate_idx > 0:
        energies[gate_idx - 1] = int(peak_energy * 0.35)
    if gate_idx < NUM_GATES - 1:
        energies[gate_idx + 1] = int(peak_energy * 0.3)

    dist_mm = int(current_distance * 1000) + random.randint(-200, 200)

    return {
        "present": True,
        "targetDistMm": max(0, dist_mm),
        "gateEnergy": [max(0, min(4095, e)) for e in energies],
        "motionState": "moving",
    }


def generate_distress_scenario(t):
    """Person present but no movement for extended period (possible distress)."""
    distance_m = 2.5
    gate_idx = min(int(distance_m / GATE_WIDTH_M), NUM_GATES - 1)
    energies = [random.randint(0, 10) for _ in range(NUM_GATES)]

    # Very stable energy — no micro-motion variation (person not moving at all)
    base_energy = 600 + random.randint(-10, 10)
    energies[gate_idx] = base_energy
    if gate_idx > 0:
        energies[gate_idx - 1] = int(base_energy * 0.2)
    if gate_idx < NUM_GATES - 1:
        energies[gate_idx + 1] = int(base_energy * 0.15)

    return {
        "present": True,
        "targetDistMm": int(distance_m * 1000) + random.randint(-30, 30),
        "gateEnergy": [max(0, min(4095, e)) for e in energies],
        "motionState": "stationary",
    }


# ── Scenario Orchestrator ───────────────────────────────────────

SCENARIOS = {
    "empty": {"fn": lambda t: generate_empty_room(), "duration": 10, "description": "Empty room — no human"},
    "stationary": {"fn": lambda t: generate_stationary_person(3.0, t), "duration": 20, "description": "Person sitting at 3m"},
    "walk_in": {"fn": lambda t: generate_walking_person(t, 8.0, 2.0, 10.0), "duration": 12, "description": "Person walking toward sensor"},
    "walk_away": {"fn": lambda t: generate_walking_away(t, 2.0, 9.0, 8.0), "duration": 10, "description": "Person walking away"},
    "distress": {"fn": lambda t: generate_distress_scenario(t), "duration": 15, "description": "Person still — possible distress"},
}

SCENARIO_CYCLE = ["empty", "walk_in", "stationary", "walk_away", "empty", "walk_in", "distress", "walk_away"]


def build_mqtt_payload(vehicle_id, data, timestamp_ms):
    """Build the MQTT message matching backend expectations."""
    max_gate = max(range(NUM_GATES), key=lambda i: data["gateEnergy"][i])
    return {
        "vehicleId": vehicle_id,
        "present": data["present"],
        "targetDistMm": data["targetDistMm"],
        "targetDistM": round(data["targetDistMm"] / 1000.0, 2),
        "gateEnergy": data["gateEnergy"],
        "maxEnergyGate": max_gate,
        "maxEnergyGateDistM": round((max_gate + 0.5) * GATE_WIDTH_M, 2),
        "motionState": data["motionState"],
        "numGates": NUM_GATES,
        "gateWidthM": GATE_WIDTH_M,
        "timestampMs": timestamp_ms,
    }


def main():
    parser = argparse.ArgumentParser(description="Cortexion mmWave Sensor Simulator")
    parser.add_argument("--mqtt-url", default="localhost", help="MQTT broker host")
    parser.add_argument("--mqtt-port", type=int, default=1883, help="MQTT broker port")
    parser.add_argument("--vehicle-id", type=int, default=1, help="Vehicle ID")
    parser.add_argument("--scenario", choices=list(SCENARIOS.keys()), help="Run single scenario")
    parser.add_argument("--dry-run", action="store_true", help="Print to console only")
    parser.add_argument("--rate", type=float, default=REFRESH_RATE_HZ, help="Update rate in Hz")
    args = parser.parse_args()

    interval = 1.0 / args.rate

    # MQTT setup
    client = None
    if not args.dry_run:
        if not HAS_MQTT:
            print("[MMWAVE-SIM] paho-mqtt not installed — install with: pip install paho-mqtt")
            print("[MMWAVE-SIM] Running in dry-run mode")
            args.dry_run = True
        else:
            client = mqtt.Client(client_id="cortexion-mmwave-sim")
            try:
                client.connect(args.mqtt_url, args.mqtt_port, 60)
                client.loop_start()
                print(f"[MMWAVE-SIM] Connected to MQTT at {args.mqtt_url}:{args.mqtt_port}")
            except Exception as e:
                print(f"[MMWAVE-SIM] MQTT connection failed: {e}")
                print("[MMWAVE-SIM] Falling back to dry-run mode")
                args.dry_run = True
                client = None

    topic = f"v2v/{args.vehicle_id}/mmwave"
    print(f"[MMWAVE-SIM] Vehicle ID: {args.vehicle_id}")
    print(f"[MMWAVE-SIM] Topic: {topic}")
    print(f"[MMWAVE-SIM] Rate: {args.rate} Hz ({interval*1000:.0f}ms)")

    if args.scenario:
        scenarios_to_run = [args.scenario]
        print(f"[MMWAVE-SIM] Running scenario: {args.scenario}")
    else:
        scenarios_to_run = SCENARIO_CYCLE
        print(f"[MMWAVE-SIM] Running cycle: {' → '.join(scenarios_to_run)}")

    print("[MMWAVE-SIM] Streaming started (Ctrl+C to stop)\n")

    try:
        cycle_idx = 0
        while True:
            scenario_name = scenarios_to_run[cycle_idx % len(scenarios_to_run)]
            scenario = SCENARIOS[scenario_name]
            duration = scenario["duration"]
            fn = scenario["fn"]

            print(f"━━ Scenario: {scenario_name} — {scenario['description']} ({duration}s) ━━")

            t = 0
            while t < duration:
                data = fn(t)
                timestamp_ms = int(time.time() * 1000)
                payload = build_mqtt_payload(args.vehicle_id, data, timestamp_ms)

                if args.dry_run:
                    present_str = "🟢 PRESENT" if payload["present"] else "⚫ ABSENT"
                    dist_str = f"{payload['targetDistM']}m" if payload["present"] else "---"
                    max_e = max(payload["gateEnergy"])
                    print(f"  [{present_str}] dist={dist_str} motion={payload['motionState']} "
                          f"maxGate={payload['maxEnergyGate']} maxE={max_e}")
                else:
                    client.publish(topic, json.dumps(payload))

                time.sleep(interval)
                t += interval

            cycle_idx += 1

            if args.scenario:
                # Single scenario mode — loop it
                pass

    except KeyboardInterrupt:
        print("\n[MMWAVE-SIM] Stopped")
    finally:
        if client:
            client.loop_stop()
            client.disconnect()


if __name__ == "__main__":
    main()
