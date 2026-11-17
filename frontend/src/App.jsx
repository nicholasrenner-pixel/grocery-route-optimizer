import React, { useState, useMemo } from 'react';
import './App.css';
import {
  ShoppingCart,
  Navigation,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Snowflake,
  Flame,
  Search,
  Plus,
  Trash2,
  ArrowRight,
  Store,
  Layers,
  Sparkles
} from 'lucide-react';

// Default Fargo Walmart Store Layout Mock
const FARGO_STORE_DATA = {
  metadata: {
    store_name: "Walmart Supercenter #1594",
    location: "4731 13th Ave S, Fargo, ND",
    grid: { width: 60, height: 40, cellSize: 4 }
  },
  entrance: { x: 5, y: 38, name: "Grocery Entrance" },
  checkout: { x: 10, y: 34, name: "Self-Checkout A" },
  zones: [
    { id: "produce", name: "Produce", color: "rgba(16, 185, 129, 0.15)", border: "#10b981", x1: 2, y1: 22, x2: 14, y2: 32 },
    { id: "bakery", name: "Bakery/Deli", color: "rgba(245, 158, 11, 0.15)", border: "#f59e0b", x1: 2, y1: 12, x2: 14, y2: 20 },
    { id: "meat", name: "Meat & Seafood", color: "rgba(239, 68, 68, 0.15)", border: "#ef4444", x1: 2, y1: 2, x2: 26, y2: 8 },
    { id: "dairy", name: "Dairy Wall", color: "rgba(56, 189, 248, 0.15)", border: "#38bdf8", x1: 28, y1: 2, x2: 56, y2: 7 },
    { id: "grocery", name: "Center Grocery", color: "rgba(99, 102, 241, 0.15)", border: "#6366f1", x1: 16, y1: 10, x2: 36, y2: 30 },
    { id: "frozen", name: "Frozen Foods", color: "rgba(6, 182, 212, 0.15)", border: "#06b6d4", x1: 38, y1: 10, x2: 48, y2: 30 },
    { id: "seasonal", name: "Seasonal / Promo", color: "rgba(236, 72, 153, 0.15)", border: "#ec4899", x1: 50, y1: 10, x2: 58, y2: 30 }
  ],
  shelves: [
    { id: "A1", x: 18, y: 12, w: 2, h: 14, label: "A1 Pasta" },
    { id: "A2", x: 23, y: 12, w: 2, h: 14, label: "A2 Canned" },
    { id: "A3", x: 28, y: 12, w: 2, h: 14, label: "A3 Cereal" },
    { id: "A4", x: 33, y: 12, w: 2, h: 14, label: "A4 Snacks" },
    { id: "F1", x: 40, y: 12, w: 2, h: 14, label: "F1 Dinners" },
    { id: "F2", x: 45, y: 12, w: 2, h: 14, label: "F2 Ice Cream" },
    { id: "prod_island", x: 5, y: 24, w: 6, h: 6, label: "Produce Island" }
  ],
  initialInventory: [
    {
      sku: "WMT-00101",
      name: "Barilla Spaghetti Pasta 16oz",
      aisle: "Aisle A1",
      perishable: "shelf_stable",
      price: 1.78,
      inStock: true,
      stockCount: 42,
      x: 17,
      y: 16
    },
    {
      sku: "WMT-00501",
      name: "Fresh Organic Bananas (Bunch)",
      aisle: "Produce Island 2",
      perishable: "ambient_fresh",
      price: 1.48,
      inStock: true,
      stockCount: 110,
      x: 4,
      y: 26
    },
    {
      sku: "WMT-00701",
      name: "Great Value Whole Milk 1 Gal",
      aisle: "Dairy Wall D2",
      perishable: "chilled_dairy",
      price: 3.12,
      inStock: true,
      stockCount: 65,
      x: 32,
      y: 4
    },
    {
      sku: "WMT-00801",
      name: "USDA Choice Angus Ribeye 1.2lb",
      aisle: "Meat Wall M1",
      perishable: "raw_meat_seafood",
      price: 14.50,
      inStock: true,
      stockCount: 12,
      x: 8,
      y: 4
    },
    {
      sku: "WMT-00902",
      name: "Ben & Jerry's Chocolate Fudge Pint",
      aisle: "Aisle F2",
      perishable: "frozen_goods",
      price: 4.68,
      inStock: true,
      stockCount: 19,
      x: 47,
      y: 22
    },
    {
      sku: "WMT-00401",
      name: "Lay's Classic Potato Chips",
      aisle: "Aisle A4",
      perishable: "shelf_stable",
      price: 4.48,
      inStock: true,
      stockCount: 50,
      x: 32,
      y: 13
    },
    {
      sku: "WMT-00901",
      name: "DiGiorno Rising Crust Pizza",
      aisle: "Aisle F1",
      perishable: "frozen_goods",
      price: 6.48,
      inStock: true,
      stockCount: 31,
      x: 39,
      y: 18
    }
  ]
};

