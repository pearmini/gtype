export const data = [
  {
    char: "A",
    nodes: ["a", "b", "c", "d", "e"],
    links: ["d,e,a,b,c", "e,b"],
    constraints: ["avb", "ave", "bvc", "evd", "b>c", "d>e", "evc", "a>b", "e>a", "bvd"],
  },
  {
    char: "B",
    nodes: ["a", "b", "c", "d", "e", "f", "g"],
    links: ["a,b,c,d,e,f,g,d,a"],
    constraints: ["avb", "bvc", "d>c", "cvd", "dve", "evf", "fvg", "d>g", "a>c", "g>e", "c>b", "e>f"],
  },
  {
    char: "C",
    nodes: ["a", "b", "c", "d"],
    links: ["a,b,c,d"],
    constraints: ["b>a", "bvc", "c>d", "avd", "c>a", "b>d"],
  },
];
