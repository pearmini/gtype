import * as d3 from "d3";
import {parseConstraint} from "./constraints.js";
import {toLeft, randomPointInPolygon} from "./geometry.js";

function pointsByConstraints(spec, {debug = false, random} = {}) {
  const positionConstraints = spec.constraints.position || [];
  const sideConstraints = spec.constraints.side || [];

  const constraints = d3.sort(positionConstraints, (d) => parseConstraint(d)[0]);
  const constraintsById = new Map();

  for (const c of constraints) {
    const [s, v, t] = parseConstraint(c);
    constraintsById.set(s, (constraintsById.get(s) || []).concat([[t, v, 1]]));
    constraintsById.set(t, (constraintsById.get(t) || []).concat([[s, v, 0]]));
  }

  const placed = new Map();
  const bboxById = new Map();
  const toPlace = Array.from(constraintsById.keys());
  let next;
  let maxIter = 1000;
  let iter = 0;

  // Compute positions for position constraints
  while ((next = toPlace.shift()) && iter < maxIter) {
    iter++;
    const constraints = constraintsById.get(next);
    let x0 = -Infinity;
    let x1 = Infinity;
    let y0 = -Infinity;
    let y1 = Infinity;
    for (const [s, v, left] of constraints) {
      if (placed.has(s)) {
        const [px, py] = placed.get(s);
        if (v === "v") {
          if (left) y1 = Math.min(y1, py);
          else y0 = Math.max(y0, py);
        } else {
          if (left) x1 = Math.min(x1, px);
          else x0 = Math.max(x0, px);
        }
      }
    }
    if (x0 === -Infinity && x1 === Infinity) [x0, x1] = [0, 1];
    if (y0 === -Infinity && y1 === Infinity) [y0, y1] = [0, 1];
    if (x0 === -Infinity && x1 !== Infinity) x0 = x1 - 1;
    if (x1 === Infinity && x0 !== -Infinity) x1 = x0 + 1;
    if (y0 === -Infinity && y1 !== Infinity) y0 = y1 - 1;
    if (y1 === Infinity && y0 !== -Infinity) y1 = y0 + 1;
    const paddingX = (x1 - x0) * 0.1;
    const paddingY = (y1 - y0) * 0.1;
    const x = random(x0 + paddingX, x1 - paddingX);
    const y = random(y0 + paddingY, y1 - paddingY);
    placed.set(next, [x, y]);
    bboxById.set(next, {x0, x1, y0, y1});
    if (debug) {
      console.log(next, {x, y, x0, x1, y0, y1, constraints});
    }
  }

  // Recompute the bbox for each point based on position constraints
  for (const pointId of placed.keys()) {
    const constraints = constraintsById.get(pointId) || [];
    let x0 = -Infinity;
    let x1 = Infinity;
    let y0 = -Infinity;
    let y1 = Infinity;

    for (const [s, v, left] of constraints) {
      if (placed.has(s)) {
        const [px, py] = placed.get(s);
        if (v === "v") {
          if (left) y1 = Math.min(y1, py);
          else y0 = Math.max(y0, py);
        } else {
          if (left) x1 = Math.min(x1, px);
          else x0 = Math.max(x0, px);
        }
      }
    }

    // If no constraints, use infinite bbox (or current position as center)
    if (x0 === -Infinity && x1 === Infinity) {
      const [px] = placed.get(pointId);
      x0 = px - 1;
      x1 = px + 1;
    } else {
      if (x0 === -Infinity && x1 !== Infinity) x0 = x1 - 1;
      if (x1 === Infinity && x0 !== -Infinity) x1 = x0 + 1;
    }

    if (y0 === -Infinity && y1 === Infinity) {
      const [, py] = placed.get(pointId);
      y0 = py - 1;
      y1 = py + 1;
    } else {
      if (y0 === -Infinity && y1 !== Infinity) y0 = y1 - 1;
      if (y1 === Infinity && y0 !== -Infinity) y1 = y0 + 1;
    }

    bboxById.set(pointId, {x0, x1, y0, y1});
  }

  // Apply side constraints
  for (const c of sideConstraints) {
    const [point, line] = c.split(">");
    const [lineStart, lineEnd] = line.split(",").map((p) => p.trim());
    const [x1, y1] = placed.get(lineStart);
    const [x2, y2] = placed.get(lineEnd);
    const [px, py] = placed.get(point);
    const bbox = bboxById.get(point);
    const corners = [
      [bbox.x0, bbox.y0],
      [bbox.x1, bbox.y0],
      [bbox.x1, bbox.y1],
      [bbox.x0, bbox.y1],
    ];

    // If the point is already on the left side of the line, there is no need to adjust the bbox
    if (toLeft([px, py], [x1, y1], [x2, y2])) continue;

    // If all corners are on the right side of the line, there is no way to satisfy the constraint
    const leftCorners = corners.filter(([x, y]) => toLeft([x, y], [x1, y1], [x2, y2]));
    if (leftCorners.length === 0) continue;

    // Line vector: from lineStart to lineEnd
    const dx = x2 - x1;
    const dy = y2 - y1;
    const threshold = dy * x1 - dx * y1;

    // Find intersections with bbox edges (handles all cases including vertical/horizontal lines)
    const intersections = [];

    // Top edge: y = y0, x from x0 to x1
    if (dy !== 0) {
      const xAtY0 = (threshold + dx * bbox.y0) / dy;
      if (xAtY0 >= bbox.x0 && xAtY0 <= bbox.x1) {
        intersections.push([xAtY0, bbox.y0]);
      }
    } else if (y1 === bbox.y0 && Math.max(x1, x2) >= bbox.x0 && Math.min(x1, x2) <= bbox.x1) {
      // Horizontal line at y = y1 intersects top edge
      intersections.push([Math.max(bbox.x0, Math.min(x1, x2)), bbox.y0]);
      intersections.push([Math.min(bbox.x1, Math.max(x1, x2)), bbox.y0]);
    }

    // Bottom edge: y = y1, x from x0 to x1
    if (dy !== 0) {
      const xAtY1 = (threshold + dx * bbox.y1) / dy;
      if (xAtY1 >= bbox.x0 && xAtY1 <= bbox.x1) {
        intersections.push([xAtY1, bbox.y1]);
      }
    } else if (y1 === bbox.y1 && Math.max(x1, x2) >= bbox.x0 && Math.min(x1, x2) <= bbox.x1) {
      // Horizontal line at y = y1 intersects bottom edge
      intersections.push([Math.max(bbox.x0, Math.min(x1, x2)), bbox.y1]);
      intersections.push([Math.min(bbox.x1, Math.max(x1, x2)), bbox.y1]);
    }

    // Left edge: x = x0, y from y0 to y1
    if (dx !== 0) {
      const yAtX0 = (dy * bbox.x0 - threshold) / dx;
      if (yAtX0 >= bbox.y0 && yAtX0 <= bbox.y1) {
        intersections.push([bbox.x0, yAtX0]);
      }
    } else if (x1 === bbox.x0 && Math.max(y1, y2) >= bbox.y0 && Math.min(y1, y2) <= bbox.y1) {
      // Vertical line at x = x1 intersects left edge
      intersections.push([bbox.x0, Math.max(bbox.y0, Math.min(y1, y2))]);
      intersections.push([bbox.x0, Math.min(bbox.y1, Math.max(y1, y2))]);
    }

    // Right edge: x = x1, y from y0 to y1
    if (dx !== 0) {
      const yAtX1 = (dy * bbox.x1 - threshold) / dx;
      if (yAtX1 >= bbox.y0 && yAtX1 <= bbox.y1) {
        intersections.push([bbox.x1, yAtX1]);
      }
    } else if (x1 === bbox.x1 && Math.max(y1, y2) >= bbox.y0 && Math.min(y1, y2) <= bbox.y1) {
      // Vertical line at x = x1 intersects right edge
      intersections.push([bbox.x1, Math.max(bbox.y0, Math.min(y1, y2))]);
      intersections.push([bbox.x1, Math.min(bbox.y1, Math.max(y1, y2))]);
    }

    // Sort polygon vertices in counter-clockwise order for proper point-in-polygon test
    const polygon = [...leftCorners, ...intersections];
    if (polygon.length < 3) continue;

    // Sort vertices by angle from centroid to ensure proper polygon order
    const cx = polygon.reduce((sum, [x]) => sum + x, 0) / polygon.length;
    const cy = polygon.reduce((sum, [, y]) => sum + y, 0) / polygon.length;
    polygon.sort(([x1, y1], [x2, y2]) => {
      const angle1 = Math.atan2(y1 - cy, x1 - cx);
      const angle2 = Math.atan2(y2 - cy, x2 - cx);
      return angle1 - angle2;
    });

    // Generate random point inside the polygon
    const [newX, newY] = randomPointInPolygon(polygon, random);

    // Update the point's position
    placed.set(point, [newX, newY]);

    // Update bbox to the polygon's bounding box
    const xs = polygon.map(([x]) => x);
    const ys = polygon.map(([, y]) => y);
    bbox.x0 = Math.min(...xs);
    bbox.x1 = Math.max(...xs);
    bbox.y0 = Math.min(...ys);
    bbox.y1 = Math.max(...ys);

    if (debug) {
      console.log(`Updated ${point} to [${newX}, ${newY}] within polygon:`, polygon);
    }
  }

  return placed;
}

export {pointsByConstraints};
