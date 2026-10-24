import { createHash } from 'node:crypto';

export function taskSetFingerprint(suite) {
  const taskSet = {
    baselineRef: suite.baselineRef,
    model: suite.model,
    reasoningEffort: suite.reasoningEffort,
    outputFile: suite.outputFile,
    skills: suite.skills.map(({ name, cases }) => ({
      name,
      cases: cases.map(({ id, title, purpose, userInput }) => ({ id, title, purpose, userInput })),
    })),
  };
  return createHash('sha256').update(JSON.stringify(taskSet)).digest('hex');
}
