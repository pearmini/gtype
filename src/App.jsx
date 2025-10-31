import {useEffect, useRef} from "react";
import * as d3 from "d3";
import "./App.css";

function pointsByConstrains({constrains}, {debug = false, random} = {}) {
  const pointById = new Map();
  let [next, ...rest] = constrains;
  const set = new Set(rest);
  let maxIter = 100;
  let iter = 0;
  while (next && iter < maxIter) {
    iter++;
    const [s, v, t] = next;
    let ps;
    if (!(ps = pointById.get(s))) pointById.set(s, (ps = [0, 0]));
    let pt = pointById.get(t);
    if (!pt) {
      if (v === "v") {
        const [psx, psy] = ps;
        const ptx = psx + random(-0.5, 0.5);
        const pty = psy + random(0.1, 0.9);
        pt = [ptx, pty];
      } else {
        const [psx, psy] = ps;
        const pty = psy + random(-0.5, 0.5);
        const ptx = psx + random(0.1, 0.9);
        pt = [ptx, pty];
      }
    }
    if (debug) {
      console.log(s, v, t, ps, pt);
    }
    pointById.set(t, pt);
    next = null;
    find: for (const rc of set) {
      const keys = pointById.keys();
      for (const key of keys) {
        if (rc.includes(key)) {
          next = rc;
          set.delete(rc);
          break find;
        }
      }
    }
  }
  return pointById;
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
