import {parseConstraint, inferConstraints} from "./constraints.js";

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

export {preprocessSpec};
