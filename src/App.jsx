import {useEffect, useRef, useState} from "react";
import * as d3 from "d3";
import {data} from "./data.js";
import CodeMirror from "@uiw/react-codemirror";
import {javascript} from "@codemirror/lang-javascript";
import * as webgl from "./webgl.js";
import {Play} from "lucide-react";
import "./App.css";

function parseConstraint(c) {
  const [s, v, t] = c;
  return [s, v, t];
}

function Node(id) {
  this.id = id;
  this.children = [];
}

function traverse(node, fn) {
  fn(node);
  for (const child of node.children) {
    traverse(child, fn);
  }
}

function inferConstraints(constraints) {
  const horizontal = constraints.filter((c) => c.includes(">"));
  const vertical = constraints.filter((c) => c.includes("v"));
  function infer(constraints, v) {
    const nodeById = new Map();
    const countById = new Map();
    const set = new Set(constraints);
    const raw = new Set(constraints);
    for (const c of set) {
      const [s, , t] = parseConstraint(c);
      if (!nodeById.has(s)) nodeById.set(s, new Node(s));
      if (!nodeById.has(t)) nodeById.set(t, new Node(t));
      nodeById.get(s).children.push(nodeById.get(t));
    }
    for (const node of nodeById.values()) {
      const sid = node.id;
      traverse(node, (child) => {
        const tid = child.id;
        if (tid === sid) return;
        const nc = `${sid}${v}${tid}`;
        set.add(nc);
        if (raw.has(nc)) {
          const count = countById.get(nc) ?? 0;
          countById.set(nc, count + 1);
        }
      });
    }
    for (const [nc, count] of countById.entries()) {
      if (count > 1) console.warn(`${nc} is redundant.`);
    }
    return set;
  }
  return [...infer(horizontal, ">"), ...infer(vertical, "v")];
}

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
      console.log(polygon);
      return [x, y];
    }
  }

  // Fallback: return centroid if rejection sampling fails
  const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
  return [cx, cy];
}

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

function drawSVG(node, {debug = false, random, spec, curveType = d3.curveLinear, showDebug = false} = {}) {
  const pointById = pointsByConstraints(spec, {debug, random});
  const points = Array.from(pointById.values());
  const X = points.map(([x, y]) => x);
  const Y = points.map(([x, y]) => y);
  const width = 200;
  const height = 200;
  const padding = 30;
  const svg = d3
    .select(node)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("width", "100%")
    .style("height", "100%");

  const scaleX = d3
    .scaleLinear()
    .domain(d3.extent(X))
    .range([padding, width - padding]);

  const scaleY = d3
    .scaleLinear()
    .domain(d3.extent(Y))
    .range([padding, height - padding]);

  const paths = spec.links.map((path) => path.split(",").map((id) => pointById.get(id)));

  const line = d3
    .line()
    .curve(curveType)
    .x((d) => scaleX(d[0]))
    .y((d) => scaleY(d[1]));

  const entries = Array.from(pointById.entries());

  svg
    .selectAll("path")
    .data(paths)
    .join("path")
    .attr("d", line)
    .attr("stroke", "#e5e5e5")
    .attr("fill", "none")
    .attr("stroke-width", 1.5);

  if (showDebug) {
    svg
      .selectAll("circle")
      .data(points)
      .join("circle")
      .attr("cx", (d) => scaleX(d[0]))
      .attr("cy", (d) => scaleY(d[1]))
      .attr("r", 8)
      .attr("fill", "#e5e5e5");

    svg
      .selectAll("text")
      .data(entries)
      .join("text")
      .text((d) => d[0])
      .attr("x", (d) => scaleX(d[1][0]))
      .attr("y", (d) => scaleY(d[1][1]))
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "#000")
      .attr("font-size", 12);
  }
}

