function add(a: number, b: number): number { return a + b; }

async function fetchData(url: string): Promise<string> { const res = await fetch(url); return res.text(); }

const multiply = (a: number, b: number): number => { return a * b; }

const delay = async (ms: number): Promise<void> => { return new Promise(resolve => setTimeout(resolve, ms)); }

const double = (x: number): number => x * 2;
