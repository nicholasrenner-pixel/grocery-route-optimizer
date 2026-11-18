"""
Spatial Grid, A* Pathfinding, and Global TSP Route Optimizer.
Refactored to eliminate path clipping through shelves, eliminate cross-store bouncing
via Held-Karp Bitmask DP & 2-Opt TSP, and compile Google Maps-style turn-by-turn steps.
"""

import heapq
import json
import math
from typing import Dict, List, Optional, Set, Tuple

CELL_SIZE_FT = 3.0  # 1 grid cell = 3.0 ft x 3.0 ft


class StoreSpatialGrid:
    """
    Discrete 2D grid with strict collision enforcement:
    0: Walkable main corridor / perimeter racetrack (cost = 1.0)
    1: Impassable physical obstacle (shelving, counters, barriers) (cost = inf)
    2: Walkable aisle interior (cost = 1.15)
    """

    def __init__(self, cols: int, rows: int):
        self.cols = cols
        self.rows = rows
        # Initialize default as 0 (walkable main perimeter corridor)
        self.grid = [[0 for _ in range(cols)] for _ in range(rows)]
        self.obstacles: Dict[str, Dict] = {}

    def set_cell_state(self, x: int, y: int, state: int):
        if 0 <= x < self.cols and 0 <= y < self.rows:
            self.grid[y][x] = state

    def add_obstacle_box(self, obs_id: str, x: int, y: int, w: int, h: int, label: str):
        self.obstacles[obs_id] = {"x": x, "y": y, "width": w, "height": h, "label": label}
        for cy in range(y, min(self.rows, y + h)):
            for cx in range(x, min(self.cols, x + w)):
                self.grid[cy][cx] = 1  # Strictly impassable

    def mark_aisle_interior(self, x_start: int, x_end: int, y_start: int, y_end: int):
        """Mark walkable customer aisle corridors with cost = 1.15 (state = 2)."""
        for cy in range(y_start, min(self.rows, y_end + 1)):
            for cx in range(x_start, min(self.cols, x_end + 1)):
                if self.grid[cy][cx] != 1:  # Only if not an obstacle
                    self.grid[cy][cx] = 2

    def is_walkable(self, x: int, y: int) -> bool:
        if 0 <= x < self.cols and 0 <= y < self.rows:
            return self.grid[y][x] != 1
        return False

    def get_movement_cost(self, x: int, y: int) -> float:
        if not self.is_walkable(x, y):
            return float("inf")
        # 0: main corridor (1.0), 2: aisle interior (1.15)
        return 1.15 if self.grid[y][x] == 2 else 1.0


