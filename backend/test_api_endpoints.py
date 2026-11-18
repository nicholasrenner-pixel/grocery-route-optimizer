import os
import sys

sys.path.append(os.path.dirname(__file__))

from main import app, OptimizeRouteRequest, MealSuggestRequest, optimize_route, suggest_meals

print("1. Testing POST /api/route/optimize...")
route_req = OptimizeRouteRequest(
    store_id="walmart_fargo_13th",
    cart_item_ids=["item_spaghetti", "item_marinara", "item_ground_beef", "item_milk"],
    perishables_last=True,
    current_position=None
)

res = optimize_route(route_req)
print(f"   Total distance: {res['total_distance_ft']} ft (~{res['estimated_walk_minutes']} min walk)")
print(f"   Aisles Visited: {res['aisles_visited']}")
print(f"   Aisles Skipped: {res['aisles_skipped']}")
print(f"   Polyline points count: {len(res['polyline_coords'])}")
print(f"   Navigation steps count: {len(res['navigation_steps'])}")
for idx, s in enumerate(res['ordered_stops']):
    print(f"     Stop {s['stop_number']}: {s['name']} ({s['aisle']}) - Side: {s['shelf_side']}")

print("\n2. Testing POST /api/meals/suggest...")
meal_req = MealSuggestRequest(
    cart_item_ids=["item_spaghetti", "item_marinara", "item_ground_beef"]
)
meal_res = suggest_meals(meal_req)
top_rec = meal_res["suggestions"][0]
print(f"   Top suggestion: {top_rec['title']} ({top_rec['matched_count']}/{top_rec['total_required_count']} matched - {int(top_rec['overlap_ratio']*100)}%)")
print(f"   Matched: {[m['name'] for m in top_rec['matched_items']]}")
print(f"   Missing: {[(m['name'], m['aisle'], m['price']) for m in top_rec['missing_items']]}")
print(f"   Macros: {top_rec['total_macros_per_serving']}")

print("\nAPI tests passed successfully!")
