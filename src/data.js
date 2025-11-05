export const data = [
  {
    char: "A",
    nodes: ["a", "b", "c", "d", "e"],
    paths: ["d,e,a,b,c", "e,b"],
    constrains: ["avb", "ave", "bvc", "evd", "b>c", "d>e", "evc", "a>b", "e>a", "bvd"],
  },
  {
    char: "B",
    nodes: ["a", "b", "c", "d", "e", "f", "g"],
    paths: ["a,b,c,d,e,f,g,d,a"],
    constrains: ["avb", "bvc", "d>c", "cvd", "dve", "evf", "fvg", "d>g", "a>c", "g>e", "c>b", "e>f"],
  },
];
