"""
StoreNav Backend API - High-Performance Indoor Navigation & Recipe Suggestion Engine.
Endpoints:
- POST /api/route/optimize: Global TSP (Held-Karp Bitmask DP / 2-Opt) with orthogonal A* pathfinding.
- POST /api/meals/suggest: Cart-aware smart meal & recipe recommendation engine.
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
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


# ----------------- Request / Response Models -----------------

class OptimizeRouteRequest(BaseModel):
    store_id: str = "walmart_fargo_13th"
    cart_item_ids: List[str]
    perishables_last: bool = True
    current_position: Optional[List[int]] = None


class MealSuggestRequest(BaseModel):
    cart_item_ids: List[str]


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


@app.post("/api/route/optimize")
def optimize_route(req: OptimizeRouteRequest):
    """
    Computes global obstacle-free TSP route starting from Entrance (or current_position)
    and ending at Checkout, without path clipping or cross-store bouncing.
    """
    selected_items = [items_dict[iid] for iid in req.cart_item_ids if iid in items_dict]

    # Starting position
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


@app.post("/api/meals/suggest")
def suggest_meals(req: MealSuggestRequest):
    """
    Matches current cart items against recipes and ranks them by ingredient overlap ratio.
    Returns matched items, missing items, macros, and prep times.
    """
    cart_set = set(req.cart_item_ids)
    recommendations = []

    for recipe in recipes_db:
        required_ids = recipe.get("required_item_ids", [])
        if not required_ids:
            continue

        matched_ids = [iid for iid in required_ids if iid in cart_set]
        missing_ids = [iid for iid in required_ids if iid not in cart_set]

        overlap_ratio = len(matched_ids) / float(len(required_ids))

        matched_items = [items_dict[iid] for iid in matched_ids if iid in items_dict]
        missing_items = [items_dict[iid] for iid in missing_ids if iid in items_dict]

        recommendations.append({
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
        })

    # Sort descending by overlap ratio, then matched count
    recommendations.sort(key=lambda r: (r["overlap_ratio"], r["matched_count"]), reverse=True)

    return {
        "total_recipes_evaluated": len(recipes_db),
        "cart_item_count": len(cart_set),
        "suggestions": recommendations,
    }
