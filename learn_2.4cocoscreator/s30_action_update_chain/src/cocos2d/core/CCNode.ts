import type { CCActionTarget } from "../actions/CCAction.ts";

export default class CCNode implements CCActionTarget {
  constructor(readonly name: string) {}
}