function drawWebGL(node, {random, spec, count, animate = true} = {}) {
  const {contextGL, Matrix, M, Shader, drawMesh, V, setUniform} = webgl;
  const fonts = d3.range(count).map(() => {
    const pointById = pointsByConstraints(spec, {random});
    const points = Array.from(pointById.values());
    const X = points.map(([x, y]) => x);
    const Y = points.map(([x, y]) => y);
    const scaleX = d3.scaleLinear(d3.extent(X), [0, 1]);
    const scaleY = d3.scaleLinear(d3.extent(Y), [0, 1]);
    return {
      name: spec.char,
      paths: spec.links.map((path) =>
        path.split(",").map((id) => {
          const [x, y] = pointById.get(id);
          return [scaleX(x), scaleY(y)];
        })
      ),
    };
  });

  const matrix = new Matrix();
  const myPaths = [];
  const cols = 5;
  const cw = 0.14;
  const ch = 0.16;
  const totalW = cols * cw;
  const totalH = Math.ceil(fonts.length / cols) * ch;
  const startX = -totalW / 2 + 0.02;
  const startY = -totalH / 2 + 0.125;
  for (let n = 0; n < fonts.length; n++) {
    let x = startX + (n % cols) * cw;
    let row = (n / cols) >> 0;
    let maxRow = Math.ceil(fonts.length / cols) - 1;
    let y = startY + (maxRow - row) * ch;
    let paths = fonts[n].paths;
    for (let i = 0; i < paths.length; i++) {
      let myPath = [];
      let path = paths[i];
      for (let j = 0; j < path.length; j++) {
        let p = path[j];
        myPath.push([x + (p[0] * 200) / 2000, y - (p[1] * 200) / 2000, 0]);
      }
      myPaths.push(myPath);
    }
  }

  const mesh = createPathsMesh(0.005, myPaths);

  const size = Math.min(node.clientWidth, node.clientHeight);

  const canvas = contextGL({
    width: size,
    height: size,
    update,
    vertexShader: Shader.defaultVertexShader,
    fragmentShader: Shader.defaultFragmentShader,
    style: {padding: 0, margin: 0},
  });

  node.appendChild(canvas);

  function createPathsMesh(width, paths) {
    let vertices = [];
    let addVertex = (pos) => vertices.push(pos, [0, 0, 1]);
    for (let n = 0; n < paths.length; n++) {
      let path = paths[n];
      for (let i = 0; i < path.length - 1; i++) {
        let b = path[i];
        let c = path[i + 1];
        let a = i > 0 ? path[i - 1] : V.add(b, V.subtract(b, c));
        let da = V.normalize(V.subtract(b, a));
        let dc = V.normalize(V.subtract(c, b));
        let db = V.normalize(V.add(da, dc));
        let s = V.dot(da, db);
        da = V.resize(da, width / 2);
        dc = V.resize(dc, width / 2);
        db = V.resize(db, width / 2);
        let ea = [-da[1], da[0], 0];
        let ec = [-dc[1], dc[0], 0];
        let eb = [-db[1] / s, db[0] / s, 0];
        if (i == 0) b = V.subtract(b, da);
        if (V.dot(da, dc) < 0) {
          if (n > 0 && i == 0) addVertex(V.subtract(b, ea));
          addVertex(V.subtract(b, ea));
          addVertex(V.add(b, ea));
          addVertex(V.subtract(b, ec));
          addVertex(V.add(b, ec));
        } else {
          if (n > 0 && i == 0) addVertex(V.subtract(b, eb));
          addVertex(V.subtract(b, eb));
          addVertex(V.add(b, eb));
        }
        if (i == path.length - 2) {
          addVertex(V.subtract(V.add(c, dc), ec));
          addVertex(V.add(V.add(c, dc), ec));
        }
        if (n < paths.length - 1 && i == path.length - 2) addVertex(V.add(V.add(c, dc), ec));
      }
    }
    return {
      triangle_strip: true,
      data: new Float32Array(vertices.flat()),
    };
  }

  function draw(gl, mesh, meshMatrix, color) {
    let m = M.mxm(M.perspective(0, 0, -0.5), meshMatrix ?? matrix.get());
    setUniform(gl, "Matrix4fv", "uMF", false, m);
    setUniform(gl, "Matrix4fv", "uMI", false, M.inverse(m));
    setUniform(gl, "3fv", "uColor", color ?? [1, 1, 1]);
    drawMesh(gl, mesh);
  }

  function update(gl) {
    let time = animate ? Date.now() / 1000 : 0;
    draw(gl, mesh, M.mxm(M.move(-0, -0, 0), M.mxm(M.turnY(Math.sin(time)), M.scale(2.5))));
  }

  return canvas.remove;
}

