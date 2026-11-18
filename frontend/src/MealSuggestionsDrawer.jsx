import React, { useState } from 'react';
import {
  UtensilsCrossed,
  Sparkles,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  Dumbbell,
  Compass,
  ArrowRight
} from 'lucide-react';

/**
 * Smart Meal Ideas & Cart/Macro Drawer.
 * Displays live cart macros and smart recipe recommendations that update dynamically
 * as items are added or removed, with 1-click '+ Add Missing & Reroute'.
 */
export default function MealSuggestionsDrawer({
  cartItems,
  recipes,
  routeStats, // { totalDistanceFt, aislesVisitedCount, totalAislesCount }
  onAddMissingItemsAndReroute,
  onRemoveItemFromCart
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedRecipeFilter, setSelectedRecipeFilter] = useState("all"); // 'all' | 'high_match'

  // Calculate live cumulative macros & total price of cart items
  const cartTotals = cartItems.reduce(
    (acc, it) => {
      acc.price += it.price || 0;
      acc.calories += it.macros?.calories || 0;
      acc.protein += it.macros?.protein_g || 0;
      acc.carbs += it.macros?.carbs_g || 0;
      acc.fat += it.macros?.fat_g || 0;
      return acc;
    },
    { price: 0, calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Filter recipes
  const displayRecipes = recipes?.filter(r => {
    if (selectedRecipeFilter === "high_match") {
      return r.matched_count > 0;
    }
    return true;
  }) || [];

  return (
    <div className={`meal-drawer ${isExpanded ? 'drawer-expanded' : ''}`}>
      {/* DRAWER TOP BAR / MACRO HEADER */}
      <div className="drawer-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="drawer-header-left">
          <div className="drawer-title-row">
            <span className="cart-count-pill">{cartItems.length} items</span>
            <span className="cart-total-price">${cartTotals.price.toFixed(2)}</span>
            {routeStats && (
              <span className="efficiency-badge">
                Visiting {routeStats.aislesVisitedCount} of {routeStats.totalAislesCount} aisles • {routeStats.totalDistanceFt} ft walk
              </span>
            )}
          </div>

          {/* Running Macro Pills */}
          <div className="macro-pills-row">
            <span className="pill-macro pill-cals">
              <Flame size={12} /> {cartTotals.calories} kcal
            </span>
            <span className="pill-macro pill-protein">
              <Dumbbell size={12} /> {Math.round(cartTotals.protein)}g Protein
            </span>
            <span className="pill-macro pill-carbs">
              {Math.round(cartTotals.carbs)}g Carbs
            </span>
            <span className="pill-macro pill-fat">
              {Math.round(cartTotals.fat)}g Fat
            </span>
          </div>
        </div>

        <div className="drawer-header-right">
          <button className="btn-drawer-toggle">
            <Sparkles size={16} className="text-amber-400" />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Meal Ideas</span>
            {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
      </div>

      {/* EXPANDED CONTENT: RECIPE CARDS */}
      {isExpanded && (
        <div className="drawer-body">
          <div className="drawer-body-controls">
            <div className="drawer-section-heading">
              <UtensilsCrossed size={16} className="text-blue-400" />
              <span>What Can I Make Tonight?</span>
            </div>
            <div className="recipe-filter-tabs">
              <button
                className={`tab-filter ${selectedRecipeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedRecipeFilter('all')}
              >
                All Dinners ({recipes?.length || 0})
              </button>
              <button
                className={`tab-filter ${selectedRecipeFilter === 'high_match' ? 'active' : ''}`}
                onClick={() => setSelectedRecipeFilter('high_match')}
              >
                In-Progress Matches
              </button>
            </div>
          </div>

          <div className="recipes-grid">
            {displayRecipes.map(recipe => {
              const isComplete = recipe.missing_items.length === 0 && recipe.matched_items.length > 0;
              const hasIngredients = recipe.matched_count > 0;

              return (
                <div
                  key={recipe.recipe_id}
                  className={`recipe-card ${isComplete ? 'recipe-complete' : hasIngredients ? 'recipe-matched' : ''}`}
                >
                  <div className="recipe-card-header">
                    <div>
                      <div className="recipe-title">{recipe.title}</div>
                      <div className="recipe-meta-row">
                        <span className="recipe-time">
                          <Clock size={12} /> {recipe.prep_time_min} mins
                        </span>
                        <span className="recipe-macros">
                          {recipe.total_macros_per_serving?.calories} cal • {recipe.total_macros_per_serving?.protein_g}g P
                        </span>
                      </div>
                    </div>

                    {/* Match Badge */}
                    <div className={`match-badge ${hasIngredients ? 'badge-has-match' : 'badge-no-match'}`}>
                      {recipe.matched_count} of {recipe.total_required_count} in cart
                    </div>
                  </div>

                  {recipe.description && (
                    <p className="recipe-description">{recipe.description}</p>
                  )}

                  {/* Ingredients Checklist */}
                  <div className="recipe-ingredients-block">
                    {/* In-Cart Ingredients */}
                    {recipe.matched_items.map(it => (
                      <div key={it.item_id} className="ingredient-row matched">
                        <Check size={14} className="text-emerald-400" />
                        <span className="ingredient-name">{it.name}</span>
                        <span className="ingredient-tag-cart">In Cart</span>
                      </div>
                    ))}

                    {/* Missing Ingredients */}
                    {recipe.missing_items.map(it => (
                      <div key={it.item_id} className="ingredient-row missing">
                        <Plus size={14} className="text-blue-400" />
                        <span className="ingredient-name">{it.name}</span>
                        <span className="ingredient-location">{it.aisle}</span>
                        <span className="ingredient-price">${it.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* 1-Click Action Button */}
                  <div className="recipe-action-row">
                    {recipe.missing_items.length > 0 ? (
                      <button
                        className="btn-add-missing"
                        onClick={() => onAddMissingItemsAndReroute(recipe.missing_items.map(i => i.item_id))}
                      >
                        <Plus size={15} />
                        <span>Add Missing ({recipe.missing_items.length}) & Reroute</span>
                        <ArrowRight size={14} />
                      </button>
                    ) : (
                      <div className="ready-to-cook-banner">
                        <Check size={16} /> Ready to cook! All ingredients in cart.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
