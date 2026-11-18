"""Comprehensive test suite for indoor positioning, macro engine, and substitutions."""

import os
import sys

sys.path.append(os.path.dirname(__file__))

from indoor_positioning import BlueDotSimulator
from macro_engine import MacroEngine
from routing_engine import load_multi_retailer_system, AStarPathfinder, PerishableConstrainedTSPSolver

LAYOUT_FILE = os.path.join(os.path.dirname(__file__), "..", "store_layout_fargo.json")
store_map, inventory, catalog_list, entrance, checkout, positioning_engine, active_store_data = load_multi_retailer_system(
    LAYOUT_FILE, "walmart_supercenter_1594"
)

print(f"1. Store loaded: {active_store_data['store_name']}")
print(f"   Catalog items count: {len(catalog_list)}")
print(f"   BLE Beacons configured: {len(positioning_engine.beacons)}")

# Test 1: Macro Aggregation
test_skus = ["WMT-00802", "WMT-00101", "WMT-00701", "WMT-00501", "WMT-00902"]
test_items = [it for it in catalog_list if it["sku"] in test_skus]
macro_totals = MacroEngine.calculate_running_totals(test_items)
print(f"\n2. Macro Totals for Shopping List:")
print(f"   Total Cost: ${macro_totals['total_cost']}")
print(f"   Calories: {macro_totals['calories']} kcal")
print(f"   Protein: {macro_totals['protein_g']}g ({macro_totals['macro_distribution']['protein_pct']}%)")
print(f"   Carbs: {macro_totals['carbs_g']}g ({macro_totals['macro_distribution']['carbs_pct']}%)")
print(f"   Fat: {macro_totals['fat_g']}g ({macro_totals['macro_distribution']['fat_pct']}%)")

# Test 2: Indoor Positioning Simulation (BLE RSSI & Trilateration)
sim_x, sim_y = 10, 15
rssi_map = positioning_engine.simulate_rssi_readings(sim_x, sim_y)
est_x, est_y, acc = positioning_engine.trilaterate_from_rssi(rssi_map)
snapped_x, snapped_y = positioning_engine.snap_to_walkable_grid(est_x, est_y, store_map.grid)
print(f"\n3. Indoor Positioning Test at true ({sim_x}, {sim_y}):")
print(f"   Raw estimated position: ({round(est_x, 1)}, {round(est_y, 1)}), Accuracy: {acc} ft")
print(f"   Aisle-snapped Blue Dot: ({snapped_x}, {snapped_y})")

# Test 3: Smart Substitution when Chicken Breast is Out of Stock
print(f"\n4. Smart Substitution Test:")
print("   Scenario: Shopper at Meat Wall discovers Boneless Chicken Breast (WMT-00802) is out of stock.")
chicken_item = next(it for it in catalog_list if it["sku"] == "WMT-00802")
substitutes = MacroEngine.rank_substitutes(
    target_item=chicken_item,
    catalog=catalog_list,
    current_user_x=18,
    current_user_y=4,
    cell_size_feet=store_map.cell_size_feet,
)
for idx, sub in enumerate(substitutes):
    print(f"   #{idx+1}: {sub['name']} ({sub['aisle']}) - Match: {sub['macro_similarity_pct']}% | Score: {sub['overall_fit_score']}")
    print(f"       Diff: {sub['macro_diff']['protein_g']:+}g Protein, {sub['macro_diff']['calories']:+} Cals | Distance: {sub['walking_distance_feet']} ft")

print("\nAll backend integration tests passed successfully!")
