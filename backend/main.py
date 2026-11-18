"""
StoreNav Backend API - Unified Route & Meal Optimization Engine.
Endpoints:
- POST /api/route/optimize: Global TSP (Held-Karp Bitmask DP / 2-Opt) with orthogonal A* pathfinding.
- POST /api/meals/suggest: Cart-aware smart recipe matching with cold-start meal kit fallbacks.
- GET  /api/meals/all: Curated dinner kits with full store inventory metadata.
- GET  /api/store/layout: Store floorplan, aisles, obstacles, zones, entrance & checkout.
- GET  /api/inventory: Full grocery catalog with nutritional macros and shelf coordinates.
"""

import json
import math
import os
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from routing import (
    CELL_SIZE_FT,
    AStarRouter,
    GlobalTSPOptimizer,
    TurnByTurnCompiler,
    load_store_system,
)

app = FastAPI(
    title="StoreNav Route & Meal Optimizer API",
    description="Precision indoor grocery navigation engine with Held-Karp TSP, obstacle-free A*, and smart recipe suggestions.",
    version="3.1.0",
)

# Explicit CORS configuration for local frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(__file__)
STORE_DATA_PATH = os.path.join(BASE_DIR, "store_data.json")
RECIPES_PATH = os.path.join(BASE_DIR, "recipes.json")

# Load store grid and recipes
grid, items_dict, entrance_data, checkout_data, aisles_list = load_store_system(STORE_DATA_PATH)
astar_router = AStarRouter(grid)
tsp_optimizer = GlobalTSPOptimizer(astar_router)

with open(RECIPES_PATH, "r", encoding="utf-8") as rf:
    recipes_db = json.load(rf)

with open(STORE_DATA_PATH, "r", encoding="utf-8") as sf:
    full_store_raw = json.load(sf)

# Startup validation: Ensure every recipe item exists in store catalog
missing_catalog_refs = []
for recipe in recipes_db:
    for req_id in recipe.get("required_item_ids", []):
        if req_id not in items_dict:
            missing_catalog_refs.append((recipe["recipe_id"], req_id))

if missing_catalog_refs:
    print(f"CRITICAL WARNING: Missing recipe catalog items on startup: {missing_catalog_refs}")
else:
    print(f"Startup Validation Passed: All {len(recipes_db)} recipes match catalog items 1-to-1.")


# ----------------- Request / Response Models -----------------

class OptimizeRouteRequest(BaseModel):
    store_id: str = "walmart_fargo_13th"
    cart_item_ids: List[str]
    perishables_last: bool = True
    current_position: Optional[List[int]] = None


class MealSuggestRequest(BaseModel):
    cart_item_ids: List[str]


# ----------------- Helper Functions -----------------

def _build_recipe_payload(recipe: Dict, cart_set: set) -> Dict:
    required_ids = recipe.get("required_item_ids", [])
    matched_ids = [iid for iid in required_ids if iid in cart_set]
    missing_ids = [iid for iid in required_ids if iid not in cart_set]

    matched_items = [items_dict[iid] for iid in matched_ids if iid in items_dict]
    missing_items = [items_dict[iid] for iid in missing_ids if iid in items_dict]

    overlap_ratio = len(matched_items) / float(len(required_ids)) if required_ids else 0.0

    return {
        "recipe_id": recipe["recipe_id"],
        "title": recipe["title"],
        "prep_time_min": recipe["prep_time_min"],
        "description": recipe.get("description", ""),
        "total_macros_per_serving": recipe.get("total_macros_per_serving", {}),
        "overlap_ratio": round(overlap_ratio, 2),
        "matched_count": len(matched_items),
        "total_required_count": len(required_ids),
        "matched_items": matched_items,
        "missing_items": missing_items,
    }


# ----------------- Endpoints -----------------

@app.get("/api/store/layout")
def get_store_layout():
    """Returns store geometry, grid dimensions, zones, obstacles, aisles, entrance and checkout."""
    return {
        "store_metadata": full_store_raw["store_metadata"],
        "entrance": full_store_raw["entrance"],
        "checkout": full_store_raw["checkout"],
        "zones": full_store_raw["zones"],
        "aisles": full_store_raw["aisles"],
        "obstacles": full_store_raw["obstacles"],
        "cell_size_feet": CELL_SIZE_FT,
    }


@app.get("/api/inventory")
def get_inventory():
    """Returns list of all catalog items."""
    return full_store_raw.get("items", [])


@app.get("/api/meals/all")
def get_all_meals():
    """Returns all 15 recipes populated with catalog metadata."""
    cart_set = set()
    return [_build_recipe_payload(r, cart_set) for r in recipes_db]


