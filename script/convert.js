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

function findRedundant(constraints) {
  const horizontal = constraints.filter((c) => c.includes(">"));
  const vertical = constraints.filter((c) => c.includes("v"));
  function find(constraints, v) {
    const nodeById = new Map();
    const countById = new Map();
    const raw = new Set(constraints);
    const set = new Set(constraints);
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
        if (raw.has(nc)) {
          const count = countById.get(nc) ?? 0;
          countById.set(nc, count + 1);
        }
      });
    }
    const redundant = [];
    for (const [nc, count] of countById.entries()) {
      if (count > 1) redundant.push(nc);
    }
    return redundant;
  }
  return [...find(horizontal, ">"), ...find(vertical, "v")];
}

function simplify(constraints) {
  const redundant = findRedundant(constraints);
  return constraints.filter((c) => !redundant.includes(c));
}

function gtype(spec) {
  const keyof = (p) => `${p.x},${p.y}`;
  const {name, paths} = spec;
  const points = paths.flatMap((path) => path.flatMap(([x, y]) => ({x, y})));
  const keys = Array.from(new Set(points.map(keyof)));
  const nameByKey = new Map(keys.map((key, i) => [key, String.fromCharCode(97 + i)]));
  const keyByName = new Map(keys.map((key) => [nameByKey.get(key), key]));
  const nodes = Array.from(nameByKey.values());
  const links = paths.map((path) => path.map(([x, y]) => nameByKey.get(keyof({x, y}))).join(","));
  const constraints = [];
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      const [ax, ay] = keyByName.get(a).split(",").map(Number);
      const [bx, by] = keyByName.get(b).split(",").map(Number);
      const h = ax >= bx ? `${a}>${b}` : `${b}>${a}`;
      const v = ay >= by ? `${a}v${b}` : `${b}v${a}`;
      constraints.push(h, v);
    }
  }
  return {char: name, links, nodes, constraints: simplify(constraints)};
}

export function convert(linefont) {
  return linefont.map(gtype);
}

// Command-line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  let charToConvert = null;

  // Parse command-line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-c" && i + 1 < args.length) {
      charToConvert = args[i + 1];
      break;
    }
  }

  if (!charToConvert) {
    console.error("Usage: node script/convert.js -c <character>");
    console.error("Example: node script/convert.js -c A");
    process.exit(1);
  }

  // Import linefont and convert
  import("./linefont.js")
    .then(({linefont}) => {
      const charData = linefont.find((item) => item.name === charToConvert);
      if (!charData) {
        console.error(`Character "${charToConvert}" not found in linefont`);
        process.exit(1);
      }
      const result = gtype(charData);
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}
