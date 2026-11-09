export type TeamTaskStatus = "pending" | "in_progress" | "completed";

export interface TeamTaskSnapshot {
  readonly id: string;
  readonly revision: number;
  readonly subject: string;
  readonly description: string;
  readonly blockedBy: readonly string[];
  readonly status: TeamTaskStatus;
  readonly ownerId?: string;
}

export interface TeamTaskView extends TeamTaskSnapshot {
  readonly ready: boolean;
}

export interface TeamTaskEvent {
  readonly type: "team/task";
  readonly task: TeamTaskSnapshot;
}

export type TeamTaskAction =
  | { readonly kind: "claim" }
  | { readonly kind: "complete" };

export type TeamTaskErrorCode =
  | "TEAM_TASK_NOT_FOUND"
  | "TEAM_TASK_BLOCKED"
  | "TEAM_TASK_ALREADY_CLAIMED"
  | "TEAM_TASK_INVALID_TRANSITION"
  | "TEAM_TASK_UNAUTHORIZED"
  | "TEAM_TASK_STALE_REVISION";

export class TeamTaskError extends Error {
  constructor(
    readonly code: TeamTaskErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TeamTaskError";
  }
}
