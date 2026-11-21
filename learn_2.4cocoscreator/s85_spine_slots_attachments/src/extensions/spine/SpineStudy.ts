type Attachment = { name: string; region: string };
class Skin {
    private readonly attachments = new Map<string, Attachment>();
    setAttachment(slotName: string, attachment: Attachment): void { this.attachments.set(slotName, attachment); }
    getAttachment(slotName: string): Attachment | null { return this.attachments.get(slotName) ?? null; }
}
class Slot {
    attachment: Attachment | null = null;
    constructor(readonly name: string) {}
    setAttachment(value: Attachment | null): void { this.attachment = value; }
}
class Skeleton {
    readonly slots = new Map<string, Slot>();
    drawOrder: Slot[] = [];
    setSkin(skin: Skin): void {
        for (const slot of this.slots.values()) slot.setAttachment(skin.getAttachment(slot.name));
    }
    collectDrawItems(): string[] {
        return this.drawOrder.flatMap((slot) => slot.attachment ? [`${slot.name}:${slot.attachment.name}`] : []);
    }
}
export function runLesson(): string[] {
    const skin = new Skin();
    skin.setAttachment('body', { name: 'body-region', region: 'atlas/body' });
    skin.setAttachment('arm', { name: 'arm-region', region: 'atlas/arm' });
    const body = new Slot('body');
    const arm = new Slot('arm');
    const head = new Slot('head');
    const skeleton = new Skeleton();
    skeleton.slots.set(body.name, body);
    skeleton.slots.set(arm.name, arm);
    skeleton.slots.set(head.name, head);
    skeleton.setSkin(skin);
    skeleton.drawOrder = [body, head, arm];
    return [`attachments = ${[...skeleton.slots.values()].map((slot) => slot.attachment?.name ?? 'none').join(', ')}`, `draw order = ${skeleton.collectDrawItems().join(' -> ')}`];
}
