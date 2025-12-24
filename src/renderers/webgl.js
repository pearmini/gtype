import * as d3 from "d3";
import * as webgl from "../utils/webgl.js";
import {pointsByConstraints} from "../utils/positioning.js";

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

export {drawWebGL};
