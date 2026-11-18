import React, { useState, useMemo, useEffect, useRef } from 'react';
import './App.css';
import {
  ShoppingCart,
  Navigation,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Snowflake,
  Search,
  Plus,
  Trash2,
  Store,
  Camera,
  RefreshCw,
  Activity,
  Layers,
  Radio,
  Sparkles,
  Barcode,
  Dumbbell,
  Compass,
  ArrowRight
} from 'lucide-react';

// Multi-Retailer Store Layout Data
const STORE_PRESETS = {
  walmart_supercenter_1594: {
    id: "walmart_supercenter_1594",
    name: "Walmart Supercenter #1594",
    retailer: "Walmart",
    location: "4731 13th Ave S, Fargo, ND",
    grid: { width: 60, height: 40, cellSize: 4 },
    entrance: { x: 5, y: 38, name: "Grocery Entrance" },
    checkout: { x: 10, y: 34, name: "Self-Checkout A" },
    zones: [
      { id: "produce", name: "Produce", color: "rgba(16, 185, 129, 0.15)", border: "#10b981", x1: 2, y1: 22, x2: 14, y2: 32 },
      { id: "bakery", name: "Bakery/Deli", color: "rgba(245, 158, 11, 0.15)", border: "#f59e0b", x1: 2, y1: 12, x2: 14, y2: 20 },
      { id: "meat", name: "Meat & Poultry", color: "rgba(239, 68, 68, 0.15)", border: "#ef4444", x1: 2, y1: 2, x2: 26, y2: 8 },
      { id: "dairy", name: "Dairy Wall", color: "rgba(56, 189, 248, 0.15)", border: "#38bdf8", x1: 28, y1: 2, x2: 56, y2: 7 },
      { id: "grocery", name: "Center Grocery", color: "rgba(99, 102, 241, 0.15)", border: "#6366f1", x1: 16, y1: 10, x2: 36, y2: 30 },
      { id: "frozen", name: "Frozen Foods", color: "rgba(6, 182, 212, 0.15)", border: "#06b6d4", x1: 38, y1: 10, x2: 48, y2: 30 },
      { id: "seasonal", name: "Seasonal Promo", color: "rgba(236, 72, 153, 0.15)", border: "#ec4899", x1: 50, y1: 10, x2: 58, y2: 30 }
    ],
    shelves: [
      { id: "A1", x: 18, y: 12, w: 2, h: 14, label: "A1 Pasta" },
      { id: "A2", x: 23, y: 12, w: 2, h: 14, label: "A2 Canned" },
      { id: "A3", x: 28, y: 12, w: 2, h: 14, label: "A3 Oats" },
      { id: "A4", x: 33, y: 12, w: 2, h: 14, label: "A4 Snacks" },
      { id: "F1", x: 40, y: 12, w: 2, h: 14, label: "F1 Dinners" },
      { id: "F2", x: 45, y: 12, w: 2, h: 14, label: "F2 Ice Cream" },
      { id: "prod_isle", x: 5, y: 24, w: 6, h: 6, label: "Produce Island" }
    ],
    beacons: [
      { id: "BLE_ENT", x: 5, y: 37, label: "Entry Beacon" },
      { id: "BLE_PROD", x: 8, y: 27, label: "Produce Beacon" },
      { id: "BLE_MEAT", x: 15, y: 5, label: "Meat Dept Beacon" },
      { id: "BLE_DAIRY", x: 40, y: 5, label: "Dairy Beacon" },
      { id: "BLE_GROC", x: 25, y: 19, label: "Center Aisle Beacon" },
      { id: "BLE_FROZ", x: 43, y: 19, label: "Freezer Beacon" },
      { id: "BLE_CHK", x: 18, y: 32, label: "Checkout Beacon" }
    ]
  },
  target_supertarget_1224: {
    id: "target_supertarget_1224",
    name: "SuperTarget T-1224",
    retailer: "Target",
    location: "Metro Galleria PFresh Format",
    grid: { width: 55, height: 38, cellSize: 4 },
    entrance: { x: 4, y: 35, name: "Target Grocery Doors" },
    checkout: { x: 12, y: 32, name: "Target RedCheck Express" },
    zones: [
      { id: "presh", name: "PFresh Produce", color: "rgba(16, 185, 129, 0.15)", border: "#10b981", x1: 2, y1: 20, x2: 14, y2: 30 },
      { id: "dairy_meat", name: "Dairy & Meats", color: "rgba(239, 68, 68, 0.15)", border: "#ef4444", x1: 2, y1: 2, x2: 30, y2: 8 },
      { id: "dry", name: "Target Pantry Aisles G", color: "rgba(99, 102, 241, 0.15)", border: "#6366f1", x1: 16, y1: 10, x2: 38, y2: 28 },
      { id: "frozen", name: "Target Frozen", color: "rgba(6, 182, 212, 0.15)", border: "#06b6d4", x1: 40, y1: 10, x2: 52, y2: 28 }
    ],
    shelves: [
      { id: "G12", x: 18, y: 12, w: 2, h: 13, label: "Aisle G12" },
      { id: "G14", x: 24, y: 12, w: 2, h: 13, label: "Aisle G14" },
      { id: "G16", x: 30, y: 12, w: 2, h: 13, label: "Aisle G16" }
    ],
    beacons: [
      { id: "T_BLE_1", x: 4, y: 34, label: "Target Main Beacon" },
      { id: "T_BLE_2", x: 24, y: 18, label: "Target Center Beacon" }
    ]
  },
  costco_wholesale_warehouse: {
    id: "costco_wholesale_warehouse",
    name: "Costco Wholesale Club",
    retailer: "Costco",
    location: "Commercial Blvd Warehouse",
    grid: { width: 70, height: 45, cellSize: 5 },
    entrance: { x: 5, y: 42, name: "Member Entrance" },
    checkout: { x: 15, y: 38, name: "Warehouse Checkout" },
    zones: [
      { id: "pallets", name: "Pallet Rows", color: "rgba(99, 102, 241, 0.15)", border: "#6366f1", x1: 15, y1: 12, x2: 45, y2: 32 },
      { id: "vault", name: "Dairy & Produce Vault", color: "rgba(6, 182, 212, 0.15)", border: "#06b6d4", x1: 48, y1: 2, x2: 66, y2: 20 },
      { id: "rotisserie", name: "Meat & Rotisserie", color: "rgba(239, 68, 68, 0.15)", border: "#ef4444", x1: 2, y1: 2, x2: 35, y2: 10 }
    ],
    shelves: [
      { id: "bay100", x: 18, y: 14, w: 3, h: 16, label: "Bay 100" },
      { id: "bay200", x: 26, y: 14, w: 3, h: 16, label: "Bay 200" },
      { id: "bay300", x: 34, y: 14, w: 3, h: 16, label: "Bay 300" }
    ],
    beacons: [
      { id: "C_BLE_1", x: 5, y: 40, label: "Costco Entry Beacon" }
    ]
  }
};

