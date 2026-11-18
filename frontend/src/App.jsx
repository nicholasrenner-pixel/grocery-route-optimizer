import React, { useState, useEffect, useMemo, useRef } from 'react';
import './App.css';
import StoreMap from './StoreMap';
import NavigationHUD from './NavigationHUD';
import ActiveCartPanel from './ActiveCartPanel';
import {
  Store,
  Snowflake,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const API_BASE = (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) || "http://localhost:8000";
const CART_STORAGE_KEY = "storenav_cart_v2";

export default function App() {
  const [layout, setLayout] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [perishablesLast, setPerishablesLast] = useState(true);

  // Single Source of Truth Cart State: Record<string, CartEntry>
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to read cart from localStorage:", e);
    }
    // Default starter dinner list
    return {
      item_spaghetti: { item_id: "item_spaghetti", quantity: 1, checked_off: false },
      item_marinara: { item_id: "item_marinara", quantity: 1, checked_off: false },
      item_ground_beef: { item_id: "item_ground_beef", quantity: 1, checked_off: false },
      item_milk: { item_id: "item_milk", quantity: 1, checked_off: false }
    };
  });

  // Active Tab on Right Pane: 'cart' | 'meals' | 'search'
  const [activeRightTab, setActiveRightTab] = useState("cart");

  // Route & Navigation State
  const [routeData, setRouteData] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // User Puck Navigation State
  const [userPuck, setUserPuck] = useState({
    x: 3,
    y: 31,
    headingDeg: 0,
    currentPolylineIndex: 0
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1); // 1x or 2x

  const debounceTimerRef = useRef(null);

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch (e) {
      console.error("Failed to write cart to localStorage:", e);
    }
  }, [cartItems]);

  // 1. Fetch Store Layout & Inventory on Mount
  useEffect(() => {
    async function loadStore() {
      try {
        const [lRes, iRes] = await Promise.all([
          fetch(`${API_BASE}/api/store/layout`),
          fetch(`${API_BASE}/api/inventory`)
        ]);

        if (lRes.ok) {
          const lData = await lRes.json();
          setLayout(lData);
          if (lData.entrance?.coord) {
            setUserPuck(prev => ({
              ...prev,
              x: lData.entrance.coord[0],
              y: lData.entrance.coord[1]
            }));
          }
        }

        if (iRes.ok) {
          const iData = await iRes.json();
          setCatalog(iData);
        }
      } catch (err) {
        console.warn("API offline or initial load fallback:", err);
      }
    }
    loadStore();
  }, []);

  // 2. Hydrate cart entries with catalog metadata (price, macros, aisle, coords)
  const cartEntries = useMemo(() => {
    if (!catalog.length) return [];
    return Object.entries(cartItems).map(([id, entry]) => {
      const fullItem = catalog.find(c => c.item_id === id);
      if (!fullItem) return null;
      return {
        ...fullItem,
        quantity: entry.quantity || 1,
        checked_off: !!entry.checked_off
      };
    }).filter(Boolean);
  }, [cartItems, catalog]);

  // 3. Fetch Route with Debounce (~150ms)
  const fetchRoute = async (currentPos = null) => {
    const itemIds = Object.keys(cartItems);
    try {
      const res = await fetch(`${API_BASE}/api/route/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: "walmart_fargo_13th",
          cart_item_ids: itemIds,
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
      console.error("Route optimization failed:", err);
    }
  };

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchRoute();
    }, 150);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [cartItems, perishablesLast]);

  // 4. Fetch Recipes (with cold-start support)
  useEffect(() => {
    async function fetchMeals() {
      const itemIds = Object.keys(cartItems);
      try {
        const res = await fetch(`${API_BASE}/api/meals/suggest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart_item_ids: itemIds })
        });
        if (res.ok) {
          const data = await res.json();
          setRecipes(data.suggestions || []);
        }
      } catch (err) {
        console.error("Meal suggestions fetch failed:", err);
      }
    }
    fetchMeals();
  }, [cartItems]);

  // Helper Toast Trigger
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 5. Cart Mutations (Optimistic State Updates)
  const handleAddItemToCart = (item) => {
    setCartItems(prev => {
      const existing = prev[item.item_id];
      const newQty = existing ? (existing.quantity || 1) + 1 : 1;
      return {
        ...prev,
        [item.item_id]: {
          item_id: item.item_id,
          quantity: newQty,
          checked_off: false
        }
      };
    });
    showToast(`Added ${item.name} to cart — Route Updated!`);
  };

  const handleUpdateQuantity = (itemId, newQty) => {
    if (newQty <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    setCartItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        quantity: newQty
      }
    }));
  };

  const handleRemoveItem = (itemId) => {
    setCartItems(prev => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
    showToast("Item removed from cart — Route Updated!");
  };

  const handleToggleCheckItem = (itemId) => {
    setCartItems(prev => {
      const curr = prev[itemId];
      if (!curr) return prev;
      return {
        ...prev,
        [itemId]: {
          ...curr,
          checked_off: !curr.checked_off
        }
      };
    });
  };

  // Add all missing items for a recipe in one atomic state update
  const handleAddMissingItemsAndReroute = (missingItemIds, recipeTitle = "Meal Kit") => {
    setCartItems(prev => {
      const next = { ...prev };
      missingItemIds.forEach(id => {
        if (!next[id]) {
          next[id] = { item_id: id, quantity: 1, checked_off: false };
        }
      });
      return next;
    });
    showToast(`Added ${missingItemIds.length} ingredients for ${recipeTitle} — Route Updated!`);
    setActiveRightTab("cart");
  };

  // 6. Active Stop & Step Tracking
  const orderedStopsWithCartState = useMemo(() => {
    if (!routeData?.ordered_stops) return [];
    return routeData.ordered_stops.map(stop => ({
      ...stop,
      checked_off: !!cartItems[stop.item_id]?.checked_off,
      quantity: cartItems[stop.item_id]?.quantity || 1
    }));
  }, [routeData, cartItems]);

  const activeStop = useMemo(() => {
    return orderedStopsWithCartState.find(s => !s.checked_off) || null;
  }, [orderedStopsWithCartState]);

  const currentNavStep = useMemo(() => {
    if (!routeData?.navigation_steps?.length) return null;
    if (!activeStop) return routeData.navigation_steps[routeData.navigation_steps.length - 1];
    return routeData.navigation_steps.find(s => s.target_stop_number === activeStop.stop_number) || routeData.navigation_steps[0];
  }, [routeData, activeStop]);

  // Live countdown distance in feet
  const liveDistanceFt = useMemo(() => {
    if (!routeData?.polyline_coords) return 0;
    const remainingCells = Math.max(0, routeData.polyline_coords.length - 1 - userPuck.currentPolylineIndex);
    return remainingCells * 3.0;
  }, [routeData, userPuck.currentPolylineIndex]);

  // 7. Interactive Walk Simulator Loop
  useEffect(() => {
    let timer = null;
    if (isSimulating && routeData?.polyline_coords?.length > 1) {
      const intervalMs = simSpeed === 2 ? 160 : 320;

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

          // If reached active stop's access_coord, auto check it off
          if (activeStop && next[0] === activeStop.access_coord[0] && next[1] === activeStop.access_coord[1]) {
            handleToggleCheckItem(activeStop.item_id);
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
  }, [isSimulating, simSpeed, routeData, activeStop]);

  // Manual Step Forward
  const handleStepForward = () => {
    if (!routeData?.polyline_coords?.length) return;
    setUserPuck(prev => {
      const nextIdx = Math.min(routeData.polyline_coords.length - 1, prev.currentPolylineIndex + 1);
      const curr = routeData.polyline_coords[prev.currentPolylineIndex];
      const next = routeData.polyline_coords[nextIdx];
      const dx = next[0] - curr[0];
      const dy = next[1] - curr[1];
      const heading = (Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360;
      return {
        x: next[0],
        y: next[1],
        headingDeg: Math.round(heading),
        currentPolylineIndex: nextIdx
      };
    });
  };

  // Reset Walk to Entrance
  const handleResetWalk = () => {
    setIsSimulating(false);
    if (layout?.entrance?.coord) {
      setUserPuck({
        x: layout.entrance.coord[0],
        y: layout.entrance.coord[1],
        headingDeg: 0,
        currentPolylineIndex: 0
      });
      fetchRoute();
    }
  };

  // Off-Route Test: shift puck 2 aisles over and trigger live dynamic rerouting
  const handleOffRouteTest = () => {
    if (!layout) return;
    const shiftedX = Math.min(layout.grid_dimensions.cols - 3, userPuck.x + 8);
    const shiftedY = userPuck.y;
    fetchRoute([shiftedX, shiftedY]);
    showToast("Off-route detected! Dynamic route recalculated from current position.");
  };

  const isTripFinished = Object.keys(cartItems).length > 0 &&
    Object.values(cartItems).every(e => e.checked_off);

  const collectedCount = Object.values(cartItems).filter(e => e.checked_off).length;

  return (
    <div className="unified-app-layout">
      {/* GLOBAL TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="global-toast">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP NAVBAR */}
      <header className="global-navbar">
        <div className="nav-brand-group">
          <Store size={22} className="text-blue-500" />
          <span className="nav-brand-title">StoreNav</span>
          <span className="nav-store-badge">Walmart Supercenter #1594</span>
        </div>

        <div className="nav-actions-group">
          <button
            className={`btn-perishable-chip ${perishablesLast ? 'active' : ''}`}
            onClick={() => setPerishablesLast(!perishablesLast)}
            title="When active, keeps frozen treats and meats at the end of the walking path"
          >
            <Snowflake size={14} />
            <span>Perishables Last</span>
          </button>
        </div>
      </header>

      {/* UNIFIED SIDE-BY-SIDE SPLIT SCREEN WORKSPACE */}
      <div className="split-screen-workspace">
        {/* LEFT PANE (65% on Desktop): LIVE MAP & TURN-BY-TURN HUD */}
        <section className="left-map-pane">
          {/* Top Google Maps Navigation HUD Banner */}
          <NavigationHUD
            currentStep={currentNavStep}
            nextItem={activeStop}
            liveDistanceFt={liveDistanceFt}
            isSimulating={isSimulating}
            simSpeed={simSpeed}
            onToggleSimulate={() => setIsSimulating(!isSimulating)}
            onToggleSpeed={() => setSimSpeed(simSpeed === 1 ? 2 : 1)}
            onStepForward={handleStepForward}
            onResetWalk={handleResetWalk}
            onOffRouteTest={handleOffRouteTest}
            isFinished={isTripFinished}
            totalStops={orderedStopsWithCartState.length}
            completedStopsCount={collectedCount}
          />

          {/* Clean Floor Plan Map Canvas */}
          <div className="map-canvas-container">
            <StoreMap
              layout={layout}
              orderedStops={orderedStopsWithCartState}
              collectedItemIds={Object.keys(cartItems).filter(id => cartItems[id]?.checked_off)}
              polylineCoords={routeData?.polyline_coords}
              userPuck={userPuck}
              onShelfPinClick={(stop) => handleToggleCheckItem(stop.item_id)}
            />
          </div>
        </section>

        {/* RIGHT PANE (35% on Desktop): PERSISTENT ACTIVE CART & MEAL TABS */}
        <section className="right-cart-pane">
          <ActiveCartPanel
            activeTab={activeRightTab}
            onSelectTab={setActiveRightTab}
            cartEntries={cartEntries}
            orderedStops={orderedStopsWithCartState}
            catalog={catalog}
            recipes={recipes}
            routeStats={{
              totalDistanceFt: routeData?.total_distance_ft || 0,
              aislesVisitedCount: routeData?.aisles_visited?.length || 0,
              totalAislesCount: 8,
              currentStopIdx: orderedStopsWithCartState.findIndex(s => !s.checked_off),
              totalStops: orderedStopsWithCartState.length
            }}
            onToggleCheckItem={handleToggleCheckItem}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onAddItemToCart={handleAddItemToCart}
            onAddMissingItemsAndReroute={handleAddMissingItemsAndReroute}
          />
        </section>
      </div>
    </div>
  );
}
