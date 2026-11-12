export function runLesson (): string[] {
    type Contact = { group: number; mask: number; trigger: boolean };
    class BoxCollider {
        constructor (readonly name: string, readonly contact: Contact) {}
        emit (event: string): string { return `${this.name}:${event}`; }
    }
    const player = new BoxCollider('Player', { group: 1, mask: 3, trigger: false });
    const sensor = new BoxCollider('Sensor', { group: 2, mask: 1, trigger: true });
    const accepted = (player.contact.group & sensor.contact.mask) !== 0
        && (sensor.contact.group & player.contact.mask) !== 0;
    if (!accepted) return ['pair filtered'];
    return [
        `pair accepted = ${accepted}`,
        player.emit(sensor.contact.trigger ? 'trigger-enter' : 'collision-enter'),
    ];
}
