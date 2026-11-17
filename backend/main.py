"""
FastAPI Server for Mobile Grocery Route Optimizer.
Exposes REST endpoints for:
- Store Layout & Obstacle Map Ingestion
- Real-time Product Search & Stock Lookup (Target / Walmart APIs)
- Perishable-Constrained TSP Pathfinding Route Optimization
- Crowdsourced Pin Drop & Real-Time Graph Relocation
"""

from typing import List, Optional
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from routing_engine import (
    load_store_from_json,
    AStarPathfinder,
    PerishableConstrainedTSPSolver,
    RetailerAPIAdapter,
    CrowdsourcedGraphManager,
    Point
)

app = FastAPI(
    title="Grocery Store Navigation & Route Optimizer API",
    description="Calculates shortest walking paths around store aisles with perishable-aware routing rules.",
    version="1.0.0"
)

# Enable CORS for React mobile frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LAYOUT_FILE = os.path.join(os.path.dirname(__file__), "..", "store_layout_fargo.json")
store_map, inventory, entrance, checkout = load_store_from_json(LAYOUT_FILE)
pathfinder = AStarPathfinder(store_map)
tsp_solver = PerishableConstrainedTSPSolver(pathfinder)
retailer_adapter = RetailerAPIAdapter(inventory)
crowdsource_mgr = CrowdsourcedGraphManager(store_map, inventory)


class OptimizeRouteRequest(BaseModel):
    skus: List[str]
    enforce_perishables_last: bool = True
    custom_entrance: Optional[dict] = None
    custom_checkout: Optional[dict] = None


class CrowdsourcePinDropRequest(BaseModel):
    sku: str
    new_x: int
    new_y: int
    reported_aisle: str
    user_id: str
    notes: Optional[str] = ""


@app.get("/api/store/layout")
def get_store_layout():
    """Returns grid dimensions, zones, obstacles, entrances, and checkouts."""
    import json
    with open(LAYOUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {
        "store_metadata": data["store_metadata"],
        "zones": data["zones"],
        "obstacles": data["obstacles"],
        "entrances": data["entrances"],
        "checkouts": data["checkouts"],
        "walkways": data.get("walkways", []),
    }


@app.get("/api/inventory")
def get_inventory():
    """Returns full catalog of available items in the store."""
    return [
        {
            "sku": item.sku,
            "name": item.name,
            "brand": item.brand,
            "category": item.category,
            "perishable_class": item.perishable_class.value,
            "aisle": item.aisle,
            "section": item.section,
            "coordinates": {"x": item.coord.x, "y": item.coord.y},
            "in_stock": item.in_stock,
            "stock_count": item.stock_count,
            "price": item.price,
            "has_crowdsource_update": len(item.crowdsourced_adjustments) > 0,
        }
        for item in inventory.values()
    ]


@app.get("/api/inventory/search")
def search_inventory(query: str):
    """Searches item catalog by name or SKU."""
    item = retailer_adapter.lookup_product(query)
    if not item:
        raise HTTPException(status_code=404, detail="Product not found.")
    return retailer_adapter.verify_stock_and_aisle(item.sku)


@app.post("/api/route/optimize")
def optimize_route(req: OptimizeRouteRequest):
    """
    Computes optimal walking route visiting all requested items.
    Enforces entrance as start, checkout as end, and perishables last.
    """
    selected_items = []
    missing_skus = []

    for sku in req.skus:
        if sku in inventory:
            selected_items.append(inventory[sku])
        else:
            missing_skus.append(sku)

    if missing_skus:
        raise HTTPException(status_code=400, detail=f"Unrecognized SKUs: {missing_skus}")

    start_pt = Point(req.custom_entrance["x"], req.custom_entrance["y"]) if req.custom_entrance else entrance
    end_pt = Point(req.custom_checkout["x"], req.custom_checkout["y"]) if req.custom_checkout else checkout

    result = tsp_solver.solve_route(
        entrance=start_pt,
        checkout=end_pt,
        items=selected_items,
        use_perishable_weights=req.enforce_perishables_last
    )
    return result


@app.post("/api/crowdsource/pin-drop")
def submit_pin_drop(req: CrowdsourcePinDropRequest):
    """
    Allows a shopper to drop a pin reporting a relocated product.
    Updates the routing graph dynamically for all subsequent calculations.
    """
    res = crowdsource_mgr.submit_pin_drop(
        sku=req.sku,
        new_x=req.new_x,
        new_y=req.new_y,
        reported_aisle=req.reported_aisle,
        user_id=req.user_id,
        notes=req.notes or "",
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error"))
    return res
