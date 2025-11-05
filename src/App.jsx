import {useEffect, useRef, useState} from "react";
import * as d3 from "d3";
import {data as _data} from "./data.js";
import CodeMirror from "@uiw/react-codemirror";
import {javascript} from "@codemirror/lang-javascript";
import {Play} from "lucide-react";
import "./App.css";

const data = _data.map((item) => {
  return {
    ...item,
    constrains: inferConstrains(item.constrains),
  };
});

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
  const constrains = d3.sort(spec.constrains, (d) => parseConstrain(d)[0]);
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
    .attr("stroke", "#e5e5e5")
    .attr("stroke-width", 1.5);

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

function App() {
  const [selectedChar, setSelectedChar] = useState("A");
  const initialItem = data.find((d) => d.char === selectedChar);

  const initialCode = JSON.stringify(
    {
      char: initialItem.char,
      nodes: initialItem.nodes,
      links: initialItem.links,
      constrains: _data.find((d) => d.char === selectedChar)?.constrains || [],
    },
    null,
    2
  );

  const [code, setCode] = useState(initialCode);
  const [currentSpec, setCurrentSpec] = useState(initialItem);
  const [error, setError] = useState(null);
  const nodeRef = useRef(null);

  const handleRun = () => {
    try {
      const parsed = JSON.parse(code);
      const processedSpec = {
        ...parsed,
        constrains: inferConstrains(parsed.constrains),
      };
      setCurrentSpec(processedSpec);
      setError(null);
    } catch (error) {
      console.error("Invalid JSON:", error);
      setError(error.message);
      setCurrentSpec(null);
    }
  };

  useEffect(() => {
    if (!currentSpec) return;
    const r = d3.randomLcg(0);
    function random(min, max) {
      return min + (max - min) * r();
    }
    const parent = nodeRef.current;
    if (parent) parent.innerHTML = "";
    for (let j = 0; j < 16; j++) {
      const node = document.createElement("div");
      parent.appendChild(node);
      draw(node, {random, spec: currentSpec});
    }
  }, [currentSpec]);

  useEffect(() => {
    const item = _data.find((d) => d.char === selectedChar);
    if (item) {
      const newCode = JSON.stringify(
        {
          char: item.char,
          nodes: item.nodes,
          links: item.links,
          constrains: item.constrains,
        },
        null,
        2
      );
      setCode(newCode);
      setCurrentSpec(data.find((d) => d.char === selectedChar));
      setError(null);
    }
  }, [selectedChar]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="p-4 border-b border-[#333]">
        <h1 className="m-0 text-xl font-semibold">GType: A Graph Represetation for Typeface</h1>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-2/5 flex flex-col border-r border-[#333]">
          <div className="p-4 border-b border-[#333] flex justify-between items-center">
            <div>
              <label htmlFor="char-select" className="mr-2.5 text-[#e5e5e5]">
                Select Character:
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
            <button
              onClick={handleRun}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white border-none rounded cursor-pointer text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              <Play size={16} />
              Run
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 bg-[#161616]">
            <CodeMirror
              value={code}
              height="100%"
              theme="dark"
              extensions={[javascript({json: true})]}
              onChange={(value) => setCode(value)}
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
        <div className="w-3/5 overflow-auto p-5">
          {error ? (
            <div className="bg-red-900/20 border border-red-500 rounded p-4">
              <h2 className="text-red-400 font-semibold mb-2 text-lg">Error</h2>
              <p className="text-red-300 font-mono text-sm">{error}</p>
            </div>
          ) : currentSpec ? (
            <div>
              <div ref={nodeRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"></div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default App;
