type Version = { major: number; minor: number; patch: number };
function parseVersion(text: string): Version {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(text);
    if (!match) throw new Error(`invalid export version: ${text}`);
    return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}
function sameRuntimeLine(exported: Version, runtime: Version): boolean {
    return exported.major === runtime.major && exported.minor === runtime.minor;
}
class SkeletonData {
    constructor(readonly exportVersion: string, readonly format: 'json' | 'binary') {}
    get version(): Version { return parseVersion(this.exportVersion); }
}
export function runLesson(): string[] {
    const data = new SkeletonData('3.8.75', 'json');
    const runtime = parseVersion('3.8.99');
    const version = data.version;
    const lineCompatible = sameRuntimeLine(version, runtime);
    return [
        `format=${data.format}; exported=${data.exportVersion}; runtime=3.8.99`,
        `same major/minor line=${lineCompatible}`,
        'compatibility still requires checking supported features and parsing the actual asset',
    ];
}
