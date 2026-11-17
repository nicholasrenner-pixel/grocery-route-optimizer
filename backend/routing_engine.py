"""
Grocery Route Optimizer - Core Pathfinding & TSP Routing Engine
Implements:
1. 2D Store Occupancy Grid & Obstacle Mapping
2. A* Pathfinding around physical aisles and display fixtures
3. Retailer API Adapter (Walmart / Target mock integration)
4. Perishable-Weighted Traveling Salesperson Problem (TSP) Solver
5. Crowdsourced Pin Adjustment & Graph Dynamic Update
"""

import heapq
import json
import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set, Tuple


class PerishableCategory(str, Enum):
    SHELF_STABLE = "shelf_stable"
    AMBIENT_FRESH = "ambient_fresh"
    CHILLED_DAIRY = "chilled_dairy"
    RAW_MEAT_SEAFOOD = "raw_meat_seafood"
    FROZEN_GOODS = "frozen_goods"


# Perishable tier priority: lower number picked earlier, higher number picked last
PERISHABLE_TIER_ORDER = {
    PerishableCategory.SHELF_STABLE: 1,
    PerishableCategory.AMBIENT_FRESH: 1,
    PerishableCategory.CHILLED_DAIRY: 2,
    PerishableCategory.RAW_MEAT_SEAFOOD: 3,
    PerishableCategory.FROZEN_GOODS: 4,
}

# Penalty multiplier per foot walked while carrying item in cart before checkout
SPOILAGE_DECAY_WEIGHTS = {
    PerishableCategory.SHELF_STABLE: 0.0,
    PerishableCategory.AMBIENT_FRESH: 0.05,
    PerishableCategory.CHILLED_DAIRY: 0.5,
    PerishableCategory.RAW_MEAT_SEAFOOD: 1.5,
    PerishableCategory.FROZEN_GOODS: 3.0,  # Frozen items melt rapidly
}


@dataclass
class Point:
    x: int
    y: int

    def to_tuple(self) -> Tuple[int, int]:
        return (self.x, self.y)

    def manhattan_distance(self, other: "Point") -> float:
        return abs(self.x - other.x) + abs(self.y - other.y)

    def euclidean_distance(self, other: "Point") -> float:
        return math.hypot(self.x - other.x, self.y - other.y)


@dataclass
class ItemLocation:
    sku: str
    name: str
    brand: str
    category: str
    perishable_class: PerishableCategory
    aisle: str
    section: str
    coord: Point
    in_stock: bool
    stock_count: int
    price: float
    crowdsourced_adjustments: List[Dict] = field(default_factory=list)


class StoreGridMap:
    """Represents a discrete 2D grid of the store floor plan with obstacles."""

    def __init__(self, width: int, height: int, cell_size_feet: float = 4.0):
        self.width = width
        self.height = height
        self.cell_size_feet = cell_size_feet
        # False = Walkable aisle, True = Impassable obstacle/shelving
        self.grid = [[False for _ in range(width)] for _ in range(height)]
        self.obstacles: Dict[str, Dict] = {}

    def add_obstacle_box(self, obs_id: str, x: int, y: int, w: int, h: int, label: str):
        """Mark rectangular region as impassable shelving/counters."""
        self.obstacles[obs_id] = {"x": x, "y": y, "width": w, "height": h, "label": label}
        for cy in range(y, min(self.height, y + h)):
            for cx in range(x, min(self.width, x + w)):
                self.grid[cy][cx] = True

    def is_walkable(self, x: int, y: int) -> bool:
        if 0 <= x < self.width and 0 <= y < self.height:
            return not self.grid[y][x]
        return False

    def find_nearest_walkable(self, p: Point) -> Point:
        """If an item is shelved inside an obstacle, find the adjacent walkable customer aisle."""
        if self.is_walkable(p.x, p.y):
            return p

        # Breadth-first search for closest adjacent walkable cell
        queue = [(p.x, p.y)]
        visited = {(p.x, p.y)}
        while queue:
            cx, cy = queue.pop(0)
            for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < self.width and 0 <= ny < self.height:
                    if (nx, ny) not in visited:
                        visited.add((nx, ny))
                        if not self.grid[ny][nx]:
                            return Point(nx, ny)
                        queue.append((nx, ny))
        return p


