import * as d3 from "d3";
import {pointsByConstraints} from "../utils/positioning.js";

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

export {drawSVG};