// Complete Nutritional & Spatial Item Inventory
const INITIAL_INVENTORY = [
  {
    sku: "WMT-00802",
    upc: "024600008029",
    name: "Boneless Skinless Chicken Breast 3lb",
    brand: "Tyson",
    category: "meat",
    perishable: "raw_meat_seafood",
    aisle: "Meat Wall M2",
    price: 9.98,
    inStock: true,
    stockCount: 22,
    x: 18,
    y: 4,
    macros: { calories: 1440, protein_g: 310.0, carbs_g: 0.0, fat_g: 18.0, fiber_g: 0.0, serving: "4 oz (112g)" }
  },
  {
    sku: "WMT-00804",
    upc: "024600008043",
    name: "99% Lean Ground Turkey Breast 1lb",
    brand: "Butterball",
    category: "meat",
    perishable: "raw_meat_seafood",
    aisle: "Meat Wall M3",
    price: 5.48,
    inStock: true,
    stockCount: 18,
    x: 23,
    y: 4,
    macros: { calories: 480, protein_g: 112.0, carbs_g: 0.0, fat_g: 4.0, fiber_g: 0.0, serving: "4 oz (112g)" }
  },
  {
    sku: "WMT-00801",
    upc: "024600008012",
    name: "USDA Choice Angus Ribeye 1.2lb",
    brand: "Market Side",
    category: "meat",
    perishable: "raw_meat_seafood",
    aisle: "Meat Wall M1",
    price: 14.50,
    inStock: true,
    stockCount: 12,
    x: 8,
    y: 4,
    macros: { calories: 740, protein_g: 68.0, carbs_g: 0.0, fat_g: 52.0, fiber_g: 0.0, serving: "4 oz (112g)" }
  },
  {
    sku: "WMT-00101",
    upc: "024600001015",
    name: "Barilla Spaghetti Pasta 16oz",
    brand: "Barilla",
    category: "dry_grocery",
    perishable: "shelf_stable",
    aisle: "Aisle A1",
    price: 1.78,
    inStock: true,
    stockCount: 42,
    x: 17,
    y: 16,
    macros: { calories: 1600, protein_g: 56.0, carbs_g: 336.0, fat_g: 8.0, fiber_g: 24.0, serving: "2 oz (56g)" }
  },
  {
    sku: "WMT-00103",
    upc: "024600001039",
    name: "Banza Chickpea Rotini Protein Pasta 8oz",
    brand: "Banza",
    category: "dry_grocery",
    perishable: "shelf_stable",
    aisle: "Aisle A1",
    price: 3.98,
    inStock: true,
    stockCount: 25,
    x: 19,
    y: 20,
    macros: { calories: 760, protein_g: 44.0, carbs_g: 128.0, fat_g: 12.0, fiber_g: 32.0, serving: "2 oz (56g)" }
  },
  {
    sku: "WMT-00701",
    upc: "024600007015",
    name: "Great Value Whole Milk 1 Gallon",
    brand: "Great Value",
    category: "dairy",
    perishable: "chilled_dairy",
    aisle: "Dairy Wall D2",
    price: 3.12,
    inStock: true,
    stockCount: 65,
    x: 32,
    y: 4,
    macros: { calories: 2400, protein_g: 128.0, carbs_g: 192.0, fat_g: 128.0, fiber_g: 0.0, serving: "1 cup" }
  },
  {
    sku: "WMT-00702",
    upc: "024600007022",
    name: "Cage-Free Grade A Eggs 18ct",
    brand: "Eggland's Best",
    category: "dairy",
    perishable: "chilled_dairy",
    aisle: "Dairy Wall D1",
    price: 4.18,
    inStock: true,
    stockCount: 40,
    x: 44,
    y: 4,
    macros: { calories: 1260, protein_g: 108.0, carbs_g: 0.0, fat_g: 90.0, fiber_g: 0.0, serving: "1 egg" }
  },
  {
    sku: "WMT-00501",
    upc: "024600005011",
    name: "Fresh Organic Bananas (Bunch)",
    brand: "Chiquita",
    category: "produce",
    perishable: "ambient_fresh",
    aisle: "Produce Island 2",
    price: 1.48,
    inStock: true,
    stockCount: 110,
    x: 4,
    y: 26,
    macros: { calories: 525, protein_g: 6.5, carbs_g: 135.0, fat_g: 1.5, fiber_g: 15.0, serving: "1 banana" }
  },
  {
    sku: "WMT-00902",
    upc: "024600009026",
    name: "Ben & Jerry's Chocolate Fudge Brownie Pint",
    brand: "Ben & Jerry's",
    category: "frozen",
    perishable: "frozen_goods",
    aisle: "Aisle F2",
    price: 4.68,
    inStock: true,
    stockCount: 19,
    x: 47,
    y: 22,
    macros: { calories: 1140, protein_g: 16.0, carbs_g: 140.0, fat_g: 60.0, fiber_g: 8.0, serving: "2/3 cup" }
  },
  {
    sku: "WMT-00903",
    upc: "024600009033",
    name: "Halo Top Sea Salt Caramel Pint",
    brand: "Halo Top",
    category: "frozen",
    perishable: "frozen_goods",
    aisle: "Aisle F2",
    price: 4.98,
    inStock: true,
    stockCount: 15,
    x: 48,
    y: 24,
    macros: { calories: 320, protein_g: 20.0, carbs_g: 64.0, fat_g: 8.0, fiber_g: 16.0, serving: "2/3 cup" }
  }
];

