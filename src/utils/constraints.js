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

export {parseConstraint, Node, traverse, inferConstraints};
