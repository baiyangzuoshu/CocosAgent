type Attachment = { name: string; texture: string; kind: "region" | "mesh" };
class Skin {
  private readonly attachments = new Map<string, Attachment>();
  constructor(readonly name: string) {}
  private key(slot: string, name: string): string { return `${slot}/${name}`; }
  setAttachment(slot: string, name: string, attachment: Attachment): void { this.attachments.set(this.key(slot, name), attachment); }
  getAttachment(slot: string, name: string): Attachment | null { return this.attachments.get(this.key(slot, name)) ?? null; }
  copyAttachmentsFrom(other: Skin): void { for (const [key, attachment] of other.attachments) this.attachments.set(key, attachment); }
}
class Slot {
  attachment: Attachment | null = null;
  constructor(readonly name: string, public attachmentName: string, readonly setupAttachmentName: string | null) {}
  setAttachment(value: Attachment | null): void { this.attachment = value; }
  resetToSetupPose(skin: Skin): void { this.attachmentName = this.setupAttachmentName ?? ""; this.attachment = skin.getAttachment(this.name, this.attachmentName); }
}
class Skeleton {
  readonly slots: Slot[];
  drawOrder: Slot[];
  currentSkin: Skin;
  constructor(slots: Slot[], defaultSkin: Skin) { this.slots = slots; this.drawOrder = [...slots]; this.currentSkin = defaultSkin; this.setSkin(defaultSkin); }
  setSkin(next: Skin): void {
    const previous = this.currentSkin;
    for (const slot of this.slots) {
      const currentName = slot.attachmentName;
      const oldAttachment = previous.getAttachment(slot.name, currentName);
      const replacement = next.getAttachment(slot.name, currentName);
      // Spine carries an attachment into the new skin only when the same named slot attachment exists.
      if (oldAttachment && replacement) slot.setAttachment(replacement);
    }
    this.currentSkin = next;
  }
  setSlotsToSetupPose(): void { for (const slot of this.slots) slot.resetToSetupPose(this.currentSkin); this.drawOrder = [...this.slots]; }
  setDrawOrder(names: readonly string[]): void {
    const map = new Map(this.slots.map((slot) => [slot.name, slot]));
    const reordered = names.map((name) => map.get(name));
    if (reordered.length !== this.slots.length || reordered.some((slot) => !slot)) throw new Error("draw order must name each slot exactly once");
    this.drawOrder = reordered as Slot[];
  }
  collectDrawItems(): string[] { return this.drawOrder.flatMap((slot, index) => slot.attachment ? [`${index}:${slot.name}/${slot.attachment.name}[${slot.attachment.kind}] tex=${slot.attachment.texture}`] : []); }
}
export function runLesson(): string[] {
  const base = new Skin("default");
  base.setAttachment("body", "body", { name: "body-region", texture: "atlas/body", kind: "region" });
  base.setAttachment("arm", "arm", { name: "arm-mesh", texture: "atlas/arm", kind: "mesh" });
  const winter = new Skin("winter"); winter.copyAttachmentsFrom(base);
  winter.setAttachment("body", "body", { name: "body-snow", texture: "winter-atlas/body", kind: "region" });
  const slots = [new Slot("body", "body", "body"), new Slot("head", "head", null), new Slot("arm", "arm", "arm")];
  const skeleton = new Skeleton(slots, base);
  skeleton.setSkin(winter); skeleton.setDrawOrder(["arm", "body", "head"]);
  const log = [`skin=${skeleton.currentSkin.name}; active attachments=${slots.map((slot) => `${slot.name}:${slot.attachment?.name ?? "<none>"}`).join(", ")}`];
  log.push(...skeleton.collectDrawItems().map((item) => `draw ${item}`));
  skeleton.setSlotsToSetupPose();
  log.push(`setup pose resets slot order=${skeleton.drawOrder.map((slot) => slot.name).join(" -> ")}`);
  log.push("source boundary: Spine slots refer to attachment names; Skin resolves slot/name pairs; drawOrder is runtime data and drives assembler traversal");
  return log;
}
