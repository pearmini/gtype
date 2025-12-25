import {useEffect, useRef, useState} from "react";
import * as d3 from "d3";
import {data} from "./data.js";
import CodeMirror from "@uiw/react-codemirror";
import {javascript} from "@codemirror/lang-javascript";
import {Play} from "lucide-react";
import "./App.css";
import {drawSVG} from "./renderers/svg.js";
import {drawWebGL} from "./renderers/webgl.js";
import {preprocessSpec} from "./utils/preprocess.js";

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
  const [selectedChar, setSelectedChar] = useState(data[0].name);
  const [selectedCurve, setSelectedCurve] = useState("curveCardinal");
  const [showDebug, setShowDebug] = useState(false);
  const [renderer, setRenderer] = useState("SVG");
  const [animate, setAnimate] = useState(true);
  const initialItem = data.find((d) => d.name === selectedChar);

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
    const item = data.find((d) => d.name === selectedChar);
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
        <h1 className="m-0 text-xl font-semibold">
          [WIP] GType: Procedurally Generated Typefaces based on a Graph Representation
        </h1>
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
              <option key={d.name} value={d.name}>
                {d.name}
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
