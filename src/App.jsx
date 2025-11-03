import {useEffect, useRef} from "react";
import * as d3 from "d3";
import {data} from "./data.js";
import "./App.css";

function parseConstrain(c) {
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

function inferConstrains(constrains) {
  const horizontal = constrains.filter((c) => c.includes(">"));
  const vertical = constrains.filter((c) => c.includes("v"));
  function infer(constrains, v) {
    const nodeById = new Map();
    const countById = new Map();
    const set = new Set(constrains);
    const raw = new Set(constrains);
    for (const c of set) {
      const [s, , t] = parseConstrain(c);
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

function pointsByConstrains(spec, {debug = false, random} = {}) {
  const constrains = d3.sort(inferConstrains(spec.constrains), (d) => parseConstrain(d)[0]);
  const constrainsById = new Map();

  for (const c of constrains) {
    const [s, v, t] = parseConstrain(c);
    constrainsById.set(s, (constrainsById.get(s) || []).concat([[t, v, 1]]));
    constrainsById.set(t, (constrainsById.get(t) || []).concat([[s, v, 0]]));
  }

  const placed = new Map();
  const toPlace = Array.from(constrainsById.keys());
  let next;
  let maxIter = 1000;
  let iter = 0;

  while ((next = toPlace.shift()) && iter < maxIter) {
    iter++;
    const constrains = constrainsById.get(next);
    let x0 = -Infinity;
    let x1 = Infinity;
    let y0 = -Infinity;
    let y1 = Infinity;
    for (const [s, v, left] of constrains) {
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
    if (debug) {
      console.log(next, {x, y, x0, x1, y0, y1, constrains});
    }
  }

  return placed;
}

function draw(node, {debug = false, random, spec} = {}) {
  const pointById = pointsByConstrains(spec, {debug, random});
  const points = Array.from(pointById.values());
  const X = points.map(([x, y]) => x);
  const Y = points.map(([x, y]) => y);
  const width = 200;
  const height = 200;
  const padding = 20;
  const svg = d3.select(node).append("svg").attr("width", width).attr("height", height);

  const scaleX = d3
    .scaleLinear()
    .domain(d3.extent(X))
    .range([padding, width - padding]);

  const scaleY = d3
    .scaleLinear()
    .domain(d3.extent(Y))
    .range([padding, height - padding]);

  const lines = spec.links.map((link) => link.split(",").map((id) => pointById.get(id)));

  const entries = Array.from(pointById.entries());

  svg
    .selectAll("line")
    .data(lines)
    .join("line")
    .attr("x1", (d) => scaleX(d[0][0]))
    .attr("y1", (d) => scaleY(d[0][1]))
    .attr("x2", (d) => scaleX(d[1][0]))
    .attr("y2", (d) => scaleY(d[1][1]))
    .attr("stroke", "black")
    .attr("stroke-width", 1);

  svg
    .selectAll("circle")
    .data(points)
    .join("circle")
    .attr("cx", (d) => scaleX(d[0]))
    .attr("cy", (d) => scaleY(d[1]))
    .attr("r", 8);

  svg
    .selectAll("text")
    .data(entries)
    .join("text")
    .text((d) => d[0])
    .attr("x", (d) => scaleX(d[1][0]))
    .attr("y", (d) => scaleY(d[1][1]))
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("fill", "white")
    .attr("font-size", 12);
}

function App() {
  const nodeRefs = data.map(() => useRef(null));

  useEffect(() => {
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const r = d3.randomLcg(i * 100);
      function random(min, max) {
        return min + (max - min) * r();
      }
      const parent = nodeRefs[i].current;
      if (parent) parent.innerHTML = "";
      for (let j = 0; j < 14; j++) {
        const node = document.createElement("div");
        parent.appendChild(node);
        draw(node, {random, spec: item});
      }
    }
  }, []);

  return (
    <>
      <h1>Graph Typeface</h1>
      <h1>A graph representation for typeface</h1>
      {data.map((item, index) => (
        <div key={index}>
          <h2>{item.char}</h2>
          <div ref={nodeRefs[index]} className="flex flex-wrap"></div>
        </div>
      ))}
    </>
  );
}

export default App;
