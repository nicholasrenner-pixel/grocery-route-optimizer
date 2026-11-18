# StoreNav Pro: Mobile-First Indoor Grocery Navigation, Macro Optimizer & IPS Engine

A full-stack, mobile-first web application engineered for big-box retailers (**Walmart**, **Target**, and **Costco**) that combines **A\* Pathfinding**, a **Perishable-Constrained Traveling Salesperson Problem (TSP)**, **Indoor Positioning (BLE / PDR / AR)**, and a **Nutritional Macro Tracking & Smart Substitution Engine**.

---

## System Architecture

```
                                +---------------------------------------------+
                                |          Mobile-First React UI              |
                                |  - Interactive SVG Floor Plan               |
                                |  - Real-Time "Blue Dot" (Heading & Pulse)   |
                                |  - Running Macro & Cart Totals Bar          |
                                |  - Camera Barcode Scanner Viewfinder        |
                                |  - Smart Macro Substitution Dialog          |
                                +----------------------+----------------------+
                                                       |
                                              HTTP REST / JSON
                                                       |
                                +----------------------v----------------------+
                                |             FastAPI Backend Engine          |
                                |  - Multi-Retailer Floorplan Ingestion       |
                                |  - Target Red Circle & Walmart API Adapters |
                                |  - Barcode UPC Product Lookup               |
                                +----------------------+----------------------+
                                                       |
        +----------------------------------------------+----------------------------------------------+
        |                                              |                                              |
+-------v-------------------------+     +--------------v--------------------+     +-------------------v-------------------+
|  Indoor Positioning System (IPS)|     |  Perishable-Aware TSP Pathfinder  |     |  Nutritional Macro & Sub Engine       |
| - BLE Beacon RSSI Log-Distance  |     | - A* Obstacle Avoidance           |     | - Running Calories, Protein, C, F     |
| - Weighted Trilateration        |     | - Perishables-Last Prioritization |     | - Cosine Similarity Macro Match       |
| - Pedestrian Dead Reckoning(PDR)|     | - Mid-Trip Dynamic Rerouting      |     | - Distance-Penalized Substitution     |
| - Topological Aisle Snapping    |     | - Turn-by-Turn Guidance Steps     |     | - Cart Total Cost Aggregation         |
+---------------------------------+     +-----------------------------------+     +---------------------------------------+
```

---

## Key Modules & Value-Added Features

### 1. Real-Time Indoor Navigation ("The Blue Dot Experience")
Standard GPS satellite signals cannot penetrate commercial steel-deck supercenter roofs. StoreNav resolves indoor location using a three-tier sensor fusion architecture:
- **Bluetooth Low Energy (BLE) Beacon Trilateration**:
  Uses the Log-Distance Path Loss Model:
  $$\text{RSSI} = \text{TxPower} - 10 \cdot n \cdot \log_{10}(d) + X_\sigma$$
  where $n = 2.4$ in metal shelving environments. Inverts RSSI signals across 3+ overhead beacons to solve non-linear least-squares trilateration.
- **Pedestrian Dead Reckoning (PDR)**:
  Estimates step count and step lengths ($L = k \cdot \sqrt[4]{a_{\max} - a_{\min}}$) coupled with device gyroscope compass heading.
- **Topological Aisle Snapping**:
  Map-matching algorithms project noisy radio coordinates onto walkable aisle centerlines so the blue dot never teleports inside metal shelves.

### 2. Nutritional Macros & Running Cart Totals
- Real-time tracking of cumulative **Calories**, **Protein (g)**, **Carbohydrates (g)**, **Fats (g)**, and **Fiber (g)**.
- Running financial total ($) updating as items are collected in the cart.
- Caloric ratio distribution bar (visualizing % Protein / % Carbs / % Fat).

### 3. Smart Substitutions Engine
When a shopper marks an item "Out of Stock":
1. Analyzes in-stock alternatives across the store.
2. Computes the **Macronutrient Cosine Similarity Vector**:
   $$\text{Sim}(\vec{u}, \vec{v}) = \frac{\vec{u} \cdot \vec{v}}{\|\vec{u}\| \|\vec{v}\|}$$
3. Factors in walking distance from the user's active Blue Dot coordinate:
   $$\text{Score} = 0.55 \cdot \text{MacroSim} + 0.25 \cdot \text{CategoryMatch} + 0.20 \cdot \text{DistanceFactor}$$
4. Recommends the highest-scoring replacement (e.g. swapping Boneless Chicken Breast for 99% Lean Ground Turkey Breast).
5. **Dynamic Rerouting**: Instantly replans the remainder of the TSP walking path from the shopper's current location.

### 4. Perishables-Last Dynamic TSP Routing
Automatically sequences items into 4 prioritized tiers:
1. **Tier 1 (Early)**: Shelf-stable dry goods, pantry items, ambient produce/bakery.
2. **Tier 2 (Mid)**: Chilled dairy and refrigerated eggs/cheese.
3. **Tier 3 (Late)**: Raw meats and seafood (minimizing warming & raw juice exposure).
4. **Tier 4 (Final)**: Frozen foods and ice cream immediately preceding checkout registers.

### 5. Camera Barcode Scanner Integration
- Frontend camera viewfinder with animated laser guide.
- UPC/EAN barcode recognition automatically verifies picked items, crossing them off the spatial map and updating running cart totals.

---

## Directory Structure

```
grocery-route-optimizer/
├── store_layout_fargo.json         # Multi-retailer layout, BLE beacons, and macro inventory
├── backend/
│   ├── indoor_positioning.py       # BLE RSSI path loss, trilateration, PDR, and aisle snapping
│   ├── macro_engine.py             # Macro aggregation & Cosine similarity substitution
│   ├── routing_engine.py           # A* pathfinder, Perishable-Aware TSP solver, Retailer API mock
│   ├── main.py                     # FastAPI REST service
│   ├── test_suite.py               # Automated verification test suite
│   └── requirements.txt            # Python dependencies
└── frontend/
    ├── package.json
    ├── public/
    │   └── index.html              # Mobile viewport boilerplate
    └── src/
        ├── App.jsx                 # Mobile UI, Blue Dot SVG map, Macro Bar, Scanner Modal
        ├── App.css                 # Responsive styles, pulse animations, and modal themes
        └── index.js
```

---

## Running the Backend

```powershell
cd C:\Users\nicho\.gemini\antigravity\scratch\grocery-route-optimizer
pip install -r backend/requirements.txt
python backend/test_suite.py
uvicorn backend.main:app --port 8000 --reload
```

## Running the Mobile Frontend

```powershell
cd C:\Users\nicho\.gemini\antigravity\scratch\grocery-route-optimizer\frontend
npm install
npm start
```
Open [http://localhost:3000](http://localhost:3000) on your mobile device or mobile viewport emulator.
