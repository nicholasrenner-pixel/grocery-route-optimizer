import React from 'react';

/**
 * Clean architectural floor plan map renderer.
 * Strict Layer Order (Bottom to Top):
 * 1. Base Floor Layer: Architectural light/dark grid floor
 * 2. Fixtures & Aisles Layer: Crisp rounded rectangles with centered aisle labels, green ENTRANCE, amber/red CHECKOUT
 * 3. Active Route Polyline: Smooth SVG polyline (#2563EB) with directional chevrons and muted gray trail behind user
 * 4. Cart Waypoint Pins ONLY: Numbered teardrop pins strictly at shelf_coord of items in cart (green check when collected)
 * 5. Google Maps User Puck: White circular puck with blue directional cone/chevron rotating to walking vector
 * Note: All random/decorative circle artifacts, radar pulses, and debug circles are strictly stripped.
 */
export default function StoreMap({
  layout,
  orderedStops,
  collectedItemIds,
  polylineCoords,
  userPuck, // { x, y, headingDeg, currentPolylineIndex }
  onShelfPinClick
}) {
  if (!layout) return null;

  const { grid_dimensions, zones, aisles, obstacles, entrance, checkout } = layout;
  const cols = grid_dimensions?.cols || 50;
  const rows = grid_dimensions?.rows || 34;

  // Split polyline into completed trail (gray) and remaining path (blue)
  const userIdx = userPuck?.currentPolylineIndex ?? 0;
  const trailCoords = polylineCoords ? polylineCoords.slice(0, Math.min(userIdx + 1, polylineCoords.length)) : [];
  const remainingCoords = polylineCoords ? polylineCoords.slice(Math.max(0, userIdx)) : [];

  // Generate directional chevrons along the remaining path (every 6 cells)
  const chevrons = [];
  if (remainingCoords.length > 2) {
    for (let i = 2; i < remainingCoords.length - 1; i += 5) {
      const p1 = remainingCoords[i - 1];
      const p2 = remainingCoords[i];
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const angle = (Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360;
      chevrons.push({ x: p1[0], y: p1[1], angle });
    }
  }

  return (
    <div className="store-map-container">
      <svg
        viewBox={`0 0 ${cols} ${rows}`}
        className="store-map-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Subtle architectural floor pattern */}
          <pattern id="floorGrid" width="2" height="2" patternUnits="userSpaceOnUse">
            <path d="M 2 0 L 0 0 0 2" fill="none" stroke="#172033" strokeWidth="0.08" />
          </pattern>

          {/* User Puck drop shadow */}
          <filter id="puckShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0.3" stdDeviation="0.4" floodColor="#000000" floodOpacity="0.6" />
          </filter>

          {/* Pin drop shadow */}
          <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0.2" stdDeviation="0.3" floodColor="#000000" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* LAYER 1: BASE ARCHITECTURAL FLOOR */}
        <rect x="0" y="0" width={cols} height={rows} fill="#0b1120" />
        <rect x="0" y="0" width={cols} height={rows} fill="url(#floorGrid)" />

        {/* LAYER 1B: DEPARTMENT ZONES (SUBTLE BACKGROUND TINTS) */}
        {zones?.map(z => (
          <rect
            key={z.id}
            x={z.bounds.x1}
            y={z.bounds.y1}
            width={z.bounds.x2 - z.bounds.x1}
            height={z.bounds.y2 - z.bounds.y1}
            fill={z.color}
            fillOpacity="0.07"
            stroke={z.color}
            strokeWidth="0.15"
            strokeDasharray="0.6,0.6"
            rx="0.5"
          />
        ))}

        {/* LAYER 2: FIXTURES, SHELVING GONDOLAS & OBSTACLES */}
        {obstacles?.map(obs => {
          const isProduce = obs.type === 'table';
          const isCounter = obs.type === 'counter' || obs.type === 'wall_case';
          const isBarrier = obs.type === 'barrier';

          return (
            <g key={obs.id}>
              <rect
                x={obs.x}
                y={obs.y}
                width={obs.width}
                height={obs.height}
                fill={isBarrier ? "#1f2937" : isProduce ? "#064e3b" : isCounter ? "#374151" : "#1e293b"}
                stroke={isProduce ? "#059669" : isCounter ? "#4b5563" : "#334155"}
                strokeWidth="0.22"
                rx={isBarrier ? "0.1" : "0.4"}
              />
              {/* Centered label inside gondolas */}
              {obs.label && !isBarrier && (
                <text
                  x={obs.x + obs.width / 2}
                  y={obs.y + obs.height / 2}
                  fill="#94a3b8"
                  fontSize={obs.width <= 2 ? "1.05" : "1.2"}
                  fontWeight="600"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={
                    obs.height > obs.width * 2
                      ? `rotate(-90 ${obs.x + obs.width / 2} ${obs.y + obs.height / 2})`
                      : undefined
                  }
                >
                  {obs.label}
                </text>
              )}
            </g>
          );
        })}

        {/* LAYER 2B: ENTRANCE ZONE (GREEN) & CHECKOUT LANES (AMBER/RED) */}
        {entrance && (
          <g>
            <rect
              x={entrance.coord[0] - 1.2}
              y={entrance.coord[1] - 0.8}
              width="2.4"
              height="1.6"
              fill="#10b981"
              fillOpacity="0.25"
              stroke="#10b981"
              strokeWidth="0.3"
              rx="0.3"
            />
            <text
              x={entrance.coord[0]}
              y={entrance.coord[1] + 0.3}
              fill="#10b981"
              fontSize="0.85"
              fontWeight="bold"
              textAnchor="middle"
            >
              ENTRANCE
            </text>
          </g>
        )}

        {checkout && (
          <g>
            <rect
              x={checkout.coord[0] - 1.5}
              y={checkout.coord[1] - 0.8}
              width="3.0"
              height="1.6"
              fill="#f59e0b"
              fillOpacity="0.25"
              stroke="#f59e0b"
              strokeWidth="0.3"
              rx="0.3"
            />
            <text
              x={checkout.coord[0]}
              y={checkout.coord[1] + 0.3}
              fill="#f59e0b"
              fontSize="0.85"
              fontWeight="bold"
              textAnchor="middle"
            >
              CHECKOUT
            </text>
          </g>
        )}

        {/* LAYER 3: ACTIVE ROUTE POLYLINE */}
        {/* Completed trail behind user (muted gray) */}
        {trailCoords.length > 1 && (
          <polyline
            points={trailCoords.map(p => `${p[0]},${p[1]}`).join(' ')}
            fill="none"
            stroke="#475569"
            strokeWidth="0.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="0.8,0.6"
          />
        )}

        {/* Active remaining path (smooth electric blue) */}
        {remainingCoords.length > 1 && (
          <polyline
            points={remainingCoords.map(p => `${p[0]},${p[1]}`).join(' ')}
            fill="none"
            stroke="#2563EB"
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Directional chevrons along path */}
        {chevrons.map((ch, idx) => (
          <g key={idx} transform={`translate(${ch.x}, ${ch.y}) rotate(${ch.angle})`}>
            <path
              d="M -0.4 0.3 L 0 -0.4 L 0.4 0.3"
              fill="none"
              stroke="#93c5fd"
              strokeWidth="0.22"
              strokeLinecap="round"
            />
          </g>
        ))}

        {/* Access-to-Shelf connecting dotted tick */}
        {orderedStops?.map(stop => (
          <line
            key={`tick-${stop.item_id}`}
            x1={stop.access_coord[0]}
            y1={stop.access_coord[1]}
            x2={stop.shelf_coord[0]}
            y2={stop.shelf_coord[1]}
            stroke="#60a5fa"
            strokeWidth="0.2"
            strokeDasharray="0.4,0.4"
          />
        ))}

        {/* LAYER 4: CART WAYPOINT PINS ONLY (EXCLUSIVELY FOR ITEMS IN ACTIVE CART) */}
        {orderedStops?.map(stop => {
          const isCollected = collectedItemIds?.includes(stop.item_id);
          const [sx, sy] = stop.shelf_coord;

          return (
            <g
              key={`pin-${stop.item_id}`}
              transform={`translate(${sx}, ${sy})`}
              filter="url(#pinShadow)"
              style={{ cursor: 'pointer' }}
              onClick={() => onShelfPinClick && onShelfPinClick(stop)}
            >
              {/* Teardrop Pin Shape */}
              <path
                d="M 0 0 C -0.8 -0.8 -1.2 -1.5 -1.2 -2.1 C -1.2 -3.0 -0.6 -3.6 0 -3.6 C 0.6 -3.6 1.2 -3.0 1.2 -2.1 C 1.2 -1.5 0.8 -0.8 0 0 Z"
                fill={isCollected ? "#10b981" : "#2563EB"}
                stroke="#ffffff"
                strokeWidth="0.22"
              />
              {/* Number or Checkmark inside pin head */}
              {isCollected ? (
                <text x="0" y="-2.1" fill="#ffffff" fontSize="0.9" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                  ✓
                </text>
              ) : (
                <text x="0" y="-2.1" fill="#ffffff" fontSize="0.9" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                  {stop.stop_number}
                </text>
              )}
            </g>
          );
        })}

        {/* LAYER 5: GOOGLE MAPS-STYLE USER PUCK */}
        {userPuck && (
          <g
            transform={`translate(${userPuck.x}, ${userPuck.y})`}
            filter="url(#puckShadow)"
            style={{ transition: 'transform 0.18s linear' }}
          >
            {/* White outer puck ring */}
            <circle cx="0" cy="0" r="1.3" fill="#ffffff" stroke="#2563eb" strokeWidth="0.25" />
            {/* Blue directional chevron / cone rotating to heading */}
            <g transform={`rotate(${userPuck.headingDeg || 0})`}>
              <path
                d="M 0 -1.0 L -0.65 0.6 L 0 0.3 L 0.65 0.6 Z"
                fill="#2563eb"
              />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
