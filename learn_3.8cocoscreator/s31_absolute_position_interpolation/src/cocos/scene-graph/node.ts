import type { ActionTarget } from "../tween/actions/action-interval.ts";

export default class Node implements ActionTarget {
  constructor(readonly name: string, public x: number) {}
}
