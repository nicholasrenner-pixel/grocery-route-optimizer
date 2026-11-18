import React from 'react';
import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  CheckCircle2,
  Play,
  Pause,
  FastForward,
  Compass,
  AlertCircle
} from 'lucide-react';

/**
 * Google Maps-Style Top Navigation HUD & Simulation Controls.
 * Displays live turn-by-turn guidance in green/slate, decrements distance in feet,
 * and controls the real-time walking puck simulator with off-route testing.
 */
export default function NavigationHUD({
  currentStep,
  nextItem,
  liveDistanceFt,
  isSimulating,
  simSpeed,
  onToggleSimulate,
  onToggleSpeed,
  onMarkNextItemPicked,
  onOffRouteTest,
  isFinished
}) {
  // Maneuver icon rendering
  const renderManeuverIcon = () => {
    if (isFinished) {
      return <CheckCircle2 size={28} className="text-emerald-400" />;
    }
    const maneuver = currentStep?.maneuver || "STRAIGHT";
    switch (maneuver) {
      case "TURN_LEFT":
        return <CornerUpLeft size={28} className="text-white" />;
      case "TURN_RIGHT":
        return <CornerUpRight size={28} className="text-white" />;
      case "ARRIVE":
        return <CheckCircle2 size={28} className="text-amber-400" />;
      default:
        return <ArrowUp size={28} className="text-white" />;
    }
  };

  return (
    <div className="nav-hud-wrapper">
      {/* GOOGLE MAPS-STYLE TURN-BY-TURN TOP BANNER */}
      <div className="nav-hud-banner">
        {/* Left Maneuver Icon Box */}
        <div className="nav-hud-icon-box">
          {renderManeuverIcon()}
        </div>

        {/* Center Primary Direction & Distance */}
        <div className="nav-hud-content">
          <div className="nav-hud-distance-row">
            <span className="nav-hud-distance-number">
              {isFinished ? "0" : Math.max(0, Math.round(liveDistanceFt))}
            </span>
            <span className="nav-hud-distance-unit">ft</span>
            <span className="nav-hud-action-bold">
              {isFinished ? "Trip Complete!" : currentStep?.instruction?.split(" — ")[0] || "Head toward your first item"}
            </span>
          </div>

          {/* Sub-banner Next Item Preview Pill */}
          {nextItem && !isFinished && (
            <div className="nav-hud-preview-pill">
              <span className="preview-label">Next Stop:</span>
              <span className="preview-item-name">{nextItem.name}</span>
              <span className="preview-separator">•</span>
              <span className="preview-shelf-detail">
                {nextItem.aisle} • {nextItem.bay} • {nextItem.shelf_side} shelf
              </span>
            </div>
          )}

          {isFinished && (
            <div className="nav-hud-preview-pill" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
              All cart items collected. Checkout register reached.
            </div>
          )}
        </div>
      </div>

      {/* INTERACTIVE DESKTOP WALK SIMULATOR BAR */}
      <div className="nav-simulator-bar">
        <div className="sim-buttons-left">
          <button
            className={`btn-sim ${isSimulating ? 'sim-active' : ''}`}
            onClick={onToggleSimulate}
            title={isSimulating ? "Pause walk simulation" : "Start real-time walking simulation"}
          >
            {isSimulating ? <Pause size={15} /> : <Play size={15} />}
            <span>{isSimulating ? "Pause Walk" : "Simulate Walk"}</span>
          </button>

          <button
            className="btn-sim-secondary"
            onClick={onToggleSpeed}
            title="Toggle simulation speed (1x or 2x)"
          >
            <FastForward size={14} />
            <span>{simSpeed}x</span>
          </button>
        </div>

        <div className="sim-buttons-right">
          <button
            className="btn-sim-action"
            onClick={onMarkNextItemPicked}
            disabled={!nextItem || isFinished}
            title="Mark current target item as picked up and advance"
          >
            <CheckCircle2 size={15} />
            <span>Pick Up Item</span>
          </button>

          <button
            className="btn-sim-offroute"
            onClick={onOffRouteTest}
            title="Simulate walking off-route to test live dynamic rerouting"
          >
            <AlertCircle size={14} />
            <span>Off-Route Test</span>
          </button>
        </div>
      </div>
    </div>
  );
}
