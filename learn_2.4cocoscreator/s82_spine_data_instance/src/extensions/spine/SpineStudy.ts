class SkeletonData {
    private runtimeData: { bones: string[]; attachments: Map<string, string> } | null = null;
    constructor(readonly bones: readonly string[], readonly atlasPages: readonly string[]) {}
    getRuntimeData(): { bones: string[]; attachments: Map<string, string> } {
        if (!this.runtimeData) this.runtimeData = { bones: [...this.bones], attachments: new Map() };
        return this.runtimeData;
    }
}
class SkeletonInstance {
    readonly runtimeData: { bones: string[]; attachments: Map<string, string> };
    readonly pose = new Map<string, number>();
    readonly renderVertices: number[] = [];
    constructor(readonly data: SkeletonData) { this.runtimeData = data.getRuntimeData(); }
    setBoneX(name: string, x: number): void { this.pose.set(name, x); }
}
export function runLesson(): string[] {
    const data = new SkeletonData(['root', 'arm'], ['atlas-0.png']);
    const first = new SkeletonInstance(data);
    const second = new SkeletonInstance(data);
    first.setBoneX('arm', 2);
    second.setBoneX('arm', 9);
    first.renderVertices.push(0, 1, 2);
    return [
        `SkeletonData shared=${first.data === second.data}`,
        `runtime data cached/shared=${first.runtimeData === second.runtimeData}`,
        `pose independent=${first.pose.get('arm')} / ${second.pose.get('arm')}`,
        `render arrays independent=${first.renderVertices !== second.renderVertices}`,
    ];
}
