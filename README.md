# StoreNav: Precision Indoor Grocery Navigation, Global TSP & Smart Meal Optimizer

StoreNav is a mobile-first, desktop-optimized indoor grocery navigation platform engineered for big-box retailers (Walmart, Target, Costco) that calculates obstacle-free walking routes using **4-Directional Orthogonal A\***, solves a **Global Traveling Salesperson Problem (TSP)** using **Held-Karp Dynamic Programming (N <= 15)** and **2-Opt (N > 15)**, and provides a **Unified Split-Screen / Persistent Drawer** layout displaying both the live interactive Store Map and active Shopping Cart checklist simultaneously.

---

## Unified Workspace Layout (No Screen-Hiding Mode Switches)

```
+--------------------------------------------------------------------------------------------------------+
|                                  StoreNav • Walmart Supercenter #1594                                  |
+-------------------------------------------------------------------+------------------------------------+
| LEFT PANE: LIVE NAVIGATION & STORE MAP (65% Width)                | RIGHT PANE: ACTIVE CART & MEALS    |
|                                                                   | (35% Width)                        |
| +---------------------------------------------------------------+ | +--------------------------------+ |
| | Google Maps Turn-by-Turn Banner (Deep Green)                  | | | TOTAL: $21.84 • 1,840 kcal     | |
| | [↰] In 36 ft, Turn left into Aisle 4 — Barilla Spaghetti on R | | | Stop 2 of 5 • 285 ft walk      | |
| | [Simulate Walk] [1x/2x Speed] [Step Forward] [Off-Route Test] | | +--------------------------------+ |
| +---------------------------------------------------------------+ | | Active Cart (4) | Meals | Add   | |
|                                                                   | +--------------------------------+ |
| [Interactive SVG Architectural Store Floorplan]                   | | #1 Rao's Marinara (Aisle 4)    | |
| - Base light/dark architectural grid                              | |    [ - 1 + ] [Got It ✓]        | |
| - 8 Numbered Aisles + Perimeter (Produce, Meat, Dairy, Frozen)    | | #2 Barilla Spaghetti (Aisle 4) | |
| - Green ENTRANCE and Amber/Red CHECKOUT                           | |    [ - 1 + ] [Got It ✓]        | |
| - Smooth Blue Polyline (Zero obstacle clipping, chevrons & trail) | | #3 93% Ground Beef (Meat Wall) | |
| - Numbered Cart Pins ONLY (#1, #2, #3... turns green on check)   | |    [ - 1 + ] [Got It ✓]        | |
| - Directional User Puck with blue heading cone                    | | #4 Great Value Milk (Dairy)    | |
|                                                                   | |    [ - 1 + ] [Got It ✓]        | |
+-------------------------------------------------------------------+------------------------------------+
```

---

## Key Capabilities

### 1. Spatial Grid & 4-Directional A* Pathfinding (`backend/routing.py`)
- **Grid Scale**: 1 cell = $3.0\text{ ft} \times 3.0\text{ ft}$ (`CELL_SIZE_FT = 3.0`).
- **Cell Encoding**:
  - `0`: Walkable main corridor / perimeter racetrack (cost = 1.0).
  - `1`: Impassable physical obstacle (shelving gondolas, freezer cases, counters) (cost = $\infty$).
  - `2`: Walkable aisle interior (cost = 1.15 — slight penalty so A* prefers main perimeter/cross-aisles unless actually picking an item, preventing aisle weaving).
- **Orthogonal Neighbor Expansion**: Strictly Up, Down, Left, Right `[(0, 1), (0, -1), (1, 0), (-1, 0)]`. Diagonal movement is completely disabled, eliminating shelf-corner clipping.
- **Access vs. Shelf Snapping**: A* routes exclusively between pre-validated `access_coord` tiles in walkable corridors, adjacent to product `shelf_coord` tiles inside shelves.

### 2. Global Open-Ended TSP Solver (Eliminating Cross-Store Bouncing)
- **Held-Karp Bitmask Dynamic Programming ($N \le 15$)**:
  $$\text{dp}[\text{mask}][j] = \min_{i \in \text{mask} \setminus \{j\}} \left( \text{dp}[\text{mask} \setminus \{j\}][i] + \text{dist}[i][j] \right)$$
  Computes the global minimum-distance sweep from Entrance to Checkout across all selected items.
- **2-Opt Local Search ($N > 15$)**: Iteratively reverses sub-segments until no 2-edge swap improves the tour.
- **Perishables-Last Toggle**: Partitions items into non-perishables and perishables (raw meat, dairy, frozen foods), optimizing each partition so ice cream and meats are collected at the very end of the shopping trip.

### 3. Collinear Turn-by-Turn Instruction Compiler
- Compresses straight-line coordinate segments into single legs.
- Detects $90^\circ$ turns using the cross-product:
  $$\text{cross} = dx_1 \cdot dy_2 - dy_1 \cdot dx_2$$
  $\text{cross} > 0 \rightarrow$ `"TURN_RIGHT"`, $\text{cross} < 0 \rightarrow$ `"TURN_LEFT"`.
- Detects shelf side upon arrival (`"on your left"` vs. `"on your right"`).

### 4. Smart Meal Ideas & Cold-Start Recommendation Engine (`backend/recipes.json`)
- Evaluates cart ingredients against 15 dinner/lunch recipes.
- **Cold-Start Mode**: When the cart is empty, populates at least 8 curated dinner kits (Spaghetti & Meat Sauce, Chicken Alfredo, Beef Tacos, Stir-Fry, Fajitas, Breakfast Burritos, etc.) with 0 in-cart and all ingredients listed under missing.
- **1-Tap Ingredient Injection**: Clicking `+ Add Missing Ingredients` merges all required items into the cart in a single atomic state update, shows a confirmation toast, and immediately recalculates the optimal route.

### 5. Persistent Simultaneous Navigation & Shopping Cart UI
- **Single Source of Truth**: `cartItems: Record<string, CartEntry>` persisted in `localStorage` so browser reloads never wipe the cart.
- **Simultaneous Desktop & Mobile View**:
  - Desktop ($ \ge 768\text{px}$): 65% / 35% side-by-side workspace.
  - Mobile ($ < 768\text{px}$): Top 52% map + HUD, bottom 48% tabbed active cart drawer.
- **Interactive Walk & Off-Route Simulator**:
  - Play / Pause walk simulation with $1\times / 2\times$ speed controls.
  - Real-time countdown distance in feet.
  - Off-Route Test button shifts the user puck 2 aisles over and triggers dynamic mid-store rerouting.

---

## Verification & Test Results

```bash
python backend/test_routing_math.py
python backend/test_api_endpoints.py
python backend/test_all_user_flows.py
```

- **Mathematical Collision Check**: 0 out of all returned polyline coordinates touch an obstacle (`1`) cell.
- **Catalog Validation**: All 15 recipes in `backend/recipes.json` map 1-to-1 to verified items in `backend/store_data.json`.
- **API Tests**: Validated empty cart routing, cold-start meal suggestions, 1-tap recipe injection, and mid-trip off-route dynamic rerouting.

---

## Running Locally

### Backend (Python FastAPI)
```powershell
cd C:\Users\nicho\.gemini\antigravity\scratch\grocery-route-optimizer
pip install -r backend/requirements.txt
uvicorn backend.main:app --port 8000 --reload
```

### Frontend (React)
```powershell
cd C:\Users\nicho\.gemini\antigravity\scratch\grocery-route-optimizer\frontend
npm install
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