// Priority tier mapping: 1 is visited first, 4 is visited last right before checkout
const PERISHABLE_PRIORITY = {
  shelf_stable: 1,
  ambient_fresh: 1,
  chilled_dairy: 2,
  raw_meat_seafood: 3,
  frozen_goods: 4
};

export default function App() {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'map' | 'navigate'
  const [catalog, setCatalog] = useState(FARGO_STORE_DATA.initialInventory);
  const [selectedSkus, setSelectedSkus] = useState([
    "WMT-00501", // Bananas
    "WMT-00101", // Pasta
    "WMT-00701", // Milk
    "WMT-00801", // Ribeye
    "WMT-00902"  // Ice Cream
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [perishablesLast, setPerishablesLast] = useState(true);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // Crowdsourcing Pin Drop State
  const [crowdsourceItem, setCrowdsourceItem] = useState(null);
  const [crowdsourceNotice, setCrowdsourceNotice] = useState(null);

  // Selected Item objects
  const selectedItems = useMemo(() => {
    return selectedSkus.map(sku => catalog.find(i => i.sku === sku)).filter(Boolean);
  }, [selectedSkus, catalog]);

  // TSP Routing Logic (Heuristic with Perishable Weighting)
  const routeResult = useMemo(() => {
    if (selectedItems.length === 0) return { items: [], polyline: [], totalDistance: 0, steps: [] };

    let itemsToSort = [...selectedItems];

    if (perishablesLast) {
      // Group by perishable tier, then order within tier by distance from previous waypoint
      itemsToSort.sort((a, b) => {
        const tierA = PERISHABLE_PRIORITY[a.perishable] || 1;
        const tierB = PERISHABLE_PRIORITY[b.perishable] || 1;
        if (tierA !== tierB) return tierA - tierB;
        // Secondary sort: Euclidean distance from entrance
        const distA = Math.hypot(a.x - FARGO_STORE_DATA.entrance.x, a.y - FARGO_STORE_DATA.entrance.y);
        const distB = Math.hypot(b.x - FARGO_STORE_DATA.entrance.x, b.y - FARGO_STORE_DATA.entrance.y);
        return distA - distB;
      });
    } else {
      // Pure nearest-neighbor heuristic ignoring perishability
      let unvisited = [...itemsToSort];
      let current = FARGO_STORE_DATA.entrance;
      const sorted = [];
      while (unvisited.length > 0) {
        let nearestIdx = 0;
        let minDist = Infinity;
        unvisited.forEach((item, idx) => {
          const d = Math.hypot(item.x - current.x, item.y - current.y);
          if (d < minDist) {
            minDist = d;
            nearestIdx = idx;
          }
        });
        const chosen = unvisited.splice(nearestIdx, 1)[0];
        sorted.push(chosen);
        current = chosen;
      }
      itemsToSort = sorted;
    }

    // Generate walking polyline (Entrance -> Item 1 -> ... -> Item N -> Checkout)
    const points = [
      FARGO_STORE_DATA.entrance,
      ...itemsToSort.map(item => ({ x: item.x, y: item.y })),
      FARGO_STORE_DATA.checkout
    ];

    let totalDist = 0;
    const steps = [];

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      // Manhattan walking distance around aisles in feet (cellSize = 4ft)
      const legDist = (Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y)) * 4;
      totalDist += legDist;

      if (i === 0) {
        steps.push({
          num: 1,
          instruction: `Enter via ${FARGO_STORE_DATA.entrance.name} and proceed to ${itemsToSort[0].aisle}`,
          target: itemsToSort[0].name,
          aisle: itemsToSort[0].aisle,
          distance: legDist,
          sku: itemsToSort[0].sku
        });
      } else if (i === points.length - 2) {
        steps.push({
          num: i + 1,
          instruction: `Pick up ${itemsToSort[i - 1].name} and head to ${FARGO_STORE_DATA.checkout.name}`,
          target: "Checkout Register",
          aisle: "Front Register Lane",
          distance: legDist,
          sku: "CHECKOUT"
        });
      } else {
        steps.push({
          num: i + 1,
          instruction: `Head to ${itemsToSort[i].aisle} for ${itemsToSort[i].name}`,
          target: itemsToSort[i].name,
          aisle: itemsToSort[i].aisle,
          distance: legDist,
          sku: itemsToSort[i].sku
        });
      }
    }

    return {
      items: itemsToSort,
      polyline: points,
      totalDistance: Math.round(totalDist),
      steps
    };
  }, [selectedItems, perishablesLast]);

  // Handle map click for crowdsourced item relocation
  const handleMapClick = (e) => {
    if (!crowdsourceItem) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert SVG pixel to 60x40 grid coords
    const gridX = Math.round((clickX / rect.width) * 60);
    const gridY = Math.round((clickY / rect.height) * 40);

    // Update catalog item coordinate dynamically
    setCatalog(prev => prev.map(item => {
      if (item.sku === crowdsourceItem.sku) {
        return {
          ...item,
          x: gridX,
          y: gridY,
          aisle: `Seasonal Endcap (${gridX}, ${gridY})`
        };
      }
      return item;
    }));

    setCrowdsourceNotice(`Successfully moved "${crowdsourceItem.name}" to Endcap (${gridX}, ${gridY}). Routing updated!`);
    setCrowdsourceItem(null);
    setTimeout(() => setCrowdsourceNotice(null), 5000);
  };

  const toggleItem = (sku) => {
    if (selectedSkus.includes(sku)) {
      setSelectedSkus(selectedSkus.filter(s => s !== sku));
    } else {
      setSelectedSkus([...selectedSkus, sku]);
    }
  };

  const filteredCatalog = catalog.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.aisle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mobile-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-top">
          <div className="brand-badge">
            <Store size={22} />
            <span>StoreNav</span>
          </div>
          <span className="badge badge-dairy">Walmart Supercenter</span>
        </div>
        <div className="store-selector">
          <MapPin size={16} className="text-blue-400" />
          <div>
            <div style={{ fontWeight: 600 }}>{FARGO_STORE_DATA.metadata.store_name}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{FARGO_STORE_DATA.metadata.location}</div>
          </div>
        </div>
      </header>

      {/* Crowdsource Notice Banner */}
      {crowdsourceNotice && (
        <div className="pin-mode-banner" style={{ margin: '8px 16px 0 16px' }}>
          <span>{crowdsourceNotice}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          Shopping List ({selectedSkus.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          Store Floorplan
        </button>
        <button
          className={`tab-btn ${activeTab === 'navigate' ? 'active' : ''}`}
          onClick={() => setActiveTab('navigate')}
        >
          Turn-by-Turn
        </button>
      </div>

      {/* Tab Content */}
      <main className="tab-content">
        {activeTab === 'list' && (
          <div>
            {/* Search */}
            <div className="search-wrapper">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                className="search-input"
                placeholder="Search grocery inventory, aisle, brand..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Perishables-Last Rule Toggle */}
            <div style={{
              background: '#1e293b',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid #334155',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Snowflake size={18} color="#38bdf8" />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Perishables Last Rule</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Frozen goods & meats placed at route end
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={perishablesLast}
                onChange={() => setPerishablesLast(!perishablesLast)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>

            {/* Catalog List */}
            <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' }}>
              Store Assortment (Live Stock API)
            </h3>
            {filteredCatalog.map(item => {
              const isSelected = selectedSkus.includes(item.sku);
              const badgeClass =
                item.perishable === 'frozen_goods' ? 'badge-frozen' :
                item.perishable === 'raw_meat_seafood' ? 'badge-meat' :
                item.perishable === 'chilled_dairy' ? 'badge-dairy' :
                item.perishable === 'ambient_fresh' ? 'badge-produce' : 'badge-dry';

              return (
                <div key={item.sku} className="item-card">
                  <div>
                    <div className="item-title">{item.name}</div>
                    <div className="item-meta">
                      <span className={`badge ${badgeClass}`}>{item.perishable.replace('_', ' ')}</span>
                      <span>{item.aisle}</span>
                      <span style={{ color: item.inStock ? '#34d399' : '#ef4444' }}>
                        {item.inStock ? `In Stock (${item.stockCount})` : 'Out of Stock'}
                      </span>
                      <span>${item.price.toFixed(2)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className={`btn-primary btn-sm ${isSelected ? 'btn-outline' : ''}`}
                      onClick={() => toggleItem(item.sku)}
                    >
                      {isSelected ? <Trash2 size={14} /> : <Plus size={14} />}
                      {isSelected ? "Remove" : "Add"}
                    </button>
                    <button
                      title="Report Relocated Item"
                      className="btn-outline btn-sm"
                      onClick={() => {
                        setCrowdsourceItem(item);
                        setActiveTab('map');
                      }}
                    >
                      <MapPin size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'map' && (
          <div>
            {crowdsourceItem && (
              <div className="pin-mode-banner">
                <div>
                  <strong>Relocation Mode:</strong> Tap on the store floorplan to place <u>{crowdsourceItem.name}</u>.
                </div>
                <button
                  className="btn-outline btn-sm"
                  style={{ background: '#78350f', color: '#fff', border: 'none' }}
                  onClick={() => setCrowdsourceItem(null)}
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="map-viewport">
              <svg
                viewBox="0 0 60 40"
                className="map-svg"
                onClick={handleMapClick}
                style={{ cursor: crowdsourceItem ? 'crosshair' : 'default' }}
              >
                {/* Store Department Zones */}
                {FARGO_STORE_DATA.zones.map(z => (
                  <g key={z.id}>
                    <rect
                      x={z.x1}
                      y={z.y1}
                      width={z.x2 - z.x1}
                      height={z.y2 - z.y1}
                      fill={z.color}
                      stroke={z.border}
                      strokeWidth="0.3"
                      rx="0.5"
                    />
                    <text
                      x={z.x1 + 1}
                      y={z.y1 + 2.5}
                      fill={z.border}
                      fontSize="1.6"
                      fontWeight="bold"
                    >
                      {z.name}
                    </text>
                  </g>
                ))}

                {/* Shelving Obstacles */}
                {FARGO_STORE_DATA.shelves.map(s => (
                  <g key={s.id}>
                    <rect
                      x={s.x}
                      y={s.y}
                      width={s.w}
                      height={s.h}
                      fill="#334155"
                      stroke="#475569"
                      strokeWidth="0.2"
                      rx="0.3"
                    />
                    <text
                      x={s.x + s.w / 2}
                      y={s.y + s.h / 2}
                      fill="#94a3b8"
                      fontSize="1.2"
                      textAnchor="middle"
                      transform={`rotate(-90 ${s.x + s.w / 2} ${s.y + s.h / 2})`}
                    >
                      {s.label}
                    </text>
                  </g>
                ))}

                {/* Entrance Marker */}
                <circle cx={FARGO_STORE_DATA.entrance.x} cy={FARGO_STORE_DATA.entrance.y} r="1.5" fill="#10b981" />
                <text x={FARGO_STORE_DATA.entrance.x} y={FARGO_STORE_DATA.entrance.y - 2} fill="#10b981" fontSize="1.3" textAnchor="middle" fontWeight="bold">ENTRANCE</text>

                {/* Checkout Marker */}
                <circle cx={FARGO_STORE_DATA.checkout.x} cy={FARGO_STORE_DATA.checkout.y} r="1.5" fill="#f59e0b" />
                <text x={FARGO_STORE_DATA.checkout.x} y={FARGO_STORE_DATA.checkout.y - 2} fill="#f59e0b" fontSize="1.3" textAnchor="middle" fontWeight="bold">CHECKOUT</text>

                {/* Dynamic Walking Polyline Path */}
                {routeResult.polyline.length > 1 && (
                  <polyline
                    points={routeResult.polyline.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="0.8"
                    strokeDasharray="1.5,1.0"
                    strokeLinecap="round"
                  />
                )}

                {/* Item Stop Pins */}
                {routeResult.items.map((item, index) => (
                  <g key={item.sku}>
                    <circle
                      cx={item.x}
                      y={item.y}
                      r="1.2"
                      fill={item.perishable === 'frozen_goods' ? '#06b6d4' : item.perishable === 'raw_meat_seafood' ? '#ef4444' : '#818cf8'}
                      stroke="#ffffff"
                      strokeWidth="0.4"
                    />
                    <text
                      x={item.x}
                      y={item.y + 0.4}
                      fill="#ffffff"
                      fontSize="1.1"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {index + 1}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Route Summary Metrics */}
            <div className="nav-metrics">
              <div className="metric-box">
                <div className="metric-val">{routeResult.totalDistance} ft</div>
                <div className="metric-lbl">Walking Distance</div>
              </div>
              <div className="metric-box">
                <div className="metric-val">~{Math.ceil(routeResult.totalDistance / 200)} min</div>
                <div className="metric-lbl">Est. Shopping Time</div>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '8px' }}>
                OPTIMIZED PICKUP SEQUENCE:
              </h4>
              {routeResult.items.map((it, idx) => (
                <div key={it.sku} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '0.75rem'
                  }}>
                    {idx + 1}
                  </span>
                  <span>{it.name}</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>({it.aisle})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'navigate' && (
          <div>
            {routeResult.steps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                No items selected. Add groceries from the list tab.
              </div>
            ) : (
              <div>
                {/* Active Step Card */}
                {currentStepIdx < routeResult.steps.length ? (
                  <div className="nav-card">
                    <div className="nav-step-header">
                      <span className="step-badge">
                        STEP {currentStepIdx + 1} OF {routeResult.steps.length}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {routeResult.steps[currentStepIdx].distance} ft
                      </span>
                    </div>
                    <div className="step-instruction">
                      {routeResult.steps[currentStepIdx].instruction}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button
                        className="btn-primary"
                        style={{ flex: 1 }}
                        onClick={() => setCurrentStepIdx(prev => Math.min(prev + 1, routeResult.steps.length))}
                      >
                        <CheckCircle2 size={16} />
                        Mark Collected & Next
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="nav-card" style={{ textAlign: 'center' }}>
                    <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 10px auto' }} />
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '6px' }}>Shopping Trip Complete!</h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                      You reached the checkout registers with all perishables fresh and intact.
                    </p>
                    <button
                      className="btn-primary"
                      style={{ marginTop: '14px' }}
                      onClick={() => setCurrentStepIdx(0)}
                    >
                      Start Over
                    </button>
                  </div>
                )}

                {/* Remaining Steps List */}
                <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '20px 0 10px 0' }}>
                  FULL TRIP NAVIGATION TIMELINE
                </h4>
                {routeResult.steps.map((st, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 0',
                      borderBottom: '1px solid #1e293b',
                      opacity: i < currentStepIdx ? 0.4 : i === currentStepIdx ? 1 : 0.8
                    }}
                  >
                    <span style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: i === currentStepIdx ? '#2563eb' : '#334155',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{st.target}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{st.aisle} • {st.distance} ft</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Bottom Bar */}
      <footer className="bottom-floating-bar">
        {activeTab !== 'navigate' ? (
          <button
            className="btn-primary"
            style={{ width: '100%' }}
            onClick={() => setActiveTab('navigate')}
          >
            <Navigation size={18} />
            Start Turn-by-Turn Navigation ({routeResult.totalDistance} ft)
          </button>
        ) : (
          <button
            className="btn-outline"
            style={{ width: '100%' }}
            onClick={() => setActiveTab('map')}
          >
            <Layers size={18} />
            View Store Floorplan
          </button>
        )}
      </footer>
    </div>
  );
}