function preprocessSpec({nodes = [], links = [], constraints = {}, ...rest}) {
  const set = new Set(nodes);

  const positionConstraints = constraints.position || [];
  const sideConstraints = constraints.side || [];

  const validPositionConstraints = positionConstraints.filter((constraint) => {
    const [s, v, t] = parseConstraint(constraint);
    return set.has(s) && set.has(t);
  });

  const validSideConstraints = sideConstraints.filter((constraint) => {
    // Format: "c>b,d" means point c is on the left of line b->d
    const parts = constraint.split(">");
    if (parts.length !== 2) return false;
    const point = parts[0].trim();
    const lineParts = parts[1].split(",");
    if (lineParts.length !== 2) return false;
    const [lineStart, lineEnd] = lineParts.map((p) => p.trim());
    return set.has(point) && set.has(lineStart) && set.has(lineEnd);
  });

  const validLinks = links
    .map((link) =>
      link
        .split(",")
        .filter((id) => set.has(id))
        .join(",")
    )
    .filter((link) => link.length > 0);

  return {
    ...rest,
    nodes,
    links: validLinks,
    constraints: {
      position: inferConstraints(validPositionConstraints),
      side: validSideConstraints,
    },
  };
}

const curveOptions = [
  {name: "Linear", value: "curveLinear"},
  {name: "Basis", value: "curveBasis"},
  {name: "Bundle", value: "curveBundle"},
  {name: "Cardinal", value: "curveCardinal"},
  {name: "Catmull-Rom", value: "curveCatmullRom"},
  {name: "Monotone X", value: "curveMonotoneX"},
  {name: "Monotone Y", value: "curveMonotoneY"},
  {name: "Natural", value: "curveNatural"},
  {name: "Step", value: "curveStep"},
  {name: "Step After", value: "curveStepAfter"},
  {name: "Step Before", value: "curveStepBefore"},
];

