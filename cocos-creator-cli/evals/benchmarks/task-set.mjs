import { createHash } from 'node:crypto';

export function taskExecutionFingerprint(suite) {
  const execution = {
    schemaVersion: suite.schemaVersion,
    baselineRef: suite.baselineRef,
    model: suite.model,
    reasoningEffort: suite.reasoningEffort,
    outputFile: suite.outputFile,
    baselineSkills: suite.baselineSkills,
    deepSkills: suite.deepSkills,
    realCreatorSkills: suite.realCreatorSkills,
    skills: suite.skills.map(({ name, cases }) => ({
      name,
      cases: cases.map(({ id, title, purpose, userInput, successChecklist }) => ({
        id, title, purpose, userInput, successChecklist,
      })),
    })),
  };
  return createHash('sha256').update(JSON.stringify(execution)).digest('hex');
}

export function taskSetFingerprint(suite) {
  const taskSet = {
    schemaVersion: suite.schemaVersion,
    baselineRef: suite.baselineRef,
    model: suite.model,
    reasoningEffort: suite.reasoningEffort,
    outputFile: suite.outputFile,
    baselineSkills: suite.baselineSkills,
    deepSkills: suite.deepSkills,
    realCreatorSkills: suite.realCreatorSkills,
    skills: suite.skills.map(({ name, cases }) => ({
      name,
      cases: cases.map(({ id, title, purpose, userInput, successChecklist, expected }) => ({
        id, title, purpose, userInput, successChecklist, expected,
      })),
    })),
  };
  return createHash('sha256').update(JSON.stringify(taskSet)).digest('hex');
}