const PERISHABLE_PRIORITY = {
  shelf_stable: 1,
  ambient_fresh: 1,
  chilled_dairy: 2,
  raw_meat_seafood: 3,
  frozen_goods: 4
};

export default function App() {
  const [selectedStoreKey, setSelectedStoreKey] = useState("walmart_supercenter_1594");
  const activeStore = STORE_PRESETS[selectedStoreKey];

  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'map' | 'navigate' | 'tech'
  const [catalog, setCatalog] = useState(INITIAL_INVENTORY);
  const [selectedSkus, setSelectedSkus] = useState([
    "WMT-00501", // Bananas
    "WMT-00101", // Barilla Pasta
    "WMT-00701", // Milk
    "WMT-00802", // Chicken Breast
    "WMT-00902"  // Ben & Jerry's Ice Cream
  ]);
  const [collectedSkus, setCollectedSkus] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [perishablesLast, setPerishablesLast] = useState(true);

  // Real-Time Indoor Positioning "Blue Dot" State
  const [blueDot, setBlueDot] = useState({
    x: activeStore.entrance.x,
    y: activeStore.entrance.y,
    heading: 0,
    accuracy: 3.5,
    isWalking: false
  });
  const [showBeacons, setShowBeacons] = useState(true);

  // Modals State
  const [substituteModal, setSubstituteModal] = useState(null); // { item, candidates }
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState(null);

  // Compute Items Selected
  const selectedItems = useMemo(() => {
    return selectedSkus.map(sku => catalog.find(i => i.sku === sku)).filter(Boolean);
  }, [selectedSkus, catalog]);

  // Nutritional Macros Aggregation (Running Cart Totals)
  const macroSummary = useMemo(() => {
    const calc = (itemList) => {
      let cals = 0, p = 0, c = 0, f = 0, cost = 0;
      itemList.forEach(item => {
        cals += item.macros.calories;
        p += item.macros.protein_g;
        c += item.macros.carbs_g;
        f += item.macros.fat_g;
        cost += item.price;
      });
      const calEnergy = Math.max(1, p * 4 + c * 4 + f * 9);
      return {
        count: itemList.length,
        cost: cost.toFixed(2),
        cals,
        protein: Math.round(p),
        carbs: Math.round(c),
        fat: Math.round(f),
        proteinPct: Math.round((p * 4 / calEnergy) * 100),
        carbsPct: Math.round((c * 4 / calEnergy) * 100),
        fatPct: Math.round((f * 9 / calEnergy) * 100)
      };
    };

    const planned = calc(selectedItems);
    const collected = calc(selectedItems.filter(i => collectedSkus.includes(i.sku)));
    return { planned, collected };
  }, [selectedItems, collectedSkus]);

  // TSP Dynamic Path Calculation
  const routeResult = useMemo(() => {
    const uncollectedItems = selectedItems.filter(i => !collectedSkus.includes(i.sku));
    if (uncollectedItems.length === 0) {
      return {
        items: [],
        polyline: [{ x: blueDot.x, y: blueDot.y }, activeStore.checkout],
        totalDistance: Math.round((Math.abs(blueDot.x - activeStore.checkout.x) + Math.abs(blueDot.y - activeStore.checkout.y)) * activeStore.grid.cellSize),
        steps: [{ num: 1, instruction: "Proceed to Checkout Register", target: "Checkout", aisle: "Front Lane", distance: 24, sku: "CHECKOUT" }]
      };
    }

    let itemsToSort = [...uncollectedItems];

    if (perishablesLast) {
      itemsToSort.sort((a, b) => {
        const tierA = PERISHABLE_PRIORITY[a.perishable] || 1;
        const tierB = PERISHABLE_PRIORITY[b.perishable] || 1;
        if (tierA !== tierB) return tierA - tierB;
        // Euclidean proximity to active blue dot location
        const distA = Math.hypot(a.x - blueDot.x, a.y - blueDot.y);
        const distB = Math.hypot(b.x - blueDot.x, b.y - blueDot.y);
        return distA - distB;
      });
    } else {
      let unvisited = [...itemsToSort];
      let current = { x: blueDot.x, y: blueDot.y };
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

    // Build polyline: Current Blue Dot -> Next Items -> Checkout
    const points = [
      { x: blueDot.x, y: blueDot.y },
      ...itemsToSort.map(item => ({ x: item.x, y: item.y })),
      activeStore.checkout
    ];

    let totalDist = 0;
    const steps = [];

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const legDist = (Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y)) * activeStore.grid.cellSize;
      totalDist += legDist;

      if (i === points.length - 2) {
        steps.push({
          num: i + 1,
          instruction: `Final items collected! Proceed to ${activeStore.checkout.name}`,
          target: "Checkout Register",
          aisle: "Front Register Lane",
          distance: Math.round(legDist),
          sku: "CHECKOUT"
        });
      } else {
        steps.push({
          num: i + 1,
          instruction: `Navigate to ${itemsToSort[i].aisle} for ${itemsToSort[i].name}`,
          target: itemsToSort[i].name,
          aisle: itemsToSort[i].aisle,
          distance: Math.round(legDist),
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
  }, [selectedItems, collectedSkus, perishablesLast, blueDot.x, blueDot.y, activeStore]);

  // Real-Time Walking Simulation Timer (Blue Dot Movement)
  useEffect(() => {
    let interval = null;
    if (blueDot.isWalking && routeResult.polyline.length > 1) {
      interval = setInterval(() => {
        setBlueDot(prev => {
          const nextTarget = routeResult.polyline[1];
          if (!nextTarget) return { ...prev, isWalking: false };

          const dx = nextTarget.x - prev.x;
          const dy = nextTarget.y - prev.y;
          const dist = Math.hypot(dx, dy);

          if (dist <= 1.2) {
            // Reached next waypoint
            const reachedItem = catalog.find(i => Math.hypot(i.x - nextTarget.x, i.y - nextTarget.y) <= 1.5 && selectedSkus.includes(i.sku) && !collectedSkus.includes(i.sku));
            if (reachedItem) {
              setCollectedSkus(c => [...c, reachedItem.sku]);
              setScanNotice(`Reached ${reachedItem.name}! Item checked off.`);
              setTimeout(() => setScanNotice(null), 4000);
            }
            return {
              ...prev,
              x: nextTarget.x,
              y: nextTarget.y,
              heading: (Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360
            };
          }

          // Step forward 0.8 cell units
          const stepSize = 0.8;
          const nx = prev.x + (dx / dist) * stepSize;
          const ny = prev.y + (dy / dist) * stepSize;
          const heading = (Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360;

          return {
            ...prev,
            x: Math.round(nx * 10) / 10,
            y: Math.round(ny * 10) / 10,
            heading: Math.round(heading)
          };
        });
      }, 700);
    }
    return () => clearInterval(interval);
  }, [blueDot.isWalking, routeResult.polyline, catalog, selectedSkus, collectedSkus]);

  // Smart Substitution Trigger
  const handleMarkOutOfStock = (item) => {
    // Macro vector cosine similarity
    const v1 = [item.macros.protein_g, item.macros.carbs_g, item.macros.fat_g];
    const norm1 = Math.hypot(...v1) || 1;

    const candidates = catalog
      .filter(c => c.sku !== item.sku && c.inStock)
      .map(c => {
        const v2 = [c.macros.protein_g, c.macros.carbs_g, c.macros.fat_g];
        const norm2 = Math.hypot(...v2) || 1;
        const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
        const macroSim = Math.max(0, dot / (norm1 * norm2));
        const walkDist = (Math.abs(blueDot.x - c.x) + Math.abs(blueDot.y - c.y)) * activeStore.grid.cellSize;
        return {
          ...c,
          macroSimPct: Math.round(macroSim * 100),
          walkDist: Math.round(walkDist),
          diffProtein: c.macros.protein_g - item.macros.protein_g,
          diffCals: c.macros.calories - item.macros.calories
        };
      })
      .sort((a, b) => b.macroSimPct - a.macroSimPct)
      .slice(0, 3);

    setSubstituteModal({ outOfStockItem: item, candidates });
  };

  const applySubstitute = (newCandidate) => {
    const oldSku = substituteModal.outOfStockItem.sku;
    setSelectedSkus(prev => prev.map(s => s === oldSku ? newCandidate.sku : s));
    setSubstituteModal(null);
    setScanNotice(`Rerouted to ${newCandidate.name} at ${newCandidate.aisle}!`);
    setTimeout(() => setScanNotice(null), 4000);
  };

  // Barcode Scanner Action
  const handleBarcodeScan = (scannedSku) => {
    const matchedItem = catalog.find(i => i.sku === scannedSku || i.upc === scannedSku);
    if (matchedItem) {
      if (!collectedSkus.includes(matchedItem.sku)) {
        setCollectedSkus(prev => [...prev, matchedItem.sku]);
      }
      setScanNotice(`Barcode Scanned! Verified & checked off: ${matchedItem.name}`);
      setScannerOpen(false);
      setTimeout(() => setScanNotice(null), 4000);
    }
  };

  return (
    <div className="mobile-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-top">
          <div className="brand-badge">
            <Store size={22} />
            <span>StoreNav Pro</span>
          </div>
          <select
            className="retailer-select"
            value={selectedStoreKey}
            onChange={(e) => {
              setSelectedStoreKey(e.target.value);
              setBlueDot(prev => ({
                ...prev,
                x: STORE_PRESETS[e.target.value].entrance.x,
                y: STORE_PRESETS[e.target.value].entrance.y
              }));
            }}
          >
            <option value="walmart_supercenter_1594">Walmart Supercenter (Fargo)</option>
            <option value="target_supertarget_1224">SuperTarget (PFresh Format)</option>
            <option value="costco_wholesale_warehouse">Costco Wholesale Club</option>
          </select>
        </div>
      </header>

      {/* Running Macro & Cart Totals Bar */}
      <section className="macro-summary-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Shopping Cart Macros ({collectedSkus.length} of {selectedSkus.length} Items In Cart)
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>
            ${macroSummary.collected.cost} <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>/ ${macroSummary.planned.cost}</span>
          </div>
        </div>

        <div className="macro-pills-row">
          <div className="macro-pill cals">
            <div className="macro-pill-val">{macroSummary.collected.cals}</div>
            <div className="macro-pill-lbl">Cals ({macroSummary.planned.cals})</div>
          </div>
          <div className="macro-pill protein">
            <div className="macro-pill-val">{macroSummary.collected.protein}g</div>
            <div className="macro-pill-lbl">Protein ({macroSummary.planned.protein}g)</div>
          </div>
          <div className="macro-pill carbs">
            <div className="macro-pill-val">{macroSummary.collected.carbs}g</div>
            <div className="macro-pill-lbl">Carbs ({macroSummary.planned.carbs}g)</div>
          </div>
          <div className="macro-pill fat">
            <div className="macro-pill-val">{macroSummary.collected.fat}g</div>
            <div className="macro-pill-lbl">Fat ({macroSummary.planned.fat}g)</div>
          </div>
        </div>

        {/* Macro Caloric Ratio Breakdown */}
        <div className="macro-progress-bar">
          <div className="macro-seg-protein" style={{ width: `${macroSummary.planned.proteinPct}%` }} title="Protein" />
          <div className="macro-seg-carbs" style={{ width: `${macroSummary.planned.carbsPct}%` }} title="Carbs" />
          <div className="macro-seg-fat" style={{ width: `${macroSummary.planned.fatPct}%` }} title="Fat" />
        </div>
      </section>

      {/* Real-time Notifications */}
      {scanNotice && (
        <div style={{ background: '#10b981', color: '#022c22', padding: '10px 16px', fontWeight: 600, fontSize: '0.85rem' }}>
          {scanNotice}
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
          <ShoppingCart size={16} /> List ({selectedSkus.length})
        </button>
        <button className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
          <MapPin size={16} /> Blue Dot Map
        </button>
        <button className={`tab-btn ${activeTab === 'navigate' ? 'active' : ''}`} onClick={() => setActiveTab('navigate')}>
          <Navigation size={16} /> Guide ({routeResult.totalDistance}ft)
        </button>
        <button className={`tab-btn ${activeTab === 'tech' ? 'active' : ''}`} onClick={() => setActiveTab('tech')}>
          <Radio size={16} /> Indoor IPS
        </button>
      </div>

      {/* Main Tab Content */}
      <main className="tab-content">
        {/* TAB 1: SHOPPING LIST & SMART SUBSTITUTIONS */}
        {activeTab === 'list' && (
          <div>
            <div className="search-wrapper" style={{ position: 'relative', marginBottom: '12px' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#9ca3af' }} />
              <input
                type="text"
                className="search-input"
                style={{ width: '100%', padding: '10px 12px 10px 36px', background: '#111827', border: '1px solid #1f2937', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
                placeholder="Search aisles, high-protein foods, UPC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Perishables Rule Toggle */}
            <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '10px 14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Snowflake size={18} color="#38bdf8" />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Perishables Last Rule</div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Frozen pints & raw meats placed at very end</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={perishablesLast}
                onChange={() => setPerishablesLast(!perishablesLast)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '0.85rem', color: '#9ca3af', textTransform: 'uppercase' }}>My Grocery List</h3>
              <button className="btn-outline btn-sm" onClick={() => setScannerOpen(true)}>
                <Barcode size={14} /> Camera Barcode Scan
              </button>
            </div>

            {selectedItems.map(item => {
              const isCollected = collectedSkus.includes(item.sku);
              return (
                <div key={item.sku} className={`item-card ${isCollected ? 'collected' : ''}`}>
                  <div className="item-card-header">
                    <div>
                      <div className="item-title">{item.name}</div>
                      <div className="item-meta">
                        <span className={`badge badge-${item.category}`}>{item.aisle}</span>
                        <span>•</span>
                        <span style={{ fontWeight: 600, color: '#38bdf8' }}>${item.price.toFixed(2)}</span>
                        <span>•</span>
                        <span>UPC: {item.upc}</span>
                      </div>
                    </div>
                    <button
                      className="btn-outline btn-sm"
                      style={{ color: '#ef4444' }}
                      onClick={() => setSelectedSkus(selectedSkus.filter(s => s !== item.sku))}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Macros Tag Bar */}
                  <div className="macro-micro-tags">
                    <span className="macro-tag" style={{ color: '#10b981' }}>{item.macros.calories} kcal</span>
                    <span className="macro-tag" style={{ color: 'var(--protein)' }}>P: {item.macros.protein_g}g</span>
                    <span className="macro-tag" style={{ color: 'var(--carbs)' }}>C: {item.macros.carbs_g}g</span>
                    <span className="macro-tag" style={{ color: 'var(--fats)' }}>F: {item.macros.fat_g}g</span>
                  </div>

                  {/* Actions: Out of Stock or Barcode Pick */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button
                      className="btn-primary btn-sm"
                      style={{ flex: 1, background: isCollected ? '#065f46' : '#2563eb' }}
                      onClick={() => {
                        if (isCollected) {
                          setCollectedSkus(collectedSkus.filter(s => s !== item.sku));
                        } else {
                          setCollectedSkus([...collectedSkus, item.sku]);
                        }
                      }}
                    >
                      <CheckCircle2 size={14} />
                      {isCollected ? "Collected in Cart" : "Mark Collected"}
                    </button>

                    <button
                      className="btn-outline btn-sm btn-danger"
                      onClick={() => handleMarkOutOfStock(item)}
                      title="Item missing on shelf? Find macro-equivalent substitute"
                    >
                      <AlertTriangle size={14} /> Out of Stock?
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: INTERACTIVE BLUE DOT MAP */}
        {activeTab === 'map' && (
          <div>
            {/* Map Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="btn-primary btn-sm"
                  onClick={() => setBlueDot(prev => ({ ...prev, isWalking: !prev.isWalking }))}
                >
                  <Activity size={14} />
                  {blueDot.isWalking ? "Pause Walk Simulation" : "Simulate PDR Walk"}
                </button>
                <button
                  className="btn-outline btn-sm"
                  onClick={() => setShowBeacons(!showBeacons)}
                >
                  <Radio size={14} />
                  {showBeacons ? "Hide BLE Beacons" : "Show Beacons"}
                </button>
              </div>

              <div style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Compass size={14} color="#38bdf8" /> {blueDot.heading}°
              </div>
            </div>

            <div className="map-viewport">
              <svg viewBox={`0 0 ${activeStore.grid.width} ${activeStore.grid.height}`} className="map-svg">
                {/* Department Zones */}
                {activeStore.zones.map(z => (
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
                    <text x={z.x1 + 1} y={z.y1 + 2.5} fill={z.border} fontSize="1.5" fontWeight="bold">
                      {z.name}
                    </text>
                  </g>
                ))}

                {/* Shelving Obstacles */}
                {activeStore.shelves.map(s => (
                  <g key={s.id}>
                    <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="#1f2937" stroke="#374151" strokeWidth="0.2" rx="0.3" />
                    <text
                      x={s.x + s.w / 2}
                      y={s.y + s.h / 2}
                      fill="#9ca3af"
                      fontSize="1.1"
                      textAnchor="middle"
                      transform={`rotate(-90 ${s.x + s.w / 2} ${s.y + s.h / 2})`}
                    >
                      {s.label}
                    </text>
                  </g>
                ))}

                {/* BLE Beacons Overlay */}
                {showBeacons && activeStore.beacons.map(b => (
                  <g key={b.id}>
                    <circle cx={b.x} cy={b.y} r="2.8" fill="none" stroke="rgba(56, 189, 248, 0.25)" strokeDasharray="0.8,0.8" />
                    <circle cx={b.x} cy={b.y} r="0.6" fill="#38bdf8" />
                  </g>
                ))}

                {/* Entrance & Checkout Markers */}
                <circle cx={activeStore.entrance.x} cy={activeStore.entrance.y} r="1.5" fill="#10b981" />
                <circle cx={activeStore.checkout.x} cy={activeStore.checkout.y} r="1.5" fill="#f59e0b" />

                {/* Walking Polyline */}
                {routeResult.polyline.length > 1 && (
                  <polyline
                    points={routeResult.polyline.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="0.7"
                    strokeDasharray="1.2,0.8"
                    strokeLinecap="round"
                  />
                )}

                {/* Item Stop Waypoints */}
                {routeResult.items.map((item, idx) => {
                  const isDone = collectedSkus.includes(item.sku);
                  return (
                    <g key={item.sku}>
                      <circle
                        cx={item.x}
                        y={item.y}
                        r="1.2"
                        fill={isDone ? "#10b981" : item.perishable === 'frozen_goods' ? '#06b6d4' : item.perishable === 'raw_meat_seafood' ? '#ef4444' : '#818cf8'}
                        stroke="#ffffff"
                        strokeWidth="0.3"
                      />
                      <text x={item.x} y={item.y + 0.4} fill="#ffffff" fontSize="1.0" textAnchor="middle" fontWeight="bold">
                        {idx + 1}
                      </text>
                    </g>
                  );
                })}

                {/* REAL-TIME "BLUE DOT" WITH HEADING CONE */}
                <g>
                  {/* Accuracy Radius */}
                  <circle cx={blueDot.x} cy={blueDot.y} r={blueDot.accuracy} fill="rgba(37, 99, 235, 0.12)" />
                  {/* Pulse Ring */}
                  <circle cx={blueDot.x} cy={blueDot.y} r="2.2" fill="none" stroke="#3b82f6" strokeWidth="0.4" className="blue-dot-pulse" />
                  {/* Direction Heading Pointer */}
                  <polygon
                    points={`${blueDot.x},${blueDot.y - 2.2} ${blueDot.x - 0.9},${blueDot.y + 0.8} ${blueDot.x + 0.9},${blueDot.y + 0.8}`}
                    fill="#60a5fa"
                    transform={`rotate(${blueDot.heading} ${blueDot.x} ${blueDot.y})`}
                  />
                  {/* Solid Center Dot */}
                  <circle cx={blueDot.x} cy={blueDot.y} r="1.1" fill="#2563eb" stroke="#ffffff" strokeWidth="0.35" />
                </g>
              </svg>
            </div>

            {/* Current Blue Dot Location Telemetry */}
            <div style={{ marginTop: '12px', background: '#111827', padding: '10px 14px', borderRadius: '10px', border: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>CURRENT INDOOR POSITION</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8' }}>
                  Grid ({blueDot.x}, {blueDot.y}) • ±{blueDot.accuracy} ft Accuracy
                </div>
              </div>
              <button
                className="btn-outline btn-sm"
                onClick={() => setBlueDot(prev => ({ ...prev, x: activeStore.entrance.x, y: activeStore.entrance.y }))}
              >
                Reset to Entrance
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: TURN-BY-TURN STEP GUIDANCE */}
        {activeTab === 'navigate' && (
          <div>
            <div className="nav-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="badge badge-dairy">NEXT PICKUP</span>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{routeResult.steps[0]?.distance || 0} ft remaining</span>
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '12px' }}>
                {routeResult.steps[0]?.instruction}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-primary" style={{ flex: 1 }} onClick={() => setScannerOpen(true)}>
                  <Barcode size={16} /> Scan Item Barcode
                </button>
              </div>
            </div>

            <h4 style={{ fontSize: '0.8rem', color: '#9ca3af', textTransform: 'uppercase', margin: '18px 0 8px 0' }}>
              Remaining Path Sequence
            </h4>
            {routeResult.steps.map((st, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #1f2937' }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? '#2563eb' : '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  {st.num}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{st.target}</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{st.aisle} • {st.distance} ft</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: INDOOR POSITIONING ARCHITECTURE & SENSORS */}
        {activeTab === 'tech' && (
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', color: '#38bdf8' }}>
              Indoor Positioning System (IPS) Stack
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#9ca3af', lineHeight: 1.5, marginBottom: '14px' }}>
              GPS satellite signals cannot penetrate commercial steel-deck supercenter roofs. The app combines three complementary technologies to maintain sub-meter "Blue Dot" tracking:
            </p>

            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
              <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.9rem', marginBottom: '4px' }}>
                1. BLE Beacon RSSI Trilateration
              </div>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                Battery-powered iBeacons (10Hz advertisement rate) mounted on aisle ceiling trusses. Smartphone receives RSSI values and converts signal attenuation to distance via Log-Distance Path Loss.
              </p>
            </div>

            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
              <div style={{ fontWeight: 700, color: '#10b981', fontSize: '0.9rem', marginBottom: '4px' }}>
                2. Pedestrian Dead Reckoning (PDR)
              </div>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                Uses device IMU (accelerometer step counting + gyroscope heading angle). Weinberg step length model calculates continuous walking trajectories between beacon pings.
              </p>
            </div>

            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.9rem', marginBottom: '4px' }}>
                3. AR Visual Inertial Odometry (VIO)
              </div>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                When the camera barcode scanner is opened, Apple ARKit / Android ARCore detects overhead aisle category markers (AprilTags/Aisle signs) to re-zero drift down to 10cm accuracy.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: SMART MACRO SUBSTITUTION */}
      {substituteModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Sparkles size={20} color="#f59e0b" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Smart Macro Substitution</h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '14px' }}>
              <u>{substituteModal.outOfStockItem.name}</u> is out of stock. The algorithm found macro-equivalent alternatives nearby:
            </p>

            {substituteModal.candidates.map(cand => (
              <div key={cand.sku} className="substitute-candidate-card" onClick={() => applySubstitute(cand)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{cand.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{cand.aisle} • ${cand.price.toFixed(2)}</div>
                  </div>
                  <span className="badge badge-dairy">{cand.macroSimPct}% Macro Match</span>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', fontSize: '0.75rem' }}>
                  <span style={{ color: cand.diffProtein >= 0 ? '#10b981' : '#f87171' }}>
                    {cand.diffProtein >= 0 ? `+${cand.diffProtein}g Protein` : `${cand.diffProtein}g Protein`}
                  </span>
                  <span>•</span>
                  <span>{cand.macros.calories} Cals</span>
                  <span>•</span>
                  <span style={{ color: '#38bdf8' }}>+{cand.walkDist} ft walk</span>
                </div>
              </div>
            ))}

            <button
              className="btn-outline"
              style={{ width: '100%', marginTop: '8px' }}
              onClick={() => setSubstituteModal(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CAMERA BARCODE SCANNER */}
      {scannerOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                <Camera size={18} color="#38bdf8" /> Camera Barcode Scanner
              </div>
              <button className="btn-outline btn-sm" onClick={() => setScannerOpen(false)}>Close</button>
            </div>

            <div className="scanner-box">
              <div className="laser-line" />
              <Barcode size={64} color="#475569" />
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '10px' }}>
                Center UPC Barcode in Frame
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '10px' }}>
              Quick Scan Simulation (Tap an item to test):
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
              {selectedItems.map(item => (
                <button
                  key={item.sku}
                  className="btn-outline btn-sm"
                  style={{ justifyContent: 'space-between' }}
                  onClick={() => handleBarcodeScan(item.sku)}
                >
                  <span>{item.name}</span>
                  <span style={{ color: '#38bdf8' }}>{item.upc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Bar */}
      <footer className="bottom-floating-bar">
        {activeTab !== 'navigate' ? (
          <button
            className="btn-primary"
            style={{ width: '100%' }}
            onClick={() => setActiveTab('navigate')}
          >
            <Navigation size={18} />
            Start Indoor Navigation ({routeResult.totalDistance} ft)
          </button>
        ) : (
          <button
            className="btn-outline"
            style={{ width: '100%' }}
            onClick={() => setActiveTab('map')}
          >
            <Layers size={18} />
            View Blue Dot Floorplan
          </button>
        )}
      </footer>
    </div>
  );
}
