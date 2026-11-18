import json
import os
import sys

sys.path.append(os.path.dirname(__file__))

from main import (
    optimize_route,
    suggest_meals,
    OptimizeRouteRequest,
    MealSuggestRequest,
    grid,
)

print("==================================================")
print("TEST FLOW 1: Empty Cart Startup")
print("==================================================")
empty_route = optimize_route(OptimizeRouteRequest(
    store_id="walmart_fargo_13th",
    cart_item_ids=[],
    perishables_last=True,
    current_position=None
))
print(f"Empty cart route distance: {empty_route['total_distance_ft']} ft")
print(f"Empty cart stops: {len(empty_route['ordered_stops'])}")
assert empty_route['total_distance_ft'] > 0
assert len(empty_route['ordered_stops']) == 0

cold_meals = suggest_meals(MealSuggestRequest(cart_item_ids=[]))
print(f"Cold-start suggestions mode: {cold_meals['mode']}")
print(f"Cold-start suggestions count: {len(cold_meals['suggestions'])}")
assert len(cold_meals['suggestions']) >= 8
top_cold = cold_meals['suggestions'][0]
print(f"Top cold meal: {top_cold['title']} (Missing: {len(top_cold['missing_items'])} items)")
assert len(top_cold['missing_items']) > 0
assert len(top_cold['matched_items']) == 0

print("\n==================================================")
print("TEST FLOW 2: 1-Tap Add Meal Kit ('Spaghetti & Meat Sauce')")
print("==================================================")
spaghetti_recipe = next(r for r in cold_meals['suggestions'] if r['recipe_id'] == 'recipe_spaghetti_meat_sauce')
injected_item_ids = [it['item_id'] for it in spaghetti_recipe['missing_items']]
print(f"Injecting {len(injected_item_ids)} items into cart: {injected_item_ids}")

active_route = optimize_route(OptimizeRouteRequest(
    store_id="walmart_fargo_13th",
    cart_item_ids=injected_item_ids,
    perishables_last=True,
    current_position=None
))

print(f"New optimized route distance: {active_route['total_distance_ft']} ft")
print(f"Stops ordered by global TSP:")
for s in active_route['ordered_stops']:
    print(f"  Stop #{s['stop_number']}: {s['name']} ({s['aisle']}) - Side: {s['shelf_side']}")

# Verify ZERO coordinates touch an obstacle
for pt in active_route['polyline_coords']:
    assert grid.grid[pt[1]][pt[0]] != 1, f"Obstacle collision at {pt}"
print(f"Mathematical Verification: 0 of {len(active_route['polyline_coords'])} polyline points touch obstacles!")

print("\n==================================================")
print("TEST FLOW 3: Dynamic Recipe Re-Matching with Active Cart")
print("==================================================")
re_meals = suggest_meals(MealSuggestRequest(cart_item_ids=injected_item_ids))
top_active = re_meals['suggestions'][0]
print(f"Top active matched recipe: {top_active['title']}")
print(f"Match ratio: {int(top_active['overlap_ratio']*100)}% ({top_active['matched_count']}/{top_active['total_required_count']})")
assert top_active['overlap_ratio'] == 1.0  # 100% matched!

print("\n==================================================")
print("TEST FLOW 4: Mid-Walk Off-Route Rerouting")
print("==================================================")
# User walks off route to cell (24, 20) inside Aisle 4
off_route_pos = [24, 20]
rerouted = optimize_route(OptimizeRouteRequest(
    store_id="walmart_fargo_13th",
    cart_item_ids=injected_item_ids,
    perishables_last=True,
    current_position=off_route_pos
))
print(f"Rerouted distance from {off_route_pos}: {rerouted['total_distance_ft']} ft")
print(f"First instruction from current position: {rerouted['navigation_steps'][0]['instruction']}")

print("\nALL 4 END-TO-END FLOWS VERIFIED SUCCESSFULLY!")
