import {useEffect, useRef} from "react";
import * as d3 from "d3";
import "./App.css";

function pointsByConstrains({constrains}, {debug = false, random} = {}) {
  const constrainsById = new Map();

  for (const c of constrains) {
    const [s, v, t] = c;
    constrainsById.set(s, (constrainsById.get(s) || []).concat([[t, v, 1]]));
    constrainsById.set(t, (constrainsById.get(t) || []).concat([[s, v, 0]]));
  }

  const placed = new Map();
  const toPlace = Array.from(constrainsById.keys());
  let next;
  let maxIter = 10;
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
    const x = random(x0, x1);
    const y = random(y0, y1);
    placed.set(next, [x, y]);
  }

  return placed;
}

function draw(node, {debug = false, random} = {}) {
  const A = {
    nodes: [0, 1, 2, 3, 4],
    links: ["0,1", "1,2", "0,4", "3,4", "4,1"],
    constrains: ["0v1", "0v4", "1v2", "4v3", "4>1", "3>2"],
  };
  const pointById = pointsByConstrains(A, {debug, random});
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

  const lines = A.links.map((link) => link.split(",").map((id) => pointById.get(id)));

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
    .enter()
    .append("circle")
    .attr("cx", (d) => scaleX(d[0]))
    .attr("cy", (d) => scaleY(d[1]))
    .attr("r", 10);

  const entries = Array.from(pointById.entries());

  svg
    .selectAll("text")
    .data(entries)
    .enter()
    .append("text")
    .text((d) => d[0])
    .attr("x", (d) => scaleX(d[1][0]))
    .attr("y", (d) => scaleY(d[1][1]))
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("fill", "white")
    .attr("font-size", 16);
}

function App() {
  const nodeRef = useRef(null);

  useEffect(() => {
    const r = d3.randomLcg(100);
    function random(min, max) {
      return min + (max - min) * r();
    }
    if (nodeRef.current) {
      nodeRef.current.innerHTML = "";
      for (let i = 0; i < 6; i++) {
        const node = document.createElement("div");
        nodeRef.current.appendChild(node);
        draw(node, {debug: i === 0, random});
      }
    }
  }, []);
  return (
    <>
      <h1>Graphical Typography</h1>
      <div ref={nodeRef} className="flex flex-wrap"></div>
    </>
  );
}

export default App;