class AStarRouter:
    """
    4-Directional Orthogonal A* Pathfinding ONLY.
    Disables diagonal movements completely to prevent shelf-corner clipping.
    """

    # Up, Down, Left, Right ONLY (Orthogonal)
    ORTHOGONAL_DIRECTIONS = [(0, 1), (0, -1), (1, 0), (-1, 0)]

    def __init__(self, spatial_grid: StoreSpatialGrid):
        self.spatial_grid = spatial_grid

    def find_shortest_path(self, start: Tuple[int, int], goal: Tuple[int, int]) -> Tuple[List[Tuple[int, int]], float]:
        """
        Computes the strictly obstacle-free shortest path from start to goal.
        Returns: (List of (x, y) coordinates, total distance in feet)
        """
        sx, sy = start
        gx, gy = goal

        if not self.spatial_grid.is_walkable(sx, sy) or not self.spatial_grid.is_walkable(gx, gy):
            raise ValueError(f"Start ({sx},{sy}) or Goal ({gx},{gy}) is on an impassable obstacle!")

        if start == goal:
            return [start], 0.0

        # Priority queue holds: (f_score, tie_breaker, current_node)
        open_set = []
        counter = 0
        heapq.heappush(open_set, (0.0, counter, start))

        came_from: Dict[Tuple[int, int], Tuple[int, int]] = {}
        g_score: Dict[Tuple[int, int], float] = {start: 0.0}

        def heuristic(p1: Tuple[int, int], p2: Tuple[int, int]) -> float:
            # Manhattan distance (4-directional)
            return (abs(p1[0] - p2[0]) + abs(p1[1] - p2[1])) * 1.0

        closed_set: Set[Tuple[int, int]] = set()

        while open_set:
            _, _, current = heapq.heappop(open_set)

            if current == goal:
                # Reconstruct path
                path = [current]
                while current in came_from:
                    current = came_from[current]
                    path.append(current)
                path.reverse()
                total_distance_ft = (len(path) - 1) * CELL_SIZE_FT
                return path, total_distance_ft

            if current in closed_set:
                continue
            closed_set.add(current)

            cx, cy = current
            current_g = g_score[current]

            for dx, dy in self.ORTHOGONAL_DIRECTIONS:
                nx, ny = cx + dx, cy + dy
                neighbor = (nx, ny)

                if not self.spatial_grid.is_walkable(nx, ny) or neighbor in closed_set:
                    continue

                step_cost = self.spatial_grid.get_movement_cost(nx, ny)
                tentative_g = current_g + step_cost

                if tentative_g < g_score.get(neighbor, float("inf")):
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g
                    f_score = tentative_g + heuristic(neighbor, goal)
                    counter += 1
                    heapq.heappush(open_set, (f_score, counter, neighbor))

        raise RuntimeError(f"No walkable path exists between {start} and {goal}!")


