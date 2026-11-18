import React, { useState } from 'react';
import {
  ShoppingCart,
  UtensilsCrossed,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Clock,
  Dumbbell,
  Flame,
  Check,
  ArrowRight,
  Sparkles,
  Layers
} from 'lucide-react';

/**
 * Right Pane: Persistent Active Shopping Cart & Meal Ideas Workspace.
 * Tabs:
 * - Active Cart (N): Items ordered in optimal TSP sweep with Got It checkboxes, quantity adjusters
 * - Meal Ideas (N): Populated recipe suggestions with 1-click + Add Missing Ingredients & Reroute
 * - Add Items: Instant catalog search with category filter pills
 */
export default function ActiveCartPanel({
  activeTab, // 'cart' | 'meals' | 'search'
  onSelectTab,
  cartEntries, // List of { item_id, name, aisle, bay, shelf_side, price, quantity, checked_off, macros, ... }
  orderedStops,
  catalog,
  recipes,
  routeStats, // { totalDistanceFt, aislesVisitedCount, totalAislesCount, currentStopIdx, totalStops }
  onToggleCheckItem,
  onUpdateQuantity,
  onRemoveItem,
  onAddItemToCart,
  onAddMissingItemsAndReroute
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Cumulative cart financial and macro calculations
  const cartTotals = cartEntries.reduce(
    (acc, it) => {
      const qty = it.quantity || 1;
      acc.price += (it.price || 0) * qty;
      acc.calories += (it.macros?.calories || 0) * qty;
      acc.protein += (it.macros?.protein_g || 0) * qty;
      acc.carbs += (it.macros?.carbs_g || 0) * qty;
      acc.fat += (it.macros?.fat_g || 0) * qty;
      return acc;
    },
    { price: 0, calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Filter catalog items
  const filteredCatalog = catalog.filter(it => {
    const matchesSearch = it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          it.aisle.toLowerCase().includes(searchQuery.toLowerCase());
    if (categoryFilter === "all") return matchesSearch;
    if (categoryFilter === "produce") return matchesSearch && it.category === "produce";
    if (categoryFilter === "meat") return matchesSearch && it.category === "meat";
    if (categoryFilter === "dairy") return matchesSearch && it.category === "dairy";
    if (categoryFilter === "pasta") return matchesSearch && (it.category === "dry_grocery" && it.aisle === "Aisle 4");
    if (categoryFilter === "frozen") return matchesSearch && it.category === "frozen";
    if (categoryFilter === "pantry") return matchesSearch && (it.category === "dry_grocery" && it.aisle !== "Aisle 4");
    return matchesSearch;
  });

  return (
    <div className="active-cart-panel">
      {/* 1. TOP SUMMARY STRIP: LIVE MACROS & ROUTE EFFICIENCY */}
      <div className="summary-strip">
        <div className="summary-price-efficiency">
          <div className="summary-price-block">
            <span className="summary-total-label">CART TOTAL</span>
            <span className="summary-total-price">${cartTotals.price.toFixed(2)}</span>
          </div>
          {routeStats && (
            <div className="summary-efficiency-pill">
              <span className="pill-stop-count">
                Stop {Math.min(routeStats.currentStopIdx + 1, routeStats.totalStops || 1)} of {routeStats.totalStops || 1}
              </span>
              <span className="pill-dist-remaining">{routeStats.totalDistanceFt} ft walk</span>
            </div>
          )}
        </div>

        {/* Live Running Macro Badges */}
        <div className="summary-macros-grid">
          <div className="macro-badge macro-cal">
            <Flame size={12} />
            <span className="macro-num">{cartTotals.calories}</span>
            <span className="macro-unit">kcal</span>
          </div>
          <div className="macro-badge macro-pro">
            <Dumbbell size={12} />
            <span className="macro-num">{Math.round(cartTotals.protein)}g</span>
            <span className="macro-unit">protein</span>
          </div>
          <div className="macro-badge macro-carb">
            <span className="macro-num">{Math.round(cartTotals.carbs)}g</span>
            <span className="macro-unit">carbs</span>
          </div>
          <div className="macro-badge macro-fat">
            <span className="macro-num">{Math.round(cartTotals.fat)}g</span>
            <span className="macro-unit">fat</span>
          </div>
        </div>
      </div>

      {/* 2. TAB CONTROLS */}
      <div className="cart-panel-tabs">
        <button
          className={`tab-switch ${activeTab === 'cart' ? 'active' : ''}`}
          onClick={() => onSelectTab('cart')}
        >
          <ShoppingCart size={15} />
          <span>Active Cart ({cartEntries.length})</span>
        </button>

        <button
          className={`tab-switch ${activeTab === 'meals' ? 'active' : ''}`}
          onClick={() => onSelectTab('meals')}
        >
          <Sparkles size={15} className="text-amber-400" />
          <span>Meal Ideas ({recipes?.length || 0})</span>
        </button>

        <button
          className={`tab-switch ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => onSelectTab('search')}
        >
          <Search size={15} />
          <span>Add Items</span>
        </button>
      </div>

      {/* 3. TAB 1: ACTIVE SHOPPING CART LIST (SORTED IN TSP ORDER) */}
      {activeTab === 'cart' && (
        <div className="cart-tab-content">
          {cartEntries.length === 0 ? (
            <div className="empty-cart-state">
              <ShoppingCart size={40} className="text-slate-600 mb-2" />
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f1f5f9' }}>Your Cart is Empty</div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 16px 0', textAlign: 'center' }}>
                Add individual grocery items or choose a curated meal kit to plan your route.
              </p>
              <button className="btn-primary-action" onClick={() => onSelectTab('meals')}>
                <Sparkles size={15} />
                <span>Explore Meal Kits</span>
              </button>
            </div>
          ) : (
            <div className="cart-items-scroll">
              <div className="tsp-order-indicator">
                <span>Optimized TSP Pickup Sequence</span>
                <span className="efficiency-subtext">Visits closest items first, perishables last</span>
              </div>

              {orderedStops.map((stop) => {
                const isChecked = stop.checked_off;
                const qty = stop.quantity || 1;

                return (
                  <div
                    key={stop.item_id}
                    className={`cart-stop-row ${isChecked ? 'row-checked' : ''}`}
                  >
                    {/* Stop Number Badge */}
                    <div className="stop-badge-column">
                      <span className={`stop-number-badge ${isChecked ? 'badge-checked' : ''}`}>
                        {isChecked ? "✓" : `#${stop.stop_number}`}
                      </span>
                    </div>

                    {/* Item Details */}
                    <div className="stop-info-column">
                      <div className="stop-item-title">{stop.name}</div>
                      <div className="stop-item-location">
                        <span className="aisle-tag">{stop.aisle}</span>
                        <span>•</span>
                        <span className="bay-tag">{stop.shelf_side} shelf</span>
                        <span>•</span>
                        <span className="price-tag">${(stop.price * qty).toFixed(2)}</span>
                      </div>
                      <div className="stop-macros-tag">
                        {stop.macros?.calories} cal • {stop.macros?.protein_g}g P • {stop.macros?.carbs_g}g C
                      </div>
                    </div>

                    {/* Quantity Controls & Checkbox */}
                    <div className="stop-actions-column">
                      <div className="quantity-stepper">
                        <button
                          className="btn-step"
                          onClick={() => onUpdateQuantity(stop.item_id, qty - 1)}
                          title="Decrease quantity"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="qty-number">{qty}</span>
                        <button
                          className="btn-step"
                          onClick={() => onUpdateQuantity(stop.item_id, qty + 1)}
                          title="Increase quantity"
                        >
                          <Plus size={11} />
                        </button>
                      </div>

                      {/* Got It Checkbox */}
                      <button
                        className={`btn-got-it ${isChecked ? 'checked' : ''}`}
                        onClick={() => onToggleCheckItem(stop.item_id)}
                        title={isChecked ? "Mark uncollected" : "Mark collected"}
                      >
                        <Check size={14} />
                        <span>{isChecked ? "Got It" : "Pick"}</span>
                      </button>

                      <button
                        className="btn-remove-row"
                        onClick={() => onRemoveItem(stop.item_id)}
                        title="Remove from cart"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. TAB 2: SMART MEAL IDEAS */}
      {activeTab === 'meals' && (
        <div className="meals-tab-content">
          <div className="meals-header-banner">
            <Sparkles size={16} className="text-amber-400" />
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
              {cartEntries.length === 0 ? "Popular Quick Meal Kits (1-Tap Add)" : "Recipes Matching Your Cart"}
            </span>
          </div>

          <div className="meals-scroll-list">
            {recipes.map(recipe => {
              const matchedCount = recipe.matched_items.length;
              const totalCount = recipe.total_required_count;
              const hasAll = recipe.missing_items.length === 0 && matchedCount > 0;
              const missingCost = recipe.missing_items.reduce((s, it) => s + (it.price || 0), 0);

              return (
                <div key={recipe.recipe_id} className={`recipe-card-panel ${hasAll ? 'complete' : matchedCount > 0 ? 'partial' : ''}`}>
                  <div className="recipe-card-top">
                    <div>
                      <div className="recipe-card-title">{recipe.title}</div>
                      <div className="recipe-card-submeta">
                        <span className="recipe-prep-pill">
                          <Clock size={11} /> {recipe.prep_time_min}m
                        </span>
                        <span>{recipe.total_macros_per_serving?.calories} cal</span>
                        <span>•</span>
                        <span>{recipe.total_macros_per_serving?.protein_g}g protein</span>
                      </div>
                    </div>

                    <span className={`match-ratio-pill ${matchedCount > 0 ? 'matched' : ''}`}>
                      {matchedCount}/{totalCount} in cart
                    </span>
                  </div>

                  {recipe.description && (
                    <p className="recipe-desc-text">{recipe.description}</p>
                  )}

                  {/* Ingredient Checklist */}
                  <div className="recipe-ingredients-checklist">
                    {/* In-cart items */}
                    {recipe.matched_items.map(it => (
                      <div key={it.item_id} className="ing-item-row in-cart">
                        <Check size={13} className="text-emerald-400" />
                        <span className="ing-name">{it.name}</span>
                        <span className="ing-tag-incart">✓ In Cart</span>
                      </div>
                    ))}

                    {/* Missing items */}
                    {recipe.missing_items.map(it => (
                      <div key={it.item_id} className="ing-item-row missing">
                        <button
                          className="btn-add-single-ing"
                          onClick={() => onAddItemToCart(it)}
                          title={`Add ${it.name} to cart`}
                        >
                          <Plus size={12} />
                        </button>
                        <span className="ing-name">{it.name}</span>
                        <span className="ing-aisle">{it.aisle}</span>
                        <span className="ing-price">${it.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action Button: 1-Tap Injection */}
                  <div className="recipe-card-bottom">
                    {recipe.missing_items.length > 0 ? (
                      <button
                        className="btn-add-meal-missing"
                        onClick={() => onAddMissingItemsAndReroute(recipe.missing_items.map(i => i.item_id), recipe.title)}
                      >
                        <Plus size={14} />
                        <span>Add Missing ({recipe.missing_items.length} items • ${missingCost.toFixed(2)}) & Reroute</span>
                        <ArrowRight size={13} />
                      </button>
                    ) : (
                      <div className="ready-to-cook-box">
                        <CheckCircle2 size={16} /> All ingredients in cart! Ready to cook.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. TAB 3: ADD ITEMS / CATALOG SEARCH */}
      {activeTab === 'search' && (
        <div className="search-tab-content">
          <div className="catalog-search-input-wrap">
            <Search size={15} className="search-input-icon" />
            <input
              type="text"
              placeholder="Search products, aisles, proteins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="catalog-text-field"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="category-pills-scroll">
            {[
              { id: "all", label: "All" },
              { id: "produce", label: "Produce" },
              { id: "meat", label: "Meat & Seafood" },
              { id: "dairy", label: "Dairy Wall" },
              { id: "pasta", label: "Pasta & Grains" },
              { id: "pantry", label: "Pantry" },
              { id: "frozen", label: "Frozen" },
            ].map(cat => (
              <button
                key={cat.id}
                className={`category-pill ${categoryFilter === cat.id ? 'active' : ''}`}
                onClick={() => setCategoryFilter(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Catalog List */}
          <div className="catalog-search-results">
            {filteredCatalog.map(item => {
              const inCart = cartEntries.some(c => c.item_id === item.item_id);

              return (
                <div key={item.item_id} className={`catalog-product-row ${inCart ? 'is-in-cart' : ''}`}>
                  <div className="prod-info-block">
                    <div className="prod-title">{item.name}</div>
                    <div className="prod-submeta">
                      <span className="prod-aisle">{item.aisle}</span>
                      <span>•</span>
                      <span className="prod-price">${item.price.toFixed(2)}</span>
                      <span>•</span>
                      <span className="prod-cal">{item.macros?.calories} cal</span>
                      <span>•</span>
                      <span className="prod-pro">{item.macros?.protein_g}g P</span>
                    </div>
                  </div>

                  <button
                    className={`btn-add-product ${inCart ? 'in-cart' : ''}`}
                    onClick={() => onAddItemToCart(item)}
                  >
                    {inCart ? <Check size={14} /> : <Plus size={14} />}
                    <span>{inCart ? "In Cart" : "+ Add"}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
