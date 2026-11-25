const UNSEEN = -1;

function compareComponents(first: number[], second: number[]): number {
  for (let i = 0; i < Math.min(first.length, second.length); i += 1) {
    if (first[i] !== second[i]) return first[i] - second[i];
  }
  return first.length - second.length;
}

export function circles(edges: number[][]): number[][] {
  const count = edges.length;
  const index = new Array<number>(count).fill(UNSEEN);
  const low = new Array<number>(count).fill(0);
  const onStack = new Array<boolean>(count).fill(false);
  const stack: number[] = [];
  const found: number[][] = [];
  let next = 0;
  const enter = (node: number): void => {
    index[node] = next;
    low[node] = next;
    next += 1;
    stack.push(node);
    onStack[node] = true;
  };
  for (let start = 0; start < count; start += 1) {
    if (index[start] !== UNSEEN) continue;
    const work: { node: number; edge: number }[] = [{ node: start, edge: 0 }];
    enter(start);
    while (work.length > 0) {
      const frame = work[work.length - 1];
      const to = edges[frame.node][frame.edge];
      if (to !== undefined) {
        frame.edge += 1;
        if (index[to] === UNSEEN) {
          enter(to);
          work.push({ node: to, edge: 0 });
        } else if (onStack[to]) {
          low[frame.node] = Math.min(low[frame.node], index[to]);
        }
        continue;
      }
      work.pop();
      const parent = work[work.length - 1];
      if (parent !== undefined) low[parent.node] = Math.min(low[parent.node], low[frame.node]);
      if (low[frame.node] !== index[frame.node]) continue;
      const component: number[] = [];
      for (let member = stack.pop(); member !== undefined; member = stack.pop()) {
        onStack[member] = false;
        component.push(member);
        if (member === frame.node) break;
      }
      if (component.length > 1) found.push(component.sort((a, b) => a - b));
    }
  }
  return found.sort(compareComponents);
}