function App() {
  const [seed, setSeed] = useState(0);
  const [seedInput, setSeedInput] = useState("0");
  const [selectedChar, setSelectedChar] = useState(data[3].char);
  const [selectedCurve, setSelectedCurve] = useState("curveCardinal");
  const [showDebug, setShowDebug] = useState(false);
  const [renderer, setRenderer] = useState("SVG");
  const [animate, setAnimate] = useState(true);
  const initialItem = data.find((d) => d.char === selectedChar);

  const initialCode = JSON.stringify(initialItem, null, 2);

  const [code, setCode] = useState(initialCode);
  const [currentSpec, setCurrentSpec] = useState(initialItem);
  const [error, setError] = useState(null);
  const [codeChanged, setCodeChanged] = useState(false);
  const nodeRef = useRef(null);

  const handleRun = () => {
    try {
      const parsed = JSON.parse(code);
      setCurrentSpec(parsed);
      setError(null);
      setCodeChanged(false);
    } catch (error) {
      console.error("Invalid JSON:", error);
      setError(error.message);
      setCurrentSpec(null);
    }
  };

  useEffect(() => {
    if (!currentSpec) return;
    const r = d3.randomLcg(seed);
    function random(min, max) {
      return min + (max - min) * r();
    }
    const parent = nodeRef.current;
    if (parent) parent.innerHTML = "";
    const curveType = d3[selectedCurve];

    const count = 20;
    const processedSpec = preprocessSpec(currentSpec);
    let destroy;

    if (renderer === "WebGL") {
      destroy = drawWebGL(parent, {random, spec: processedSpec, count, animate});
    } else if (renderer === "SVG") {
      for (let j = 0; j < count; j++) {
        const node = document.createElement("div");
        parent.appendChild(node);
        drawSVG(node, {random, spec: processedSpec, curveType, showDebug});
      }
    }

    return () => destroy?.();
  }, [currentSpec, selectedCurve, showDebug, renderer, seed, animate]);

  useEffect(() => {
    const item = data.find((d) => d.char === selectedChar);
    if (item) {
      const newCode = JSON.stringify(item, null, 2);
      setCode(newCode);
      setCurrentSpec(item);
      setError(null);
      setCodeChanged(false);
    }
  }, [selectedChar]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="p-4 border-b border-[#333]">
        <h1 className="m-0 text-xl font-semibold">[WIP] GType: A Graph Representation for Typeface</h1>
      </header>
      <div className="p-4 border-b border-dashed border-[#333] flex justify-start items-center gap-4 bg-[#0f0f0f]">
        <button
          onClick={handleRun}
          className={`flex items-center gap-1.5 px-4 py-2 border rounded cursor-pointer text-sm font-medium transition-colors ${
            codeChanged
              ? "bg-blue-500 text-white border-blue-500 hover:bg-blue-600 hover:border-blue-600"
              : "bg-transparent text-[#e5e5e5] border-[#333] hover:border-[#555]"
          }`}
        >
          <Play size={16} />
          Run
        </button>

        <div>
          <label htmlFor="seed-input" className="mr-2.5 text-[#e5e5e5]">
            Seed:
          </label>
          <input
            id="seed-input"
            type="number"
            value={seedInput}
            onChange={(e) => {
              setSeedInput(e.target.value);
              const val = e.target.value === "" ? 0 : Number(e.target.value);
              setSeed(isNaN(val) ? 0 : val);
            }}
            min={-Infinity}
            max={Infinity}
            step={1}
            className="px-2.5 py-1.5 bg-[#1a1a1a] text-[#e5e5e5] border border-[#333] rounded text-sm w-20"
          />
        </div>
        <div>
          <label htmlFor="char-select" className="mr-2.5 text-[#e5e5e5]">
            Character:
          </label>
          <select
            id="char-select"
            value={selectedChar}
            onChange={(e) => setSelectedChar(e.target.value)}
            className="px-2.5 py-1.5 bg-[#1a1a1a] text-[#e5e5e5] border border-[#333] rounded text-sm cursor-pointer"
          >
            {data.map((d) => (
              <option key={d.char} value={d.char}>
                {d.char}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="renderer-select" className="mr-2.5 text-[#e5e5e5]">
            Renderer:
          </label>
          <select
            id="renderer-select"
            value={renderer}
            onChange={(e) => setRenderer(e.target.value)}
            className="px-2.5 py-1.5 bg-[#1a1a1a] text-[#e5e5e5] border border-[#333] rounded text-sm cursor-pointer"
          >
            <option value="SVG">SVG</option>
            <option value="WebGL">WebGL</option>
          </select>
        </div>
        {renderer === "WebGL" && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="animate-checkbox"
              checked={animate}
              onChange={(e) => setAnimate(e.target.checked)}
              className="mr-2 cursor-pointer"
            />
            <label htmlFor="animate-checkbox" className="text-[#e5e5e5] cursor-pointer">
              Animate
            </label>
          </div>
        )}
        {renderer === "SVG" && (
          <>
            <div>
              <label htmlFor="curve-select" className="mr-2.5 text-[#e5e5e5]">
                Curve:
              </label>
              <select
                id="curve-select"
                value={selectedCurve}
                onChange={(e) => setSelectedCurve(e.target.value)}
                className="px-2.5 py-1.5 bg-[#1a1a1a] text-[#e5e5e5] border border-[#333] rounded text-sm cursor-pointer"
              >
                {curveOptions.map((curve) => (
                  <option key={curve.value} value={curve.value}>
                    {curve.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="debug-checkbox"
                checked={showDebug}
                onChange={(e) => setShowDebug(e.target.checked)}
                className="mr-2 cursor-pointer"
              />
              <label htmlFor="debug-checkbox" className="text-[#e5e5e5] cursor-pointer">
                Debug
              </label>
            </div>
          </>
        )}
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/3 flex flex-col border-r border-dashed border-[#333]">
          <div className="flex-1 overflow-auto p-4 bg-[#161616]">
            <CodeMirror
              value={code}
              height="100%"
              theme="dark"
              extensions={[javascript({json: true})]}
              onChange={(value) => {
                setCode(value);
                setCodeChanged(true);
              }}
              className="text-sm"
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                highlightSpecialChars: true,
                foldGutter: true,
                drawSelection: true,
                dropCursor: true,
                allowMultipleSelections: true,
                indentOnInput: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                rectangularSelection: true,
                crosshairCursor: true,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
                closeBracketsKeymap: true,
                searchKeymap: true,
                foldKeymap: true,
                completionKeymap: true,
                lintKeymap: true,
              }}
              style={{backgroundColor: "#161616"}}
            />
          </div>
        </div>
        <div className="w-2/3 overflow-auto p-5">
          {error ? (
            <div className="bg-red-900/20 border border-red-500 rounded p-4">
              <h2 className="text-red-400 font-semibold mb-2 text-lg">Error</h2>
              <p className="text-red-300 font-mono text-sm">{error}</p>
            </div>
          ) : currentSpec ? (
            <div className="w-full h-full">
              <div
                ref={nodeRef}
                className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 w-full h-full`}
              ></div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default App;
