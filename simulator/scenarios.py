"""
Cortexion Simulator — Driving Scenarios

Pre-built scenarios for testing the full pipeline without hardware.
Each scenario generates a sequence of beacon packets simulating
realistic driving patterns and events.
"""

import time
from packet_generator import VehicleSimulator, CABIN_PRESENCE_OK, CABIN_NO_MOVEMENT, CABIN_POSSIBLE_DISTRESS


def scenario_normal_drive(vehicle_id=1, duration_sec=60, hz=2):
    """Normal city driving: accelerate, cruise, slow for turns, stop at signals."""
    sim = VehicleSimulator(vehicle_id=vehicle_id, start_lat=28.6139, start_lon=77.2090, heading=45)
    dt = 1.0 / hz
    packets = []

    phases = [
        (5,  40),   # Accelerate to 40 km/h
        (15, 40),   # Cruise
        (3,  20),   # Slow for turn
        (2,  20),   # Turn
        (5,  50),   # Accelerate on main road
        (20, 50),   # Cruise
        (5,  0),    # Stop at signal
        (5,  0),    # Wait
    ]

    for phase_sec, target in phases:
        sim.set_target_speed(target)
        steps = int(phase_sec / dt)
        for _ in range(steps):
            packets.append(sim.update(dt))

    return packets


def scenario_harsh_braking(vehicle_id=1, hz=2):
    """Vehicle cruising at 60 km/h, then emergency braking."""
    sim = VehicleSimulator(vehicle_id=vehicle_id, start_lat=28.7041, start_lon=77.1025, heading=90)
    dt = 1.0 / hz
    packets = []

    # Cruise at 60
    sim.set_target_speed(60)
    for _ in range(30):
        packets.append(sim.update(dt))

    # HARSH BRAKE
    sim.trigger_harsh_brake()
    for _ in range(10):
        packets.append(sim.update(dt))

    # Resume
    sim.set_target_speed(40)
    for _ in range(20):
        packets.append(sim.update(dt))

    return packets


def scenario_driver_distress(vehicle_id=1, hz=2):
    """Vehicle stops, driver becomes unresponsive (no movement → distress flag)."""
    sim = VehicleSimulator(vehicle_id=vehicle_id, start_lat=28.5355, start_lon=77.3910, heading=0)
    dt = 1.0 / hz
    packets = []

    # Drive then stop
    sim.set_target_speed(30)
    for _ in range(20):
        packets.append(sim.update(dt))

    sim.set_target_speed(0)
    for _ in range(10):
        packets.append(sim.update(dt))

    # No movement for extended period
    sim.cabin_status = CABIN_NO_MOVEMENT
    for _ in range(20):
        packets.append(sim.update(dt))

    # Escalate to distress
    sim.trigger_distress()
    for _ in range(20):
        packets.append(sim.update(dt))

    # Recovery
    sim.clear_distress()
    for _ in range(10):
        packets.append(sim.update(dt))

    return packets


def scenario_two_vehicle_approach(hz=2):
    """Two vehicles approaching each other on the same road."""
    sim1 = VehicleSimulator(vehicle_id=1, start_lat=28.6139, start_lon=77.2000, heading=90)
    sim2 = VehicleSimulator(vehicle_id=2, start_lat=28.6139, start_lon=77.2200, heading=270)
    dt = 1.0 / hz
    packets = []

    sim1.set_target_speed(40)
    sim2.set_target_speed(35)

    for _ in range(60):
        p1 = sim1.update(dt)
        p2 = sim2.update(dt)
        packets.append(p1)
        packets.append(p2)

    return packets


SCENARIOS = {
    'normal_drive': scenario_normal_drive,
    'harsh_braking': scenario_harsh_braking,
    'driver_distress': scenario_driver_distress,
    'two_vehicle_approach': scenario_two_vehicle_approach,
}

if __name__ == '__main__':
    import sys
    name = sys.argv[1] if len(sys.argv) > 1 else 'normal_drive'
    if name not in SCENARIOS:
        print(f"Available scenarios: {', '.join(SCENARIOS.keys())}")
        sys.exit(1)

    packets = SCENARIOS[name]()
    print(f"Scenario '{name}': generated {len(packets)} packets")
