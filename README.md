# StoreNav: Mobile-First Indoor Grocery Navigation & Path Optimizer

A full-stack, mobile-first web application that optimizes indoor grocery shopping trips for big-box retailers (Walmart, Target, Costco) by solving a **Perishable-Constrained Traveling Salesperson Problem (TSP)** using **A\*** pathfinding over physical aisle obstacles.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |       Mobile-First React UI           |
                      |  - SVG Floor Plan Canvas              |
                      |  - Turn-by-Turn Guidance Cards        |
                      |  - Crowdsourced Pin Drop Relocator    |
                      +-------------------+-------------------+
                                          |
                                HTTP REST / JSON
                                          |
                      +-------------------v-------------------+
                      |      FastAPI Backend Engine           |
                      |  - Store Floorplan Ingestion          |
                      |  - Retailer Stock / Aisle Adapters    |
                      +-------------------+-------------------+
                                          |
                 +------------------------+------------------------+
                 |                                                 |
+----------------v-------------------+           +-----------------v-----------------+
|   A* Low-Level Pathfinding Engine  |           | Perishable-Constrained TSP Solver |
| - Navigates around physical shelves|           | - Staged Multi-Tier 2-Opt         |
| - Orthogonal transit corridors     |           | - Spoilage Penalty Function       |
| - Precomputes distance matrix      |           | - Enforces Frozen Goods Last      |
+------------------------------------+           +-----------------------------------+
```

---

## Key Features

1. **Store Floor Plan Ingestion (JSON Schema)**
   - Normalized coordinate system mapping perimeter departments (Produce, Bakery, Meat, Dairy), obstacle shelving blocks (dry aisles, freezer coffins, service counters), and transit avenues (Action Alley).
   - Mock test case generated based on the **Fargo, ND Walmart Supercenter #1594** footprint.

2. **Perishables-Last Dynamic Routing**
   - Automatically clusters and sequences items into prioritized tiers:
     - **Tier 1 (Early)**: Shelf-stable dry goods, pantry items, ambient produce/bakery.
     - **Tier 2 (Mid)**: Chilled dairy and refrigerated items.
     - **Tier 3 (Late)**: Raw meats and seafood (minimizing cross-contamination and warming).
     - **Tier 4 (Final)**: Frozen pizzas, ice cream, and frozen desserts immediately preceding checkout.

3. **Low-Level Obstacle Avoidance via A\***
   - Rather than relying on simple Euclidean/Manhattan distance, the engine searches the actual walkable floor grid, avoiding physical shelves and display fixtures.

4. **Crowdsourced Relocation Pin-Drops**
   - Shoppers can report items shifted to seasonal displays or endcaps.
   - The backend graph updates dynamically in real-time, instantly adjusting routes for all subsequent shoppers.

5. **Retailer API Adapter Layer**
   - Simulated adapters for **Walmart Developer Portal** and **Target Red Circle API** providing SKU lookup, real-time inventory count verification, and aisle coordinates (`Aisle A1, Bay 3`).

---

## Directory Structure

```
grocery-route-optimizer/
├── store_layout_fargo.json       # Floorplan, obstacles, zones, and item inventory
├── backend/
│   ├── routing_engine.py         # A* pathfinder, TSP solver, crowdsource graph manager
│   ├── main.py                   # FastAPI REST service
│   └── requirements.txt          # Python dependencies
└── frontend/
    ├── package.json              # React scripts & lucide-react icons
    ├── public/
    │   └── index.html            # Mobile viewport boilerplate
    └── src/
        ├── App.jsx               # Interactive mobile SVG map & navigation
        ├── App.css               # Mobile responsive styling
        └── index.js              # React entry point
```

---

## Running the Backend (Python)

1. Navigate to the project folder:
   ```bash
   cd grocery-route-optimizer
   ```
2. Run the test suite and route demonstration:
   ```bash
   python backend/routing_engine.py
   ```
3. Run the FastAPI REST server:
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```

---

## Running the Mobile Frontend (React)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   npm start
   ```
2. Open on mobile browser or mobile emulator at `http://localhost:3000`.
