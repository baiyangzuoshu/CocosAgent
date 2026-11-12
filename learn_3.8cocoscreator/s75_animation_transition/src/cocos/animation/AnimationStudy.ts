export function runLesson (): string[] {
    const duration = 0.4; const elapsed = 0.2;
    const destinationWeight = Math.min(1, elapsed / duration);
    const sourceWeight = 1 - destinationWeight;
    return [`CrossFade: idle=${sourceWeight}`, `CrossFade: run=${destinationWeight}`, `transition complete = ${destinationWeight === 1}`];
}
