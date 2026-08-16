"""
Cortexion Simulator — Serial Emitter

Sends generated V2VBeacon packets to the gateway via TCP socket
(or virtual serial port). This allows full pipeline testing
without any LoRa/ESP32 hardware.

Usage:
  python serial_emitter.py --scenario normal_drive --host localhost --port 9000 --hz 2
"""

import socket
import time
import argparse
import sys

from scenarios import SCENARIOS


def emit_tcp(packets: list[bytes], host: str, port: int, hz: float):
    """Send packets to the gateway's TCP simulator listener."""
    dt = 1.0 / hz

    print(f"Connecting to {host}:{port}...")
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect((host, port))
    print(f"Connected. Emitting {len(packets)} packets at {hz} Hz...")

    try:
        for i, packet in enumerate(packets):
            sock.sendall(packet)
            if (i + 1) % 20 == 0:
                print(f"  Sent {i + 1}/{len(packets)} packets")
            time.sleep(dt)
    except (BrokenPipeError, ConnectionResetError):
        print("Connection lost")
    finally:
        sock.close()
        print(f"Done. Sent {len(packets)} packets.")


def main():
    parser = argparse.ArgumentParser(description='Cortexion LoRa Packet Emitter')
    parser.add_argument('--scenario', choices=list(SCENARIOS.keys()),
                        default='normal_drive', help='Scenario to run')
    parser.add_argument('--host', default='localhost', help='Gateway TCP host')
    parser.add_argument('--port', type=int, default=9000, help='Gateway TCP port')
    parser.add_argument('--hz', type=float, default=2.0, help='Packet rate (Hz)')
    parser.add_argument('--loop', action='store_true', help='Loop the scenario')

    args = parser.parse_args()

    print(f"Generating scenario: {args.scenario}")
    packets = SCENARIOS[args.scenario]()
    print(f"Generated {len(packets)} packets")

    if args.loop:
        while True:
            try:
                emit_tcp(packets, args.host, args.port, args.hz)
                print("Looping...")
                time.sleep(1)
            except KeyboardInterrupt:
                print("\nStopped.")
                break
    else:
        emit_tcp(packets, args.host, args.port, args.hz)


if __name__ == '__main__':
    main()