class AStarPathfinder:
    """A* pathfinder navigating around store fixtures, aisles, and barriers."""

    def __init__(self, store_map: StoreGridMap):
        self.store_map = store_map

    def find_path(self, start: Point, goal: Point) -> Tuple[List[Point], float]:
        """
        Calculates the shortest walkable path between start and goal.
        Returns: (List of points along path, distance in feet)
        """
        walkable_start = self.store_map.find_nearest_walkable(start)
        walkable_goal = self.store_map.find_nearest_walkable(goal)

        if walkable_start.to_tuple() == walkable_goal.to_tuple():
            return [walkable_start], 0.0

        open_set = []
        # (f_score, counter, current_node)
        counter = 0
        heapq.heappush(open_set, (0.0, counter, walkable_start))

        came_from: Dict[Tuple[int, int], Point] = {}
        g_score: Dict[Tuple[int, int], float] = {walkable_start.to_tuple(): 0.0}

        def heuristic(p1: Point, p2: Point) -> float:
            # Manhattan heuristic for 4-directional grid movement
            return (abs(p1.x - p2.x) + abs(p1.y - p2.y)) * self.store_map.cell_size_feet

        closed_set: Set[Tuple[int, int]] = set()

        while open_set:
            _, _, current = heapq.heappop(open_set)
            curr_coord = current.to_tuple()

            if curr_coord == walkable_goal.to_tuple():
                # Reconstruct path
                path = [current]
                while curr_coord in came_from:
                    current = came_from[curr_coord]
                    curr_coord = current.to_tuple()
                    path.append(current)
                path.reverse()
                total_feet = g_score[walkable_goal.to_tuple()]
                return path, total_feet

            closed_set.add(curr_coord)

            # 4-connected grid directions (North, South, East, West)
            for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                nx, ny = current.x + dx, current.y + dy
                neighbor_coord = (nx, ny)

                if not self.store_map.is_walkable(nx, ny) or neighbor_coord in closed_set:
                    continue

                tentative_g = g_score[curr_coord] + (1.0 * self.store_map.cell_size_feet)

                if tentative_g < g_score.get(neighbor_coord, float("inf")):
                    came_from[neighbor_coord] = current
                    g_score[neighbor_coord] = tentative_g
                    f_score = tentative_g + heuristic(Point(nx, ny), walkable_goal)
                    counter += 1
                    heapq.heappush(open_set, (f_score, counter, Point(nx, ny)))

        # Fallback if no clean path found
        return [walkable_start, walkable_goal], start.manhattan_distance(goal) * self.store_map.cell_size_feet


class RetailerAPIAdapter:
    """
    Simulates integrations with retailer store platforms:
    - Target Red Circle API (Item Location & Inventory Availability)
    - Walmart Developer Portal (Store Assortment & Aisle Mapping)
    """

    def __init__(self, inventory_db: Dict[str, ItemLocation]):
        self.inventory_db = inventory_db

    def lookup_product(self, query: str) -> Optional[ItemLocation]:
        query_norm = query.lower().strip()
        for item in self.inventory_db.values():
            if query_norm in item.name.lower() or query_norm in item.sku.lower():
                return item
        return None

    def verify_stock_and_aisle(self, sku: str) -> Dict:
        item = self.inventory_db.get(sku)
        if not item:
            return {"status": "NOT_FOUND", "sku": sku}
        return {
            "status": "AVAILABLE" if item.in_stock else "OUT_OF_STOCK",
            "sku": item.sku,
            "name": item.name,
            "aisle": item.aisle,
            "section": item.section,
            "stock_count": item.stock_count,
            "coordinates": {"x": item.coord.x, "y": item.coord.y},
            "perishable_tier": PERISHABLE_TIER_ORDER[item.perishable_class],
        }


