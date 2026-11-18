import os
import sys

sys.path.append(os.path.dirname(__file__))

from routing import load_store_system, AStarRouter, GlobalTSPOptimizer, TurnByTurnCompiler

DATA_FILE = os.path.join(os.path.dirname(__file__), "store_data.json")
grid, items, entrance, checkout, aisles = load_store_system(DATA_FILE)

print(f"Store loaded: {grid.cols} cols x {grid.rows} rows, {len(items)} items")
print(f"Entrance access coord: {entrance['coord']}, Walkable: {grid.is_walkable(*entrance['coord'])}")
print(f"Checkout access coord: {checkout['coord']}, Walkable: {grid.is_walkable(*checkout['coord'])}")

# Check that every item has access_coord on a walkable tile and shelf_coord on an obstacle tile
for item_id, item in items.items():
    ax, ay = item["access_coord"]
    sx, sy = item["shelf_coord"]
    assert grid.is_walkable(ax, ay), f"Item {item_id} access_coord ({ax},{ay}) is NOT walkable!"
    assert not grid.is_walkable(sx, sy), f"Item {item_id} shelf_coord ({sx},{sy}) should be on an obstacle!"

print("All item access_coords and shelf_coords are strictly validated!")

# Test route optimization
astar = AStarRouter(grid)
tsp = GlobalTSPOptimizer(astar)

cart_ids = ["item_spaghetti", "item_marinara", "item_ground_beef", "item_milk"]
cart_items = [items[iid] for iid in cart_ids]

res = tsp.solve(
    start_coord=tuple(entrance["coord"]),
    checkout_coord=tuple(checkout["coord"]),
    items=cart_items,
    perishables_last=True
)

print(f"\nTotal distance: {res['total_distance_ft']} ft")
print("Stops order:")
for stop in res["ordered_stops"]:
    print(f"  #{stop['stop_number']}: {stop['name']} ({stop['aisle']}) - Perishable: {stop['is_perishable']}")

# MATHEMATICAL INTEGRITY CHECK:
# Verify that ZERO coordinates in polyline_coords ever land on an obstacle (1) tile
polyline = res["polyline_coords"]
obstacle_collisions = []
for pt in polyline:
    x, y = pt
    if grid.grid[y][x] == 1:
        obstacle_collisions.append((x, y))

assert len(obstacle_collisions) == 0, f"COLLISION ERROR: Polyline crosses obstacles at: {obstacle_collisions}"
print(f"\nMATHEMATICAL PROOF: Zero coordinates out of {len(polyline)} polyline points land on obstacles!")

# Compile navigation steps
steps = TurnByTurnCompiler.compile_instructions(polyline, res["ordered_stops"], aisles)
print(f"\nGenerated {len(steps)} navigation steps:")
for s in steps[:5]:
    print(f"  [{s['maneuver']}] {s['instruction']} ({s['distance_ft']} ft)")