class GlobalTSPOptimizer:
    """
    Open-Ended Traveling Salesperson Problem Solver:
    Origin: Entrance (E)
    Stops: Cart Items {I_1, ..., I_N}
    Destination: Checkout (C)
    
    Algorithms:
    - Held-Karp Bitmask Dynamic Programming for N <= 15 (Exact Global Optimum, No Bouncing)
    - 2-Opt Local Search for N > 15
    - Perishables Weighting Toggle (Perishables Last)
    """

    def __init__(self, astar: AStarRouter):
        self.astar = astar

    def solve(
        self,
        start_coord: Tuple[int, int],
        checkout_coord: Tuple[int, int],
        items: List[Dict],
        perishables_last: bool = True,
    ) -> Dict:
        if not items:
            path, dist = self.astar.find_shortest_path(start_coord, checkout_coord)
            return {
                "ordered_stops": [],
                "polyline_coords": [list(pt) for pt in path],
                "total_distance_ft": round(dist),
            }

        if perishables_last:
            # Partition items into non-perishable (visited first) and perishable (visited last before checkout)
            non_perishables = [it for it in items if not it.get("is_perishable", False)]
            perishables = [it for it in items if it.get("is_perishable", False)]

            ordered_stops = []
            curr_pos = start_coord

            if non_perishables:
                # Target is centroid of perishables, or checkout if no perishables
                target_terminal = checkout_coord if not perishables else tuple(perishables[0]["access_coord"])
                ordered_np = self._solve_partition_tsp(curr_pos, target_terminal, non_perishables)
                ordered_stops.extend(ordered_np)
                if ordered_np:
                    curr_pos = tuple(ordered_np[-1]["access_coord"])

            if perishables:
                ordered_p = self._solve_partition_tsp(curr_pos, checkout_coord, perishables)
                ordered_stops.extend(ordered_p)
        else:
            ordered_stops = self._solve_partition_tsp(start_coord, checkout_coord, items)

        # Assemble full continuous polyline
        full_polyline: List[Tuple[int, int]] = []
        waypoint_nodes = [start_coord] + [tuple(it["access_coord"]) for it in ordered_stops] + [checkout_coord]

        total_distance_ft = 0.0
        for i in range(len(waypoint_nodes) - 1):
            segment_path, seg_dist = self.astar.find_shortest_path(waypoint_nodes[i], waypoint_nodes[i + 1])
            total_distance_ft += seg_dist
            if full_polyline:
                full_polyline.extend(segment_path[1:])
            else:
                full_polyline.extend(segment_path)

        # Assign stop numbers
        for idx, stop in enumerate(ordered_stops):
            stop["stop_number"] = idx + 1

        return {
            "ordered_stops": ordered_stops,
            "polyline_coords": [list(pt) for pt in full_polyline],
            "total_distance_ft": round(total_distance_ft),
        }

    def _solve_partition_tsp(
        self,
        start_coord: Tuple[int, int],
        end_coord: Tuple[int, int],
        items: List[Dict],
    ) -> List[Dict]:
        n = len(items)
        if n <= 1:
            return list(items)

        # Build distance matrix for this partition
        # Nodes: 0 is Start, 1..n are Items, n+1 is End
        all_coords = [start_coord] + [tuple(it["access_coord"]) for it in items] + [end_coord]
        total_nodes = len(all_coords)

        dist_matrix = [[0.0 for _ in range(total_nodes)] for _ in range(total_nodes)]
        for i in range(total_nodes):
            for j in range(i + 1, total_nodes):
                _, d = self.astar.find_shortest_path(all_coords[i], all_coords[j])
                dist_matrix[i][j] = d
                dist_matrix[j][i] = d

        if n <= 15:
            # EXACT HELD-KARP DYNAMIC PROGRAMMING WITH BITMASKS
            return self._held_karp_dp(items, dist_matrix, n)
        else:
            # 2-OPT LOCAL SEARCH
            return self._two_opt_tsp(items, dist_matrix, n)

    def _held_karp_dp(self, items: List[Dict], dist: List[List[float]], n: int) -> List[Dict]:
        """
        Exact Held-Karp open-ended TSP:
        Start is node 0. Items are 1..n. End is node n+1.
        dp[mask][j] = minimum distance to visit subset 'mask' of items ending at item 'j' (1-indexed).
        """
        num_masks = 1 << n
        dp = {}
        parent = {}

        # Base case: start at 0, visit first item i
        for i in range(1, n + 1):
            mask = 1 << (i - 1)
            dp[(mask, i)] = dist[0][i]
            parent[(mask, i)] = None

        # Iterate through all subset sizes
        for size in range(2, n + 1):
            for mask in range(1, num_masks):
                if bin(mask).count("1") != size:
                    continue
                for j in range(1, n + 1):
                    if not (mask & (1 << (j - 1))):
                        continue
                    prev_mask = mask ^ (1 << (j - 1))
                    best_cost = float("inf")
                    best_prev = None

                    for i in range(1, n + 1):
                        if i == j or not (prev_mask & (1 << (i - 1))):
                            continue
                        if (prev_mask, i) in dp:
                            cost = dp[(prev_mask, i)] + dist[i][j]
                            if cost < best_cost:
                                best_cost = cost
                                best_prev = i

                    if best_prev is not None:
                        dp[(mask, j)] = best_cost
                        parent[(mask, j)] = best_prev

        # Terminal step: connect final item j to end node (n + 1)
        full_mask = (1 << n) - 1
        best_terminal = None
        min_total_cost = float("inf")

        for j in range(1, n + 1):
            if (full_mask, j) in dp:
                total_cost = dp[(full_mask, j)] + dist[j][n + 1]
                if total_cost < min_total_cost:
                    min_total_cost = total_cost
                    best_terminal = j

        # Reconstruct path backwards
        ordered_indices = []
        curr = best_terminal
        curr_mask = full_mask

        while curr is not None:
            ordered_indices.append(curr)
            prev = parent.get((curr_mask, curr))
            curr_mask = curr_mask ^ (1 << (curr - 1))
            curr = prev

        ordered_indices.reverse()
        return [items[idx - 1] for idx in ordered_indices]

    def _two_opt_tsp(self, items: List[Dict], dist: List[List[float]], n: int) -> List[Dict]:
        """Greedy nearest-neighbor initialization followed by 2-Opt local search."""
        unvisited = list(range(1, n + 1))
        order = []
        curr = 0

        while unvisited:
            best_idx = 0
            best_d = float("inf")
            for idx, candidate in enumerate(unvisited):
                d = dist[curr][candidate]
                if d < best_d:
                    best_d = d
                    best_idx = idx
            chosen = unvisited.pop(best_idx)
            order.append(chosen)
            curr = chosen

        improved = True
        iterations = 0
        while improved and iterations < 50:
            improved = False
            iterations += 1
            for i in range(len(order) - 1):
                for k in range(i + 1, len(order)):
                    # Compute delta
                    prev_node = 0 if i == 0 else order[i - 1]
                    next_node = n + 1 if k == len(order) - 1 else order[k + 1]

                    current_cost = dist[prev_node][order[i]] + dist[order[k]][next_node]
                    new_cost = dist[prev_node][order[k]] + dist[order[i]][next_node]

                    if new_cost < current_cost - 0.05:
                        order[i : k + 1] = reversed(order[i : k + 1])
                        improved = True

        return [items[idx - 1] for idx in order]