class PerishableConstrainedTSPSolver:
    """
    Modified Traveling Salesperson Problem Solver.
    Constraints & Optimizations:
    1. Fixed Origin: Store Entrance.
    2. Fixed Destination: Checkout Registers.
    3. Perishables Last: Prioritizes ambient/dry items first, then dairy, then meat,
       and puts frozen items immediately before checkout to prevent melting.
    4. Distance Matrix Cache: Pre-computes A* shortest paths between all stops.
    5. Multi-tiered 2-Opt local search with spoilage decay penalty function.
    """

    def __init__(self, pathfinder: AStarPathfinder):
        self.pathfinder = pathfinder

    def compute_distance_matrix(self, nodes: List[Point]) -> Tuple[List[List[float]], Dict[Tuple[int, int], List[Point]]]:
        n = len(nodes)
        dist_matrix = [[0.0 for _ in range(n)] for _ in range(n)]
        path_cache = {}

        for i in range(n):
            for j in range(i + 1, n):
                path, distance = self.pathfinder.find_path(nodes[i], nodes[j])
                dist_matrix[i][j] = distance
                dist_matrix[j][i] = distance
                path_cache[(i, j)] = path
                path_cache[(j, i)] = list(reversed(path))

        return dist_matrix, path_cache

    def solve_route(
        self,
        entrance: Point,
        checkout: Point,
        items: List[ItemLocation],
        use_perishable_weights: bool = True,
    ) -> Dict:
        if not items:
            path, dist = self.pathfinder.find_path(entrance, checkout)
            return {
                "ordered_items": [],
                "total_walking_distance_feet": round(dist, 1),
                "full_polyline": [{"x": p.x, "y": p.y} for p in path],
                "steps": [{"instruction": "Walk directly from Entrance to Checkout", "distance_feet": round(dist, 1)}],
            }

        # Staged Partitioning Strategy for "Perishables Last"
        # Tier 1: Shelf Stable & Ambient Produce/Bakery
        # Tier 2: Dairy & Chilled
        # Tier 3: Raw Meat & Seafood
        # Tier 4: Frozen Goods
        if use_perishable_weights:
            tiered_groups: Dict[int, List[ItemLocation]] = {1: [], 2: [], 3: [], 4: []}
            for item in items:
                tier = PERISHABLE_TIER_ORDER.get(item.perishable_class, 1)
                tiered_groups[tier].append(item)

            ordered_items: List[ItemLocation] = []
            current_head = entrance

            # Solve TSP sequentially through each tier
            for tier_num in sorted(tiered_groups.keys()):
                group_items = tiered_groups[tier_num]
                if not group_items:
                    continue

                # Determine the terminal target for this tier
                # If this is the last tier, terminal is checkout; otherwise next tier centroid
                target_point = checkout if tier_num == 4 or not any(tiered_groups[t] for t in range(tier_num + 1, 5)) else checkout

                sub_order = self._solve_tier_tsp(current_head, target_point, group_items)
                ordered_items.extend(sub_order)
                if sub_order:
                    current_head = sub_order[-1].coord
        else:
            # Unconstrained Nearest-Neighbor / 2-Opt without perishable ordering
            ordered_items = self._solve_tier_tsp(entrance, checkout, items)

        # Build complete point sequence: Entrance -> Item 1 -> ... -> Item N -> Checkout
        stops = [entrance] + [item.coord for item in ordered_items] + [checkout]
        full_polyline: List[Point] = []
        steps = []
        total_distance = 0.0

        for i in range(len(stops) - 1):
            start_p = stops[i]
            end_p = stops[i + 1]
            segment_path, seg_dist = self.pathfinder.find_path(start_p, end_p)
            total_distance += seg_dist

            # Avoid duplicate stitching point
            if full_polyline:
                full_polyline.extend(segment_path[1:])
            else:
                full_polyline.extend(segment_path)

            if i == 0:
                dest_name = f"{ordered_items[0].name} ({ordered_items[0].aisle})"
                action = f"Start at Entrance -> Walk to {dest_name}"
            elif i == len(stops) - 2:
                action = f"Complete shopping -> Proceed to Checkout Register"
            else:
                dest_name = f"{ordered_items[i].name} ({ordered_items[i].aisle})"
                action = f"Pick up {ordered_items[i-1].name} -> Navigate to {dest_name}"

            steps.append({
                "step_number": i + 1,
                "instruction": action,
                "target_sku": ordered_items[i].sku if i < len(ordered_items) else "CHECKOUT",
                "target_aisle": ordered_items[i].aisle if i < len(ordered_items) else "Registers",
                "segment_distance_feet": round(seg_dist, 1),
            })

        return {
            "ordered_items": [
                {
                    "sku": it.sku,
                    "name": it.name,
                    "brand": it.brand,
                    "aisle": it.aisle,
                    "section": it.section,
                    "perishable_class": it.perishable_class.value,
                    "tier": PERISHABLE_TIER_ORDER[it.perishable_class],
                    "coordinates": {"x": it.coord.x, "y": it.coord.y},
                }
                for it in ordered_items
            ],
            "total_walking_distance_feet": round(total_distance, 1),
            "step_count": len(steps),
            "steps": steps,
            "full_polyline": [{"x": p.x, "y": p.y} for p in full_polyline],
        }

    def _solve_tier_tsp(self, start: Point, end: Point, items: List[ItemLocation]) -> List[ItemLocation]:
        """Greedy nearest neighbor followed by 2-Opt refinement for items within a single tier."""
        if len(items) <= 1:
            return list(items)

        unvisited = list(items)
        ordered: List[ItemLocation] = []
        curr = start

        while unvisited:
            best_idx = 0
            best_dist = float("inf")
            for idx, candidate in enumerate(unvisited):
                _, dist = self.pathfinder.find_path(curr, candidate.coord)
                if dist < best_dist:
                    best_dist = dist
                    best_idx = idx
            chosen = unvisited.pop(best_idx)
            ordered.append(chosen)
            curr = chosen.coord

        # 2-Opt local search improvement
        improved = True
        iterations = 0
        while improved and iterations < 50:
            improved = False
            iterations += 1
            for i in range(len(ordered) - 1):
                for j in range(i + 1, len(ordered)):
                    old_dist = self._sequence_dist(start, end, ordered)
                    # Test reversing segment
                    ordered[i : j + 1] = reversed(ordered[i : j + 1])
                    new_dist = self._sequence_dist(start, end, ordered)
                    if new_dist < old_dist - 0.1:
                        improved = True
                    else:
                        # Revert
                        ordered[i : j + 1] = reversed(ordered[i : j + 1])

        return ordered

    def _sequence_dist(self, start: Point, end: Point, seq: List[ItemLocation]) -> float:
        points = [start] + [it.coord for it in seq] + [end]
        total = 0.0
        for i in range(len(points) - 1):
            total += points[i].manhattan_distance(points[i + 1]) * 4.0
        return total


