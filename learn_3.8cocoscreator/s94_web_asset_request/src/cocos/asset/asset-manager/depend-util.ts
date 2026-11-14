/** 从反序列化前的对象中收集外部 UUID；同文件内的 __id__ 不算 Asset 依赖。 */
export function collectDependencies(data: unknown): string[] {
  const result = new Set<string>();

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== "object") return;

    const object = value as Record<string, unknown>;
    const uuidRef = object.__uuid__;
    if (typeof uuidRef === "string") result.add(uuidRef);
    for (const child of Object.values(object)) visit(child);
  };

  visit(data);
  return [...result];
}