class TurnByTurnCompiler:
    """
    Compresses collinear coordinate paths into straight legs, detects 90-degree turn
    cross-products, computes shelf arrival side, and compiles human-readable instructions.
    """

    @staticmethod
    def compile_instructions(
        polyline: List[List[int]],
        ordered_stops: List[Dict],
        aisles_list: List[Dict],
    ) -> List[Dict]:
        if len(polyline) < 2:
            return []

        # Step 1: Compress collinear waypoints into straight legs
        compressed_legs = []
        curr_start = polyline[0]
        dx = polyline[1][0] - polyline[0][0]
        dy = polyline[1][1] - polyline[0][1]
        current_dir = (dx, dy)
        accum_cells = 1

        for i in range(1, len(polyline) - 1):
            next_dx = polyline[i + 1][0] - polyline[i][0]
            next_dy = polyline[i + 1][1] - polyline[i][1]
            next_dir = (next_dx, next_dy)

            if next_dir == current_dir:
                accum_cells += 1
            else:
                compressed_legs.append({
                    "start": curr_start,
                    "end": polyline[i],
                    "dir": current_dir,
                    "cells": accum_cells,
                })
                curr_start = polyline[i]
                current_dir = next_dir
                accum_cells = 1

        # Last leg
        compressed_legs.append({
            "start": curr_start,
            "end": polyline[-1],
            "dir": current_dir,
            "cells": accum_cells,
        })

        # Map stop access coordinates to their stop items
        access_to_stop = {}
        for stop in ordered_stops:
            access_to_stop[tuple(stop["access_coord"])] = stop

        # Step 2: Generate Turn-by-Turn Steps
        navigation_steps = []
        prev_dir = None

        for idx, leg in enumerate(compressed_legs):
            dir_vec = leg["dir"]
            dist_ft = round(leg["cells"] * CELL_SIZE_FT)
            start_coord = leg["start"]
            end_coord = leg["end"]

            # Determine Maneuver (STRAIGHT, TURN_LEFT, TURN_RIGHT, ARRIVE)
            if prev_dir is None:
                maneuver = "STRAIGHT"
            else:
                # Cross product: cross = dx1 * dy2 - dy1 * dx2
                cross = prev_dir[0] * dir_vec[1] - prev_dir[1] * dir_vec[0]
                if cross > 0:
                    maneuver = "TURN_RIGHT"
                elif cross < 0:
                    maneuver = "TURN_LEFT"
                else:
                    maneuver = "STRAIGHT"

            # Check if an item is located at or along this leg
            target_stop = access_to_stop.get(tuple(end_coord))
            target_stop_num = target_stop["stop_number"] if target_stop else None

            # Corridor name resolution
            corridor_name = TurnByTurnCompiler._resolve_corridor_name(end_coord, aisles_list)

            # Build human-readable instruction string
            if target_stop:
                # Compute shelf side relative to arrival walking direction
                shelf_side = TurnByTurnCompiler._compute_shelf_side(dir_vec, target_stop["access_coord"], target_stop["shelf_coord"])
                if maneuver == "STRAIGHT":
                    instruction = f"Head straight for {dist_ft} ft down {corridor_name} — {target_stop['name']} is on your {shelf_side}"
                else:
                    turn_str = "turn right" if maneuver == "TURN_RIGHT" else "turn left"
                    instruction = f"In {dist_ft} ft, {turn_str} into {corridor_name} — {target_stop['name']} on your {shelf_side}"
            elif idx == len(compressed_legs) - 1:
                maneuver = "ARRIVE"
                instruction = f"Proceed {dist_ft} ft to Front Registers and Checkout"
            else:
                if maneuver == "STRAIGHT":
                    instruction = f"Continue straight along {corridor_name} for {dist_ft} ft"
                else:
                    turn_str = "turn right" if maneuver == "TURN_RIGHT" else "turn left"
                    instruction = f"{turn_str.capitalize()} into {corridor_name} and continue for {dist_ft} ft"

            navigation_steps.append({
                "step_index": idx,
                "maneuver": maneuver,
                "instruction": instruction,
                "distance_ft": dist_ft,
                "start_coord": start_coord,
                "end_coord": end_coord,
                "target_stop_number": target_stop_num,
            })

            prev_dir = dir_vec

        return navigation_steps

    @staticmethod
    def _compute_shelf_side(
        walking_dir: Tuple[int, int],
        access_coord: List[int],
        shelf_coord: List[int],
    ) -> str:
        """
        Cross-product of walking vector and access-to-shelf vector.
        cross > 0 -> Shelf is to the right
        cross < 0 -> Shelf is to the left
        """
        vx, vy = walking_dir
        sx = shelf_coord[0] - access_coord[0]
        sy = shelf_coord[1] - access_coord[1]

        cross = vx * sy - vy * sx
        return "right" if cross > 0 else "left"

    @staticmethod
    def _resolve_corridor_name(coord: List[int], aisles_list: List[Dict]) -> str:
        x, y = coord
        for aisle in aisles_list:
            if aisle["x_start"] - 1 <= x <= aisle["x_end"] + 1 and aisle["y_start"] - 1 <= y <= aisle["y_end"] + 1:
                return aisle["id"]
        if y < 8:
            return "Back Fresh Perimeter"
        elif y > 28:
            return "Front Main Aisle"
        return "Center Cross Aisle"