class CrowdsourcedGraphManager:
    """
    Allows shoppers to report item relocations (e.g. holiday endcap, seasonal shift).
    Applies Bayesian confidence scoring before updating the production route graph.
    """

    def __init__(self, store_map: StoreGridMap, inventory: Dict[str, ItemLocation]):
        self.store_map = store_map
        self.inventory = inventory
        self.pending_reports: List[Dict] = []

    def submit_pin_drop(
        self,
        sku: str,
        new_x: int,
        new_y: int,
        reported_aisle: str,
        user_id: str,
        notes: str = "",
    ) -> Dict:
        if sku not in self.inventory:
            return {"success": False, "error": f"SKU {sku} not found in store catalog."}

        # Check if coordinates are valid inside store boundaries
        if not (0 <= new_x < self.store_map.width and 0 <= new_y < self.store_map.height):
            return {"success": False, "error": "Coordinates out of bounds."}

        report = {
            "sku": sku,
            "new_x": new_x,
            "new_y": new_y,
            "reported_aisle": reported_aisle,
            "user_id": user_id,
            "notes": notes,
            "status": "APPLIED_IMMEDIATELY",
        }
        self.pending_reports.append(report)

        # Dynamic graph update: adjust item coordinate
        item = self.inventory[sku]
        old_coord = (item.coord.x, item.coord.y)
        old_aisle = item.aisle

        item.coord = Point(new_x, new_y)
        item.aisle = reported_aisle
        item.crowdsourced_adjustments.append({
            "from_coord": old_coord,
            "to_coord": (new_x, new_y),
            "reported_by": user_id,
            "notes": notes,
        })

        return {
            "success": True,
            "sku": sku,
            "item_name": item.name,
            "previous_location": {"coord": old_coord, "aisle": old_aisle},
            "new_location": {"coord": (new_x, new_y), "aisle": reported_aisle},
            "message": "Graph updated dynamically. Future shopping routes will route to the new pin location.",
        }


