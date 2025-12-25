// Cross product: (dx, dy) × (px - x1, py - y1)
// In a coordinate system where y increases upward, positive means left
// But we need to account for the coordinate system orientation
function toLeft(point, lineStart, lineEnd) {
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  const [px, py] = point;
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * (py - y1) - dy * (px - x1) < 0;
}

// Point-in-polygon test using ray casting algorithm
function pointInPolygon(point, polygon) {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Generate a random point inside a polygon using rejection sampling
function randomPointInPolygon(polygon, random, maxAttempts = 1000) {
  // Find bounding box of polygon
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Rejection sampling
  for (let i = 0; i < maxAttempts; i++) {
    const x = random(minX, maxX);
    const y = random(minY, maxY);
    if (pointInPolygon([x, y], polygon)) {
      return [x, y];
    }
  }

  // Fallback: return centroid if rejection sampling fails
  const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
  return [cx, cy];
}

export {toLeft, pointInPolygon, randomPointInPolygon};
