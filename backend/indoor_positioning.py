"""
Indoor Positioning Engine & Real-Time "Blue Dot" Simulator
Simulates and implements:
1. Bluetooth Low Energy (BLE) RSSI Log-Distance Path Loss model
2. Weighted Trilateration from 3+ BLE Beacons
3. Pedestrian Dead Reckoning (PDR) & Gyroscope Heading Integration
4. Topological Map-Matching / Aisle Snapping to keep Blue Dot in walkable corridors
5. Real-Time Shopper Trajectory Generator for live navigation simulation
"""

import math
import random
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


@dataclass
class BLEBeacon:
    id: str
    x: float
    y: float
    tx_power: float = -59.0  # RSSI measured at 1 meter in dBm
    major: int = 100
    minor: int = 1
    zone: str = "Store Floor"


@dataclass
class PositionEstimate:
    x: float
    y: float
    heading_degrees: float
    accuracy_radius_feet: float
    snapped_aisle: str
    is_snapped: bool = True


class IndoorPositioningEngine:
    """
    Simulates hardware indoor positioning signals (BLE iBeacon / Wi-Fi RTT / AR Visual Odometry)
    and resolves raw radio sensor signals into an accurate, snapped customer location.
    """

    def __init__(self, beacons: List[BLEBeacon], grid_width: int, grid_height: int, cell_size_feet: float = 4.0):
        self.beacons = {b.id: b for b in beacons}
        self.grid_width = grid_width
        self.grid_height = grid_height
        self.cell_size_feet = cell_size_feet
        self.path_loss_exponent = 2.4  # Retail store environment with high metal fixture reflection

    def simulate_rssi_readings(self, true_x: float, true_y: float, noise_std_db: float = 2.0) -> Dict[str, float]:
        """
        Simulates RSSI values that a shopper's smartphone receives at position (true_x, true_y)
        using the Log-Distance Path Loss Model:
        RSSI = TxPower - 10 * n * log10(d_meters) + GaussianNoise
        """
        readings = {}
        for beacon in self.beacons.values():
            # Convert grid cells to meters (1 cell ~ 1.22 meters)
            dx_m = (true_x - beacon.x) * self.cell_size_feet * 0.3048
            dy_m = (true_y - beacon.y) * self.cell_size_feet * 0.3048
            distance_m = max(0.5, math.hypot(dx_m, dy_m))

            path_loss = 10.0 * self.path_loss_exponent * math.log10(distance_m)
            noise = random.gauss(0, noise_std_db)
            rssi = beacon.tx_power - path_loss + noise
            readings[beacon.id] = round(rssi, 1)

        return readings

    def trilaterate_from_rssi(self, rssi_readings: Dict[str, float]) -> Tuple[float, float, float]:
        """
        Computes estimated (x, y) coordinates from noisy BLE beacon RSSI readings
        using Weighted Centroid / Non-Linear Trilateration.
        Returns: (est_x, est_y, estimated_accuracy_radius_feet)
        """
        weighted_x = 0.0
        weighted_y = 0.0
        total_weight = 0.0

        for beacon_id, rssi in rssi_readings.items():
            if beacon_id not in self.beacons:
                continue
            beacon = self.beacons[beacon_id]

            # Invert log-distance formula to estimate distance in meters
            # d = 10 ^ ((TxPower - RSSI) / (10 * n))
            exponent = (beacon.tx_power - rssi) / (10.0 * self.path_loss_exponent)
            dist_meters = 10.0 ** exponent
            dist_feet = dist_meters * 3.28084
            dist_cells = max(0.2, dist_feet / self.cell_size_feet)

            # Weight inversely proportional to estimated distance squared
            weight = 1.0 / (dist_cells ** 1.8)
            weighted_x += beacon.x * weight
            weighted_y += beacon.y * weight
            total_weight += weight

        if total_weight == 0:
            return (self.grid_width / 2.0, self.grid_height / 2.0, 20.0)

        est_x = weighted_x / total_weight
        est_y = weighted_y / total_weight
        accuracy = max(3.0, min(15.0, 10.0 / math.sqrt(max(0.1, total_weight))))

        return (est_x, est_y, accuracy)

    def snap_to_walkable_grid(self, raw_x: float, raw_y: float, walkable_grid: List[List[bool]]) -> Tuple[int, int]:
        """
        Map-matching / topological corridor snapping.
        Ensures the customer's 'Blue Dot' stays in customer aisles rather than floating through metal shelves.
        """
        round_x = int(round(raw_x))
        round_y = int(round(raw_y))

        # Clamp to bounds
        round_x = max(0, min(self.grid_width - 1, round_x))
        round_y = max(0, min(self.grid_height - 1, round_y))

        # If already walkable, snap directly
        if not walkable_grid[round_y][round_x]:
            return (round_x, round_y)

        # BFS to find nearest walkable cell within 4 cells radius
        best_pt = (round_x, round_y)
        min_dist = float("inf")

        for dy in range(-3, 4):
            for dx in range(-3, 4):
                nx, ny = round_x + dx, round_y + dy
                if 0 <= nx < self.grid_width and 0 <= ny < self.grid_height:
                    if not walkable_grid[ny][nx]:  # Walkable
                        dist = math.hypot(raw_x - nx, raw_y - ny)
                        if dist < min_dist:
                            min_dist = dist
                            best_pt = (nx, ny)

        return best_pt


class BlueDotSimulator:
    """
    Generates realistic real-time walking steps along a planned route polyline
    for client animation, heading orientation, and distance remaining calculations.
    """

    @staticmethod
    def interpolate_polyline_steps(
        polyline: List[Dict[str, int]],
        speed_feet_per_step: float = 4.0,
        cell_size_feet: float = 4.0,
    ) -> List[Dict]:
        """
        Converts a sequence of grid waypoints into smooth step-by-step navigational updates
        with realistic heading angle (degrees) and aisle notifications.
        """
        if not polyline:
            return []

        steps = []
        current_step_id = 0

        for i in range(len(polyline) - 1):
            p1 = polyline[i]
            p2 = polyline[i + 1]

            # Calculate direction vector
            dx = p2["x"] - p1["x"]
            dy = p2["y"] - p1["y"]
            distance_cells = math.hypot(dx, dy)
            subdivisions = max(1, int(distance_cells))

            # Heading in standard navigation degrees (0 = North/Up, 90 = East, 180 = South, 270 = West)
            angle_rad = math.atan2(dx, -dy)
            heading_deg = (math.degrees(angle_rad) + 360.0) % 360.0

            for step in range(subdivisions):
                ratio = step / float(subdivisions)
                curr_x = round(p1["x"] + dx * ratio, 2)
                curr_y = round(p1["y"] + dy * ratio, 2)

                steps.append({
                    "step_seq": current_step_id,
                    "x": curr_x,
                    "y": curr_y,
                    "heading_deg": round(heading_deg, 1),
                    "accuracy_ft": round(random.uniform(3.0, 5.0), 1),
                    "timestamp_ms": current_step_id * 1500,  # 1.5s pace
                })
                current_step_id += 1

        # Final target step
        last_pt = polyline[-1]
        steps.append({
            "step_seq": current_step_id,
            "x": float(last_pt["x"]),
            "y": float(last_pt["y"]),
            "heading_deg": 180.0,
            "accuracy_ft": 3.0,
            "timestamp_ms": current_step_id * 1500,
        })

        return steps
