export function getDependencies(data: Record<string, unknown>): string[] {
  const dependencies = data.dependencies;
  if (!Array.isArray(dependencies)) return [];
  return [...new Set(dependencies.filter((uuid): uuid is string => typeof uuid === "string"))];
}
