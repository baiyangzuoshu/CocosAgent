export interface DependencyEdge {
  owner: string;
  dependency: string;
}

export class DependencyGraph {
  private readonly outgoing = new Map<string, string[]>();

  add(owner: string, dependency: string): void {
    const dependencies = this.outgoing.get(owner) ?? [];
    dependencies.push(dependency);
    this.outgoing.set(owner, dependencies);
  }

  edges(): DependencyEdge[] {
    return [...this.outgoing].flatMap(([owner, dependencies]) =>
      dependencies.map((dependency) => ({ owner, dependency }))
    );
  }

  collect(root: string): string[] {
    const visited = new Set<string>();
    const visit = (uuid: string): void => {
      for (const dependency of this.outgoing.get(uuid) ?? []) {
        if (visited.has(dependency)) continue;
        visited.add(dependency);
        visit(dependency);
      }
    };
    visit(root);
    return [...visited];
  }
}
