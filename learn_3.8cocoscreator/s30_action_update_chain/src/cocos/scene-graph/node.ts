import { type ActionTarget } from "../tween/actions/action.ts";

export default class Node implements ActionTarget {
  constructor(readonly name: string) {}
}
