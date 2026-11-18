import React, { useState, useEffect, useMemo, useRef } from 'react';
import './App.css';
import StoreMap from './StoreMap';
import NavigationHUD from './NavigationHUD';
import MealSuggestionsDrawer from './MealSuggestionsDrawer';
import {
  ShoppingCart,
  Plus,
  Trash2,
  Search,
  Snowflake,
  Store,
  CheckCircle2,
  ListFilter
} from 'lucide-react';

const API_BASE = "http://localhost:8000";

export default function App() {
  const [layout, setLayout] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [cartItemIds, setCartItemIds] = useState([
    "item_spaghetti",
    "item_marinara",
    "item_ground_beef",
    "item_milk"
  ]);
  const [collectedItemIds, setCollectedItemIds] = useState([]);
  const [perishablesLast, setPerishablesLast] = useState(true);

  // Route & Navigation State
  const [routeData, setRouteData] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Live User Puck Simulation State
  const [userPuck, setUserPuck] = useState({
    x: 3,
    y: 31,
    headingDeg: 0,
    currentPolylineIndex: 0
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1); // 1x or 2x

  const animFrameRef = useRef(null);

  // 1. Fetch Store Layout & Inventory on Mount
  useEffect(() => {
    async function initData() {
      try {
        const layoutRes = await fetch(`${API_BASE}/api/store/layout`);
        if (layoutRes.ok) {
          const lData = await layoutRes.json();
          setLayout(lData);
          if (lData.entrance?.coord) {
            setUserPuck(prev => ({
              ...prev,
              x: lData.entrance.coord[0],
              y: lData.entrance.coord[1]
            }));
          }
        }

        const invRes = await fetch(`${API_BASE}/api/inventory`);
        if (invRes.ok) {
          const iData = await invRes.json();
          setCatalog(iData);
        }
      } catch (err) {
        console.warn("Backend not running or offline, using fallback data:", err);
      }
    }
    initData();
  }, []);

  // 2. Compute Route whenever Cart or Perishables Toggle changes
  const fetchRoute = async (currentPos = null) => {
    try {
      const res = await fetch(`${API_BASE}/api/route/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: "walmart_fargo_13th",
          cart_item_ids: cartItemIds,
          perishables_last: perishablesLast,
          current_position: currentPos
        })
      });

      if (res.ok) {
        const data = await res.json();
        setRouteData(data);
        if (currentPos) {
          setUserPuck(prev => ({
            ...prev,
            x: currentPos[0],
            y: currentPos[1],
            currentPolylineIndex: 0
          }));
        }
      }
    } catch (err) {
      console.error("Failed to optimize route:", err);
    }
  };

  useEffect(() => {
    if (cartItemIds.length > 0) {
      fetchRoute();
    }
  }, [cartItemIds, perishablesLast]);

  // 3. Fetch Meal / Recipe Suggestions whenever Cart changes
  useEffect(() => {
    async function fetchMeals() {
      try {
        const res = await fetch(`${API_BASE}/api/meals/suggest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart_item_ids: cartItemIds })
        });
        if (res.ok) {
          const data = await res.json();
          setRecipes(data.suggestions || []);
        }
      } catch (err) {
        console.error("Failed to fetch recipe suggestions:", err);
      }
    }
    fetchMeals();
  }, [cartItemIds]);

  // Cart Items Objects
  const cartItems = useMemo(() => {
    return cartItemIds.map(id => catalog.find(c => c.item_id === id)).filter(Boolean);
  }, [cartItemIds, catalog]);

  // Determine current active stop and step based on user polyline progress
  const activeStop = useMemo(() => {
    if (!routeData?.ordered_stops) return null;
    return routeData.ordered_stops.find(s => !collectedItemIds.includes(s.item_id)) || null;
  }, [routeData, collectedItemIds]);

  const currentNavStep = useMemo(() => {
    if (!routeData?.navigation_steps || routeData.navigation_steps.length === 0) return null;
    if (!activeStop) return routeData.navigation_steps[routeData.navigation_steps.length - 1];
    const match = routeData.navigation_steps.find(s => s.target_stop_number === activeStop.stop_number);
    return match || routeData.navigation_steps[0];
  }, [routeData, activeStop]);

  // Live distance in feet (remaining polyline cells * 3)
  const liveDistanceFt = useMemo(() => {
    if (!routeData?.polyline_coords) return 0;
    const remainingCells = Math.max(0, routeData.polyline_coords.length - 1 - userPuck.currentPolylineIndex);
    return remainingCells * 3.0;
  }, [routeData, userPuck.currentPolylineIndex]);

  // 4. Real-Time Walking Simulator
  useEffect(() => {
    let timer = null;
    if (isSimulating && routeData?.polyline_coords?.length > 1) {
      const intervalMs = simSpeed === 2 ? 180 : 360;

      timer = setInterval(() => {
        setUserPuck(prev => {
          const nextIdx = prev.currentPolylineIndex + 1;
          if (nextIdx >= routeData.polyline_coords.length) {
            setIsSimulating(false);
            return prev;
          }

          const curr = routeData.polyline_coords[prev.currentPolylineIndex];
          const next = routeData.polyline_coords[nextIdx];
          const dx = next[0] - curr[0];
          const dy = next[1] - curr[1];
          const heading = (Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360;

          // Check if user arrived at active stop's access_coord
          if (activeStop && next[0] === activeStop.access_coord[0] && next[1] === activeStop.access_coord[1]) {
            if (!collectedItemIds.includes(activeStop.item_id)) {
              setCollectedItemIds(c => [...c, activeStop.item_id]);
            }
          }

          return {
            x: next[0],
            y: next[1],
            headingDeg: Math.round(heading),
            currentPolylineIndex: nextIdx
          };
        });
      }, intervalMs);
    }
    return () => clearInterval(timer);
  }, [isSimulating, simSpeed, routeData, activeStop, collectedItemIds]);

  // Toggle Item in Cart
  const toggleCartItem = (itemId) => {
    if (cartItemIds.includes(itemId)) {
      setCartItemIds(cartItemIds.filter(id => id !== itemId));
      setCollectedItemIds(collectedItemIds.filter(id => id !== itemId));
    } else {
      setCartItemIds([...cartItemIds, itemId]);
    }
  };

  // Add Missing Recipe Items and Reroute
  const handleAddMissingItemsAndReroute = (missingIds) => {
    const updated = Array.from(new Set([...cartItemIds, ...missingIds]));
    setCartItemIds(updated);
  };

  // Mark Target Item Picked Up
  const handleMarkNextItemPicked = () => {
    if (activeStop) {
      setCollectedItemIds(prev => [...prev, activeStop.item_id]);
    }
  };

  // Off-Route Test: shift puck 2 aisles over and trigger live dynamic rerouting
  const handleOffRouteTest = () => {
    if (!layout) return;
    // Shift user horizontally to test off-route recalculation
    const shiftedX = Math.min(layout.grid_dimensions.cols - 3, userPuck.x + 8);
    const shiftedY = userPuck.y;
    fetchRoute([shiftedX, shiftedY]);
  };

  const isTripFinished = collectedItemIds.length === cartItemIds.length && cartItemIds.length > 0;

  return (
    <div className="app-shell">
      {/* TOP HEADER */}
      <header className="app-top-header">
        <div className="header-brand">
          <Store size={22} className="text-blue-500" />
          <span className="brand-name">StoreNav</span>
          <span className="store-pill">Walmart Fargo #1594</span>
        </div>

        <div className="header-actions">
          {/* Perishables Last Toggle */}
          <button
            className={`btn-perishables-toggle ${perishablesLast ? 'active' : ''}`}
            onClick={() => setPerishablesLast(!perishablesLast)}
            title="When active, groups frozen goods and raw meats to be visited right before checkout"
          >
            <Snowflake size={15} />
            <span>Perishables Last</span>
          </button>

          {/* Manage Cart Button */}
          <button className="btn-cart-toggle" onClick={() => setIsCatalogOpen(true)}>
            <ShoppingCart size={16} />
            <span>Cart ({cartItemIds.length})</span>
          </button>
        </div>
      </header>

      {/* GOOGLE MAPS NAVIGATION HUD BANNER */}
      <NavigationHUD
        currentStep={currentNavStep}
        nextItem={activeStop}
        liveDistanceFt={liveDistanceFt}
        isSimulating={isSimulating}
        simSpeed={simSpeed}
        onToggleSimulate={() => setIsSimulating(!isSimulating)}
        onToggleSpeed={() => setSimSpeed(simSpeed === 1 ? 2 : 1)}
        onMarkNextItemPicked={handleMarkNextItemPicked}
        onOffRouteTest={handleOffRouteTest}
        isFinished={isTripFinished}
      />

      {/* CLEAN FLOOR PLAN MAP CANVAS */}
      <main className="main-map-viewport">
        <StoreMap
          layout={layout}
          orderedStops={routeData?.ordered_stops}
          collectedItemIds={collectedItemIds}
          polylineCoords={routeData?.polyline_coords}
          userPuck={userPuck}
          onShelfPinClick={(stop) => {
            if (!collectedItemIds.includes(stop.item_id)) {
              setCollectedItemIds(prev => [...prev, stop.item_id]);
            }
          }}
        />
      </main>

      {/* SMART MEAL SUGGESTIONS & MACRO DRAWER */}
      <MealSuggestionsDrawer
        cartItems={cartItems}
        recipes={recipes}
        routeStats={{
          totalDistanceFt: routeData?.total_distance_ft || 0,
          aislesVisitedCount: routeData?.aisles_visited?.length || 0,
          totalAislesCount: 8
        }}
        onAddMissingItemsAndReroute={handleAddMissingItemsAndReroute}
        onRemoveItemFromCart={toggleCartItem}
      />

      {/* CATALOG / CART SELECTION MODAL */}
      {isCatalogOpen && (
        <div className="modal-overlay">
          <div className="catalog-modal">
            <div className="catalog-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart size={18} className="text-blue-400" />
                <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Store Catalog & Cart</span>
              </div>
              <button className="btn-close-modal" onClick={() => setIsCatalogOpen(false)}>✕</button>
            </div>

            <div className="catalog-search-row">
              <Search size={16} className="search-icon-muted" />
              <input
                type="text"
                placeholder="Search 40+ products, aisles, proteins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="catalog-search-input"
              />
            </div>

            <div className="catalog-items-list">
              {catalog
                .filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.aisle.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(item => {
                  const inCart = cartItemIds.includes(item.item_id);
                  return (
                    <div key={item.item_id} className={`catalog-item-row ${inCart ? 'in-cart' : ''}`}>
                      <div className="item-info">
                        <div className="item-name">{item.name}</div>
                        <div className="item-meta">
                          <span className="item-aisle">{item.aisle}</span>
                          <span>•</span>
                          <span className="item-price">${item.price.toFixed(2)}</span>
                          <span>•</span>
                          <span className="item-cals">{item.macros?.calories} cals</span>
                          <span>•</span>
                          <span className="item-protein">{item.macros?.protein_g}g protein</span>
                        </div>
                      </div>
                      <button
                        className={`btn-add-cart ${inCart ? 'added' : ''}`}
                        onClick={() => toggleCartItem(item.item_id)}
                      >
                        {inCart ? <Trash2 size={14} /> : <Plus size={14} />}
                        <span>{inCart ? "Remove" : "Add"}</span>
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