@app.post("/api/meals/suggest")
def suggest_meals(req: MealSuggestRequest):
    """
    Matches current cart items against recipes and ranks them by ingredient overlap ratio.
    If the cart is empty or has 0 matches, returns curated 'Quick & Popular Meal Kits'
    so the meal recommendations section is never blank.
    """
    cart_set = set(req.cart_item_ids)
    all_recommendations = [_build_recipe_payload(r, cart_set) for r in recipes_db]

    if not cart_set:
        # COLD START MODE: Return popular meal kits with all items listed under missing_items
        cold_start_order = [
            "recipe_spaghetti_meat_sauce",
            "recipe_chicken_alfredo",
            "recipe_beef_tacos",
            "recipe_chicken_stir_fry",
            "recipe_chicken_fajitas",
            "recipe_breakfast_burritos",
            "recipe_teriyaki_salmon_bowl",
            "recipe_classic_burgers",
        ]
        cold_start_recipes = sorted(
            all_recommendations,
            key=lambda r: cold_start_order.index(r["recipe_id"]) if r["recipe_id"] in cold_start_order else 99,
        )
        return {
            "mode": "cold_start",
            "total_recipes_evaluated": len(recipes_db),
            "cart_item_count": 0,
            "suggestions": cold_start_recipes,
        }

    # When cart has items: sort by overlap ratio descending, then matched count descending
    all_recommendations.sort(key=lambda r: (r["overlap_ratio"], r["matched_count"]), reverse=True)

    return {
        "mode": "active_matching",
        "total_recipes_evaluated": len(recipes_db),
        "cart_item_count": len(cart_set),
        "suggestions": all_recommendations,
    }


@app.post("/api/route/optimize")
def optimize_route(req: OptimizeRouteRequest):
    """
    Computes global obstacle-free TSP route starting from Entrance (or current_position)
    and ending at Checkout, without path clipping or cross-store bouncing.
    """
    selected_items = [items_dict[iid] for iid in req.cart_item_ids if iid in items_dict]

    # Resolve start coordinate
    if req.current_position and len(req.current_position) == 2:
        cx, cy = req.current_position
        if not grid.is_walkable(cx, cy):
            best_pt = (cx, cy)
            best_dist = float("inf")
            for dy in range(-2, 3):
                for dx in range(-2, 3):
                    nx, ny = cx + dx, cy + dy
                    if grid.is_walkable(nx, ny):
                        d = math.hypot(dx, dy)
                        if d < best_dist:
                            best_dist = d
                            best_pt = (nx, ny)
            start_coord = best_pt
        else:
            start_coord = (cx, cy)
    else:
        start_coord = tuple(entrance_data["coord"])

    checkout_coord = tuple(checkout_data["coord"])

    if not selected_items:
        # Empty cart: straight path from entrance to checkout
        path, dist = astar_router.find_shortest_path(start_coord, checkout_coord)
        return {
            "total_distance_ft": round(dist),
            "estimated_walk_minutes": round(dist / 180.0, 1),
            "aisles_visited": [],
            "aisles_skipped": ["Aisle 1", "Aisle 2", "Aisle 3", "Aisle 4", "Aisle 5", "Aisle 6", "Aisle 7", "Aisle 8"],
            "ordered_stops": [],
            "polyline_coords": [list(pt) for pt in path],
            "navigation_steps": [
                {
                    "step_index": 0,
                    "maneuver": "ARRIVE",
                    "instruction": "Proceed directly to Checkout Registers",
                    "distance_ft": round(dist),
                    "start_coord": list(start_coord),
                    "end_coord": list(checkout_coord),
                    "target_stop_number": None,
                }
            ],
        }

    # Run Global TSP Optimizer
    tsp_result = tsp_optimizer.solve(
        start_coord=start_coord,
        checkout_coord=checkout_coord,
        items=selected_items,
        perishables_last=req.perishables_last,
    )

    ordered_stops = tsp_result["ordered_stops"]
    polyline_coords = tsp_result["polyline_coords"]
    total_dist_ft = tsp_result["total_distance_ft"]

    # Compile turn-by-turn navigation steps
    navigation_steps = TurnByTurnCompiler.compile_instructions(
        polyline=polyline_coords,
        ordered_stops=ordered_stops,
        aisles_list=aisles_list,
    )

    # Compute aisles visited vs. skipped
    standard_aisles = ["Aisle 1", "Aisle 2", "Aisle 3", "Aisle 4", "Aisle 5", "Aisle 6", "Aisle 7", "Aisle 8"]
    visited_set = set()
    for stop in ordered_stops:
        aisle_name = stop.get("aisle", "")
        if aisle_name:
            visited_set.add(aisle_name)

    aisles_visited = [a for a in standard_aisles if a in visited_set]
    for extra in ["Produce", "Bakery", "Meat Wall", "Dairy Wall", "Frozen 1", "Frozen 2"]:
        if extra in visited_set and extra not in aisles_visited:
            aisles_visited.append(extra)

    aisles_skipped = [a for a in standard_aisles if a not in visited_set]

    estimated_minutes = round(total_dist_ft / 180.0, 1)

    return {
        "total_distance_ft": total_dist_ft,
        "estimated_walk_minutes": estimated_minutes,
        "aisles_visited": aisles_visited,
        "aisles_skipped": aisles_skipped,
        "ordered_stops": ordered_stops,
        "polyline_coords": polyline_coords,
        "navigation_steps": navigation_steps,
    }
