export const data = [
  {
    name: "A",
    nodes: ["a", "b", "c", "d", "e"],
    links: ["d,e,a,b,c", "e,b"],
    constraints: {
      position: ["avb", "ave", "bvc", "evd", "b>c", "d>e", "evc", "a>b", "e>a", "bvd"],
    },
  },
  {
    name: "B",
    nodes: ["a", "b", "c", "d", "e", "f", "g"],
    links: ["a,b,c,d,e,f,g,d,a"],
    constraints: {
      position: ["avb", "bvc", "d>c", "cvd", "dve", "evf", "fvg", "d>g", "a>c", "g>e", "c>b", "e>f"],
      side: ["c>b,d", "e>d,f"],
    },
  },
  {
    name: "C",
    nodes: ["a", "b", "c", "d"],
    links: ["a,b,c,d"],
    constraints: {
      position: ["b>a", "bvc", "c>d", "avd", "c>a", "b>d"],
      side: ["c>d,b", "d>a,c", "a>b,d", "b>c,a"],
    },
  },
  {
    name: "D",
    nodes: ["a", "b", "c", "d", "e"],
    links: ["a,b,c,d,e,a"],
    constraints: {
      position: ["a>b", "b>c", "bvc", "cvd", "d>c", "e>d", "e>b", "a>d", "avb", "dve"],
      side: ["b>a,c", "d>c,e"],
    },
  },
  {
    name: "E",
    links: ["a,b,c,d,f", "c,e"],
    nodes: ["a", "b", "c", "d", "e", "f"],
    constraints: {
      position: ["bvc", "cvd", "ave", "evf", "c>b", "c>d", "e>a", "e>f", "d>e", "b>e", "bve", "evd"],
      side: ["b>c,a", "d>f,c"],
    },
  },
];
