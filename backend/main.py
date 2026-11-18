"""
FastAPI Server for Mobile Grocery Route Optimizer & Indoor Navigation Engine
Endpoints:
- Multi-retailer layout ingestion (Walmart, Target, Costco)
- A* pathfinding & Perishable-Aware TSP
- Indoor positioning (BLE RSSI trilateration & real-time Blue Dot trajectory)
- Nutritional macros & running cart totals
- Smart Substitution & mid-shopping rerouting
- Barcode UPC product scanner lookup
"""

import json
import os
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from indoor_positioning import BLEBeacon, IndoorPositioningEngine, BlueDotSimulator
from macro_engine import MacroEngine
from routing_engine import (
    AStarPathfinder,
    ItemLocation,
    PerishableConstrainedTSPSolver,
    Point,
    RetailerAPIAdapter,
    load_multi_retailer_system,
)

app = FastAPI(
    title="StoreNav: Indoor Grocery Navigation & Macro Engine API",
    description="Mobile-first indoor positioning, macro optimization, and A* TSP store routing.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LAYOUT_FILE = os.path.join(os.path.dirname(__file__), "..", "store_layout_fargo.json")
store_map, inventory, catalog_list, entrance, checkout, positioning_engine, active_store_data = load_multi_retailer_system(
    LAYOUT_FILE, "walmart_supercenter_1594"
)
pathfinder = AStarPathfinder(store_map)
tsp_solver = PerishableConstrainedTSPSolver(pathfinder)
retailer_adapter = RetailerAPIAdapter(inventory)


# ----------------- Request Models -----------------

class OptimizeRouteRequest(BaseModel):
    skus: List[str]
    enforce_perishables_last: bool = True
    current_user_location: Optional[Dict[str, int]] = None
    collected_skus: Optional[List[str]] = None


class SubstituteRequest(BaseModel):
    out_of_stock_sku: str
    current_user_x: int
    current_user_y: int
    remaining_skus: List[str]


class ApplySubstitutionRequest(BaseModel):
    out_of_stock_sku: str
    substitute_sku: str
    current_user_x: int
    current_user_y: int
    current_shopping_list_skus: List[str]
    collected_skus: Optional[List[str]] = None


class TrilaterationRequest(BaseModel):
    rssi_readings: Dict[str, float]


class MacroCalcRequest(BaseModel):
    skus: List[str]


# ----------------- Store Layout & Retailer APIs -----------------

@app.get("/api/store/list")
def get_supported_stores():
    with open(LAYOUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {
        "active_store": data.get("active_store"),
        "supported_retailers": data.get("retailers_supported", []),
        "stores": [
            {
                "id": k,
                "name": v["store_name"],
                "retailer": v["retailer"],
                "address": v["address"],
                "footprint": v["footprint_type"],
            }
            for k, v in data["stores"].items()
        ],
    }


@app.get("/api/store/layout")
def get_store_layout(store_id: str = "walmart_supercenter_1594"):
    with open(LAYOUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    if store_id not in data["stores"]:
        store_id = "walmart_supercenter_1594"
    selected = data["stores"][store_id]
    return {
        "store_id": selected["store_id"],
        "store_name": selected["store_name"],
        "retailer": selected["retailer"],
        "grid_dimensions": selected["grid_dimensions"],
        "zones": selected["zones"],
        "obstacles": selected["obstacles"],
        "entrances": selected["entrances"],
        "checkouts": selected["checkouts"],
        "ble_beacons": selected.get("ble_beacons", []),
        "walkways": selected.get("walkways", []),
    }


@app.get("/api/inventory")
def get_inventory():
    return catalog_list


@app.get("/api/inventory/search")
def search_inventory(query: str):
    item = retailer_adapter.lookup_product(query)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return retailer_adapter.verify_stock_and_aisle(item.sku)


@app.get("/api/barcode/lookup")
def lookup_barcode(upc: str):
    """
    Simulates Target/Walmart barcode scanning lookup from mobile camera.
    """
    for item in inventory.values():
        if item.upc == upc.strip():
            return {
                "found": True,
                "sku": item.sku,
                "upc": item.upc,
                "name": item.name,
                "aisle": item.aisle,
                "price": item.price,
                "macros": item.macros,
            }
    raise HTTPException(status_code=404, detail=f"No product matches barcode UPC {upc}")


# ----------------- Macro Calculation & Running Totals -----------------

@app.post("/api/macros/calculate")
def calculate_cart_macros(req: MacroCalcRequest):
    selected = [item for item in catalog_list if item["sku"] in req.skus]
    totals = MacroEngine.calculate_running_totals(selected)
    return totals


# ----------------- Indoor Positioning & Blue Dot -----------------

@app.post("/api/position/trilaterate")
def trilaterate_position(req: TrilaterationRequest):
    raw_x, raw_y, accuracy = positioning_engine.trilaterate_from_rssi(req.rssi_readings)
    snapped_x, snapped_y = positioning_engine.snap_to_walkable_grid(raw_x, raw_y, store_map.grid)
    return {
        "raw_coordinates": {"x": round(raw_x, 2), "y": round(raw_y, 2)},
        "snapped_coordinates": {"x": snapped_x, "y": snapped_y},
        "accuracy_radius_feet": round(accuracy, 1),
        "is_walkable": store_map.is_walkable(snapped_x, snapped_y),
    }


@app.get("/api/position/beacons")
def get_beacons():
    return [
        {
            "id": b.id,
            "x": b.x,
            "y": b.y,
            "tx_power": b.tx_power,
            "major": b.major,
            "minor": b.minor,
            "zone": b.zone,
        }
        for b in positioning_engine.beacons.values()
    ]


# ----------------- Dynamic Routing & Smart Substitutions -----------------

@app.post("/api/route/optimize")
def optimize_route(req: OptimizeRouteRequest):
    selected_items = [inventory[sku] for sku in req.skus if sku in inventory]
    start_pt = (
        Point(req.current_user_location["x"], req.current_user_location["y"])
        if req.current_user_location
        else entrance
    )

    result = tsp_solver.solve_route(
        origin=start_pt,
        destination=checkout,
        items=selected_items,
        use_perishable_weights=req.enforce_perishables_last,
        collected_skus=set(req.collected_skus or []),
    )
    # Append running macro totals
    raw_items = [it for it in catalog_list if it["sku"] in req.skus]
    result["macro_totals"] = MacroEngine.calculate_running_totals(raw_items)
    return result


@app.post("/api/substitutions/recommend")
def recommend_substitutions(req: SubstituteRequest):
    target = inventory.get(req.out_of_stock_sku)
    if not target:
        raise HTTPException(status_code=404, detail="Target SKU not found")

    target_dict = next(it for it in catalog_list if it["sku"] == req.out_of_stock_sku)
    ranked = MacroEngine.rank_substitutes(
        target_item=target_dict,
        catalog=catalog_list,
        current_user_x=req.current_user_x,
        current_user_y=req.current_user_y,
        cell_size_feet=store_map.cell_size_feet,
    )
    return {
        "out_of_stock_sku": req.out_of_stock_sku,
        "out_of_stock_name": target.name,
        "current_user_location": {"x": req.current_user_x, "y": req.current_user_y},
        "recommended_substitutes": ranked,
    }


@app.post("/api/route/reroute-substitute")
def apply_substitution_and_reroute(req: ApplySubstitutionRequest):
    """
    Swaps out the unavailable item for the user's accepted substitute,
    and recalculates the remaining tour from the user's exact current Blue Dot location.
    """
    updated_skus = [
        req.substitute_sku if s == req.out_of_stock_sku else s
        for s in req.current_shopping_list_skus
    ]

    curr_loc = Point(req.current_user_x, req.current_user_y)
    selected_items = [inventory[s] for s in updated_skus if s in inventory]

    new_route = tsp_solver.solve_route(
        origin=curr_loc,
        destination=checkout,
        items=selected_items,
        use_perishable_weights=True,
        collected_skus=set(req.collected_skus or []),
    )

    raw_items = [it for it in catalog_list if it["sku"] in updated_skus]
    new_route["macro_totals"] = MacroEngine.calculate_running_totals(raw_items)
    new_route["updated_skus"] = updated_skus
    return new_route
