"""
Grocery Route Optimizer - Enhanced Multi-Retailer Pathfinding & Spatial Engine
Includes:
1. Multi-Retailer Store Layout Ingestion (Walmart, Target, Costco)
2. A* Pathfinding navigating physical shelving blocks and service islands
3. Staged Perishable-Constrained TSP Solver (Frozen/Raw Meats prioritized last)
4. Dynamic Mid-Trip Rerouting from Real-Time User Coordinates (Blue Dot)
5. Retailer Stock & Aisle APIs (Walmart Developer Portal & Target Red Circle API mock)
6. Crowdsourced Pin Relocation Manager
"""

import heapq
import json
import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set, Tuple

from indoor_positioning import BLEBeacon, IndoorPositioningEngine, BlueDotSimulator
from macro_engine import MacroEngine, MacroProfile


class PerishableCategory(str, Enum):
    SHELF_STABLE = "shelf_stable"
    AMBIENT_FRESH = "ambient_fresh"
    CHILLED_DAIRY = "chilled_dairy"
    RAW_MEAT_SEAFOOD = "raw_meat_seafood"
    FROZEN_GOODS = "frozen_goods"


PERISHABLE_TIER_ORDER = {
    PerishableCategory.SHELF_STABLE: 1,
    PerishableCategory.AMBIENT_FRESH: 1,
    PerishableCategory.CHILLED_DAIRY: 2,
    PerishableCategory.RAW_MEAT_SEAFOOD: 3,
    PerishableCategory.FROZEN_GOODS: 4,
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
    upc: str
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
    macros: Dict
    smart_substitutes: List[Dict] = field(default_factory=list)
    crowdsourced_adjustments: List[Dict] = field(default_factory=list)


class StoreGridMap:
    def __init__(self, width: int, height: int, cell_size_feet: float = 4.0):
        self.width = width
        self.height = height
        self.cell_size_feet = cell_size_feet
        self.grid = [[False for _ in range(width)] for _ in range(height)]
        self.obstacles: Dict[str, Dict] = {}

    def add_obstacle_box(self, obs_id: str, x: int, y: int, w: int, h: int, label: str):
        self.obstacles[obs_id] = {"x": x, "y": y, "width": w, "height": h, "label": label}
        for cy in range(y, min(self.height, y + h)):
            for cx in range(x, min(self.width, x + w)):
                self.grid[cy][cx] = True

    def is_walkable(self, x: int, y: int) -> bool:
        if 0 <= x < self.width and 0 <= y < self.height:
            return not self.grid[y][x]
        return False

    def find_nearest_walkable(self, p: Point) -> Point:
        if self.is_walkable(p.x, p.y):
            return p
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
    def __init__(self, store_map: StoreGridMap):
        self.store_map = store_map

    def find_path(self, start: Point, goal: Point) -> Tuple[List[Point], float]:
        walkable_start = self.store_map.find_nearest_walkable(start)
        walkable_goal = self.store_map.find_nearest_walkable(goal)

        if walkable_start.to_tuple() == walkable_goal.to_tuple():
            return [walkable_start], 0.0

        open_set = []
        counter = 0
        heapq.heappush(open_set, (0.0, counter, walkable_start))

        came_from: Dict[Tuple[int, int], Point] = {}
        g_score: Dict[Tuple[int, int], float] = {walkable_start.to_tuple(): 0.0}

        def heuristic(p1: Point, p2: Point) -> float:
            return (abs(p1.x - p2.x) + abs(p1.y - p2.y)) * self.store_map.cell_size_feet

        closed_set: Set[Tuple[int, int]] = set()

        while open_set:
            _, _, current = heapq.heappop(open_set)
            curr_coord = current.to_tuple()

            if curr_coord == walkable_goal.to_tuple():
                path = [current]
                while curr_coord in came_from:
                    current = came_from[curr_coord]
                    curr_coord = current.to_tuple()
                    path.append(current)
                path.reverse()
                total_feet = g_score[walkable_goal.to_tuple()]
                return path, total_feet

            closed_set.add(curr_coord)

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

        return [walkable_start, walkable_goal], start.manhattan_distance(goal) * self.store_map.cell_size_feet


class PerishableConstrainedTSPSolver:
    """
    Modified TSP solver with multi-tier perishability constraints,
    generating both the step-by-step guidance and the simulated Blue Dot walking trajectory.
    """

    def __init__(self, pathfinder: AStarPathfinder):
        self.pathfinder = pathfinder

    def solve_route(
        self,
        origin: Point,
        destination: Point,
        items: List[ItemLocation],
        use_perishable_weights: bool = True,
        collected_skus: Optional[Set[str]] = None,
    ) -> Dict:
        collected_skus = collected_skus or set()
        active_items = [it for it in items if it.sku not in collected_skus]

        if not active_items:
            path, dist = self.pathfinder.find_path(origin, destination)
            return {
                "ordered_items": [],
                "total_walking_distance_feet": round(dist, 1),
                "full_polyline": [{"x": p.x, "y": p.y} for p in path],
                "steps": [{"instruction": "Proceed to Checkout Register", "distance_feet": round(dist, 1)}],
                "blue_dot_steps": BlueDotSimulator.interpolate_polyline_steps([{"x": p.x, "y": p.y} for p in path]),
            }

        if use_perishable_weights:
            tiered_groups: Dict[int, List[ItemLocation]] = {1: [], 2: [], 3: [], 4: []}
            for item in active_items:
                tier = PERISHABLE_TIER_ORDER.get(item.perishable_class, 1)
                tiered_groups[tier].append(item)

            ordered_items: List[ItemLocation] = []
            current_head = origin

            for tier_num in sorted(tiered_groups.keys()):
                group_items = tiered_groups[tier_num]
                if not group_items:
                    continue
                sub_order = self._solve_tier_tsp(current_head, destination, group_items)
                ordered_items.extend(sub_order)
                if sub_order:
                    current_head = sub_order[-1].coord
        else:
            ordered_items = self._solve_tier_tsp(origin, destination, active_items)

        stops = [origin] + [item.coord for item in ordered_items] + [destination]
        full_polyline: List[Point] = []
        steps = []
        total_distance = 0.0

        for i in range(len(stops) - 1):
            start_p = stops[i]
            end_p = stops[i + 1]
            segment_path, seg_dist = self.pathfinder.find_path(start_p, end_p)
            total_distance += seg_dist

            if full_polyline:
                full_polyline.extend(segment_path[1:])
            else:
                full_polyline.extend(segment_path)

            if i == 0:
                dest_name = f"{ordered_items[0].name} ({ordered_items[0].aisle})"
                action = f"Start at current location -> Navigate to {dest_name}"
            elif i == len(stops) - 2:
                action = f"Complete shopping -> Proceed to Checkout Register"
            else:
                dest_name = f"{ordered_items[i].name} ({ordered_items[i].aisle})"
                action = f"Pick up {ordered_items[i-1].name} -> Proceed to {dest_name}"

            steps.append({
                "step_number": i + 1,
                "instruction": action,
                "target_sku": ordered_items[i].sku if i < len(ordered_items) else "CHECKOUT",
                "target_name": ordered_items[i].name if i < len(ordered_items) else "Register",
                "target_aisle": ordered_items[i].aisle if i < len(ordered_items) else "Front Registers",
                "segment_distance_feet": round(seg_dist, 1),
            })

        polyline_dicts = [{"x": p.x, "y": p.y} for p in full_polyline]
        blue_dot_steps = BlueDotSimulator.interpolate_polyline_steps(polyline_dicts)

        return {
            "ordered_items": [
                {
                    "sku": it.sku,
                    "upc": it.upc,
                    "name": it.name,
                    "brand": it.brand,
                    "aisle": it.aisle,
                    "section": it.section,
                    "price": it.price,
                    "perishable_class": it.perishable_class.value,
                    "tier": PERISHABLE_TIER_ORDER[it.perishable_class],
                    "coordinates": {"x": it.coord.x, "y": it.coord.y},
                    "macros": it.macros,
                }
                for it in ordered_items
            ],
            "total_walking_distance_feet": round(total_distance, 1),
            "step_count": len(steps),
            "steps": steps,
            "full_polyline": polyline_dicts,
            "blue_dot_steps": blue_dot_steps,
        }

    def _solve_tier_tsp(self, start: Point, end: Point, items: List[ItemLocation]) -> List[ItemLocation]:
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
        while improved and iterations < 40:
            improved = False
            iterations += 1
            for i in range(len(ordered) - 1):
                for j in range(i + 1, len(ordered)):
                    old_dist = self._sequence_dist(start, end, ordered)
                    ordered[i : j + 1] = reversed(ordered[i : j + 1])
                    new_dist = self._sequence_dist(start, end, ordered)
                    if new_dist < old_dist - 0.1:
                        improved = True
                    else:
                        ordered[i : j + 1] = reversed(ordered[i : j + 1])

        return ordered

    def _sequence_dist(self, start: Point, end: Point, seq: List[ItemLocation]) -> float:
        points = [start] + [it.coord for it in seq] + [end]
        total = 0.0
        for i in range(len(points) - 1):
            total += points[i].manhattan_distance(points[i + 1]) * 4.0
        return total


class RetailerAPIAdapter:
    """
    Adapter simulating integrations with:
    - Target Red Circle API (Item Location & Inventory Availability)
    - Walmart Developer Portal (Store Assortment & Aisle Mapping)
    - Costco Warehouse Inventory System
    """

    def __init__(self, inventory_db: Dict[str, ItemLocation]):
        self.inventory_db = inventory_db

    def lookup_product(self, query: str) -> Optional[ItemLocation]:
        query_norm = query.lower().strip()
        for item in self.inventory_db.values():
            if (
                query_norm in item.name.lower()
                or query_norm in item.sku.lower()
                or query_norm == item.upc
                or query_norm in item.aisle.lower()
            ):
                return item
        return None

    def verify_stock_and_aisle(self, sku: str) -> Dict:
        item = self.inventory_db.get(sku)
        if not item:
            return {"status": "NOT_FOUND", "sku": sku}
        return {
            "status": "AVAILABLE" if item.in_stock else "OUT_OF_STOCK",
            "sku": item.sku,
            "upc": item.upc,
            "name": item.name,
            "aisle": item.aisle,
            "section": item.section,
            "stock_count": item.stock_count,
            "coordinates": {"x": item.coord.x, "y": item.coord.y},
            "perishable_tier": PERISHABLE_TIER_ORDER[item.perishable_class],
            "macros": item.macros,
        }


def load_multi_retailer_system(json_path: str, store_key: str = "walmart_supercenter_1594"):
    """
    Parses multi-retailer floor plans, BLE beacon positioning networks, and item catalogs.
    """
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    store_data = data["stores"].get(store_key, data["stores"]["walmart_supercenter_1594"])
    meta = store_data["grid_dimensions"]
    cell_size = meta.get("cell_size_feet", 4.0)

    store_map = StoreGridMap(
        width=meta["width_cells"],
        height=meta["height_cells"],
        cell_size_feet=cell_size,
    )

    for obs in store_data.get("obstacles", []):
        store_map.add_obstacle_box(
            obs_id=obs["id"],
            x=obs["x"],
            y=obs["y"],
            w=obs["width"],
            h=obs["height"],
            label=obs.get("label", ""),
        )

    beacons = [
        BLEBeacon(
            id=b["id"],
            x=b["x"],
            y=b["y"],
            tx_power=b.get("txPower", -59.0),
            major=b.get("major", 100),
            minor=b.get("minor", 1),
            zone=b.get("zone", "Store"),
        )
        for b in store_data.get("ble_beacons", [])
    ]
    positioning_engine = IndoorPositioningEngine(
        beacons=beacons,
        grid_width=meta["width_cells"],
        grid_height=meta["height_cells"],
        cell_size_feet=cell_size,
    )

    inventory: Dict[str, ItemLocation] = {}
    catalog_list = []
    for item_data in data.get("inventory", []):
        item = ItemLocation(
            sku=item_data["sku"],
            upc=item_data.get("upc", ""),
            name=item_data["name"],
            brand=item_data.get("brand", ""),
            category=item_data["category"],
            perishable_class=PerishableCategory(item_data["perishable_class"]),
            aisle=item_data["aisle"],
            section=item_data.get("section", ""),
            coord=Point(item_data["coordinates"]["x"], item_data["coordinates"]["y"]),
            in_stock=item_data["in_stock"],
            stock_count=item_data["stock_count"],
            price=item_data["price"],
            macros=item_data.get("macros", {}),
            smart_substitutes=item_data.get("smart_substitutes", []),
            crowdsourced_adjustments=item_data.get("crowdsourced_adjustments", []),
        )
        inventory[item.sku] = item
        catalog_list.append(item_data)

    entrance = Point(store_data["entrances"][0]["x"], store_data["entrances"][0]["y"])
    checkout = Point(store_data["checkouts"][0]["x"], store_data["checkouts"][0]["y"])

    return store_map, inventory, catalog_list, entrance, checkout, positioning_engine, store_data