def load_store_system(json_path: str) -> Tuple[StoreSpatialGrid, Dict[str, Dict], Dict, Dict, List[Dict]]:
    """Loads store_data.json and initializes the collision grid and catalog."""
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    dims = data["store_metadata"]["grid_dimensions"]
    grid = StoreSpatialGrid(cols=dims["cols"], rows=dims["rows"])

    # 1. Mark obstacles (shelves, barriers, counters)
    for obs in data.get("obstacles", []):
        grid.add_obstacle_box(
            obs_id=obs["id"],
            x=obs["x"],
            y=obs["y"],
            w=obs["width"],
            h=obs["height"],
            label=obs.get("label", ""),
        )

    # 2. Mark aisle interior walk paths (state = 2, cost = 1.15)
    for aisle in data.get("aisles", []):
        grid.mark_aisle_interior(
            x_start=aisle["x_start"] - 1,
            x_end=aisle["x_end"] + 1,
            y_start=aisle["y_start"],
            y_end=aisle["y_end"],
        )

    # 3. Catalog items
    items_by_id = {item["item_id"]: item for item in data.get("items", [])}
    entrance = data["entrance"]
    checkout = data["checkout"]
    aisles = data.get("aisles", [])

    return grid, items_by_id, entrance, checkout, aisles