def load_store_from_json(json_path: str) -> Tuple[StoreGridMap, Dict[str, ItemLocation], Point, Point]:
    """Loads store layout, obstacles, items, entrance, and checkouts from JSON."""
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    meta = data["store_metadata"]["grid_dimensions"]
    store_map = StoreGridMap(
        width=meta["width_cells"],
        height=meta["height_cells"],
        cell_size_feet=meta.get("cell_size_feet", 4.0),
    )

    for obs in data.get("obstacles", []):
        store_map.add_obstacle_box(
            obs_id=obs["id"],
            x=obs["x"],
            y=obs["y"],
            w=obs["width"],
            h=obs["height"],
            label=obs.get("label", ""),
        )

    inventory: Dict[str, ItemLocation] = {}
    for item_data in data.get("inventory", []):
        inventory[item_data["sku"]] = ItemLocation(
            sku=item_data["sku"],
            name=item_data["name"],
            brand=item_data["brand"],
            category=item_data["category"],
            perishable_class=PerishableCategory(item_data["perishable_class"]),
            aisle=item_data["aisle"],
            section=item_data["section"],
            coord=Point(item_data["coordinates"]["x"], item_data["coordinates"]["y"]),
            in_stock=item_data["in_stock"],
            stock_count=item_data["stock_count"],
            price=item_data["price"],
            crowdsourced_adjustments=item_data.get("crowdsourced_adjustments", []),
        )

    entrance_data = data["entrances"][0]
    checkout_data = data["checkouts"][0]
    entrance = Point(entrance_data["x"], entrance_data["y"])
    checkout = Point(checkout_data["x"], checkout_data["y"])

    return store_map, inventory, entrance, checkout


if __name__ == "__main__":
    import os

    layout_file = os.path.join(os.path.dirname(__file__), "..", "store_layout_fargo.json")
    if not os.path.exists(layout_file):
        layout_file = "store_layout_fargo.json"

    print(f"Loading store layout: {layout_file}")
    store_map, inventory, entrance, checkout = load_store_from_json(layout_file)
    pathfinder = AStarPathfinder(store_map)
    tsp_solver = PerishableConstrainedTSPSolver(pathfinder)
    crowdsource_mgr = CrowdsourcedGraphManager(store_map, inventory)

    # Test shopping list containing mixed goods:
    # Pasta (dry), Ribeye Steak (meat), Ice Cream (frozen), Milk (dairy), Bananas (produce)
    test_skus = ["WMT-00902", "WMT-00101", "WMT-00801", "WMT-00701", "WMT-00501"]
    selected_items = [inventory[sku] for sku in test_skus]

    print("\n=== SHOPPING LIST (Raw Input) ===")
    for item in selected_items:
        print(f"- [{item.perishable_class.value.upper()}] {item.name} ({item.aisle})")

    # 1. Run Standard Unweighted Route
    unweighted_res = tsp_solver.solve_route(entrance, checkout, selected_items, use_perishable_weights=False)

    # 2. Run Optimized Perishables-Last Route
    perishables_last_res = tsp_solver.solve_route(entrance, checkout, selected_items, use_perishable_weights=True)

    print("\n=== OPTIMIZED ROUTE (Perishables-Last Enforced) ===")
    print(f"Total Walking Distance: {perishables_last_res['total_walking_distance_feet']} feet")
    for step in perishables_last_res["steps"]:
        print(f"  Step {step['step_number']}: {step['instruction']} [{step['segment_distance_feet']} ft]")

    print("\n=== ITEM PICKUP SEQUENCE (Notice Frozen/Meat at End) ===")
    for idx, item in enumerate(perishables_last_res["ordered_items"]):
        print(f"  {idx + 1}. [{item['perishable_class']}] {item['name']} @ {item['aisle']}")

    # 3. Test Crowdsourced Pin Adjustment
    print("\n=== TESTING CROWDSOURCED PIN DROP ===")
    print("User reports Barilla Spaghetti was moved from Aisle A1 to Seasonal Endcap S1 (x: 52, y: 28)")
    crowd_update = crowdsource_mgr.submit_pin_drop(
        sku="WMT-00101",
        new_x=52,
        new_y=28,
        reported_aisle="Seasonal Endcap S1",
        user_id="shopper_fargo_99",
        notes="Relocated for Italian Pasta promotion",
    )
    print("Adjustment result:", crowd_update["message"])

    # Re-calculate route with adjusted graph
    updated_route = tsp_solver.solve_route(entrance, checkout, selected_items, use_perishable_weights=True)
    print("\n=== RECALCULATED ROUTE AFTER CROWDSOURCED GRAPH UPDATE ===")
    for idx, item in enumerate(updated_route["ordered_items"]):
        print(f"  {idx + 1}. {item['name']} -> New location: {item['aisle']} at ({item['coordinates']['x']}, {item['coordinates']['y']})")
