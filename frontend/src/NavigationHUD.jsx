import React from 'react';
import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  CheckCircle2,
  Play,
  Pause,
  FastForward,
  SkipForward,
  RotateCcw,
  AlertCircle
} from 'lucide-react';

/**
 * Google Maps-Style Navigation HUD Banner & Walk Simulator Controls.
 * Displays live maneuver arrow, real-time countdown in feet, target preview pill,
 * and comprehensive walking simulator controls.
 */
export default function NavigationHUD({
  currentStep,
  nextItem,
  liveDistanceFt,
  isSimulating,
  simSpeed,
  onToggleSimulate,
  onToggleSpeed,
  onStepForward,
  onResetWalk,
  onOffRouteTest,
  isFinished,
  totalStops,
  completedStopsCount
}) {
  const renderManeuverIcon = () => {
    if (isFinished) {
      return <CheckCircle2 size={30} className="text-emerald-400" />;
    }
    const maneuver = currentStep?.maneuver || "STRAIGHT";
    switch (maneuver) {
      case "TURN_LEFT":
        return <CornerUpLeft size={30} className="text-white" />;
      case "TURN_RIGHT":
        return <CornerUpRight size={30} className="text-white" />;
      case "ARRIVE":
        return <CheckCircle2 size={30} className="text-amber-400" />;
      default:
        return <ArrowUp size={30} className="text-white" />;
    }
  };

  return (
    <div className="nav-hud-wrapper">
      {/* GOOGLE MAPS TURN-BY-TURN TOP BANNER */}
      <div className="nav-hud-banner">
        {/* Left Maneuver Icon */}
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
              {isFinished
                ? "Trip Complete! Reached Registers"
                : currentStep?.instruction?.split(" — ")[0] || "Head toward your first stop"}
            </span>
          </div>

          {/* Sub-banner Next Item Preview Pill */}
          {nextItem && !isFinished ? (
            <div className="nav-hud-preview-pill">
              <span className="preview-label">Next Stop:</span>
              <span className="preview-item-name">{nextItem.name}</span>
              <span className="preview-separator">•</span>
              <span className="preview-shelf-detail">
                {nextItem.aisle} • {nextItem.shelf_side} shelf
              </span>
            </div>
          ) : isFinished ? (
            <div className="nav-hud-preview-pill pill-finished">
              All items checked off. Ready for checkout.
            </div>
          ) : (
            <div className="nav-hud-preview-pill">
              Add items to your cart to generate your optimal walking path
            </div>
          )}
        </div>
      </div>

      {/* COMPACT INTERACTIVE WALK SIMULATOR CONTROL BAR */}
      <div className="nav-simulator-bar">
        <div className="sim-buttons-left">
          <button
            className={`btn-sim ${isSimulating ? 'sim-active' : ''}`}
            onClick={onToggleSimulate}
            title={isSimulating ? "Pause walk simulation" : "Start real-time walking simulation"}
          >
            {isSimulating ? <Pause size={14} /> : <Play size={14} />}
            <span>{isSimulating ? "Pause" : "Simulate Walk"}</span>
          </button>

          <button
            className="btn-sim-secondary"
            onClick={onToggleSpeed}
            title="Toggle simulation speed (1x or 2x)"
          >
            <FastForward size={13} />
            <span>{simSpeed}x</span>
          </button>

          <button
            className="btn-sim-secondary"
            onClick={onStepForward}
            title="Step forward one waypoint along the route"
          >
            <SkipForward size={13} />
            <span>Step</span>
          </button>

          <button
            className="btn-sim-secondary"
            onClick={onResetWalk}
            title="Reset user puck back to the entrance"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>

        <div className="sim-buttons-right">
          <button
            className="btn-sim-offroute"
            onClick={onOffRouteTest}
            title="Shift puck 2 aisles over and trigger live dynamic rerouting"
          >
            <AlertCircle size={13} />
            <span>Off-Route Test</span>
          </button>
        </div>
      </div>
    </div>
  );
}
