type Contact = { group: number; mask: number; isTrigger: boolean };
type ContactEvent = 'collision-enter' | 'trigger-enter';
type Listener = (otherName: string, event: ContactEvent) => void;

class ColliderComponent {
    private readonly listeners: Listener[] = [];
    constructor(readonly name: string, readonly contact: Contact) {}
    onContact(listener: Listener): void { this.listeners.push(listener); }
    dispatch(otherName: string, event: ContactEvent): void {
        for (const listener of this.listeners) listener(otherName, event);
    }
}

function filtersPass(a: Contact, b: Contact): boolean {
    return (a.group & b.mask) !== 0 && (b.group & a.mask) !== 0;
}

class ContactBridge {
    report(a: ColliderComponent, b: ColliderComponent): string[] {
        if (!filtersPass(a.contact, b.contact)) return ['pair filtered by group/mask'];
        const event: ContactEvent = a.contact.isTrigger || b.contact.isTrigger ? 'trigger-enter' : 'collision-enter';
        const log: string[] = [];
        a.dispatch(b.name, event);
        b.dispatch(a.name, event);
        log.push(`backend contact -> ${event}`);
        return log;
    }
}

export function runLesson(): string[] {
    const log: string[] = [];
    const player = new ColliderComponent('Player', { group: 1, mask: 3, isTrigger: false });
    const sensor = new ColliderComponent('Sensor', { group: 2, mask: 1, isTrigger: true });
    player.onContact((other, event) => log.push(`Player received ${event} from ${other}`));
    sensor.onContact((other, event) => log.push(`Sensor received ${event} from ${other}`));
    const bridge = new ContactBridge();
    log.push(...bridge.report(player, sensor));
    return log;
}
