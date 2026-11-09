import { TeamJournal } from "./team-journal.ts";
import { TeamTaskBoard } from "./task-board.ts";
import { TeamTaskError } from "./types.ts";

const journal = new TeamJournal("lead-session");
const board = new TeamTaskBoard(
  journal,
  ["lead", "reviewer", "writer"],
  "lead",
);
const lead = board.forAgent("lead");
const reviewer = board.forAgent("reviewer");
const writer = board.forAgent("writer");

const reviewApi = await lead.createTask({
  subject: "Review API changes",
  description: "Check the public API diff and report compatibility issues.",
});
const updateGuide = await lead.createTask({
  subject: "Update migration guide",
  description: "Document the API changes after the review is complete.",
  blockedBy: [reviewApi.id],
});

console.log("reviewer 看到的任务板：", reviewer.listTasks());
console.log("writer 看到的同一任务板：", writer.listTasks());

const blockedAttempt = await writer.updateTask(
  updateGuide.id,
  updateGuide.revision,
  { kind: "claim" },
).then(
  () => "unexpected success",
  errorCode,
);
console.log("阻塞任务提前认领：", blockedAttempt);

const claimAttempts = await Promise.allSettled([
  reviewer.updateTask(reviewApi.id, reviewApi.revision, { kind: "claim" }),
  writer.updateTask(reviewApi.id, reviewApi.revision, { kind: "claim" }),
]);
console.log(
  "两个成员用同一 revision 认领：",
  claimAttempts.map((attempt, index) =>
    attempt.status === "fulfilled"
      ? `${
        ["reviewer", "writer"][index]
      } claimed revision ${attempt.value.revision}`
      : `${["reviewer", "writer"][index]} rejected: ${
        errorCode(attempt.reason)
      }`
  ),
);

const claimedReview = reviewer.getTask(reviewApi.id);
await reviewer.updateTask(
  reviewApi.id,
  claimedReview.revision,
  { kind: "complete" },
);
const readyGuide = writer.getTask(updateGuide.id);
console.log("review 完成后，迁移文档任务 ready：", readyGuide.ready);
const claimedGuide = await writer.updateTask(
  updateGuide.id,
  readyGuide.revision,
  { kind: "claim" },
);
await writer.updateTask(
  updateGuide.id,
  claimedGuide.revision,
  { kind: "complete" },
);

console.log("Lead 最终任务板：", lead.listTasks());
console.log("Lead Session 的 team/task 事件：", journal.snapshotEvents());

function errorCode(error: unknown): string {
  return error instanceof TeamTaskError ? error.code : String(error);
}
