import { TeamJournal } from "./team-journal.ts";
import type {
  TeamTaskAction,
  TeamTaskSnapshot,
  TeamTaskView,
} from "./types.ts";
import { TeamTaskError } from "./types.ts";

/** One shared board belongs to one Lead root Session. */
export class TeamTaskBoard {
  readonly #members: ReadonlySet<string>;

  constructor(
    readonly journal: TeamJournal,
    members: readonly string[],
    private readonly leadId: string,
  ) {
    this.#members = new Set(members);
  }

  forAgent(agentId: string): TeamTaskClient {
    this.assertMember(agentId);
    return new TeamTaskClient(agentId, this);
  }

  async createTask(
    callerId: string,
    request: {
      readonly subject: string;
      readonly description: string;
      readonly blockedBy?: readonly string[];
    },
  ): Promise<TeamTaskView> {
    return this.journal.transact(() => {
      this.assertMember(callerId);
      const blockedBy = [...request.blockedBy ?? []];
      if (new Set(blockedBy).size !== blockedBy.length) {
        throw new Error("blockedBy contains duplicate task ids");
      }
      const knownTasks = this.journal.tasks();
      for (const blocker of blockedBy) {
        if (!knownTasks.some((task) => task.id === blocker)) {
          throw new TeamTaskError(
            "TEAM_TASK_NOT_FOUND",
            `blocked task "${blocker}" does not exist`,
          );
        }
      }

      const task: TeamTaskSnapshot = {
        id: this.journal.nextTaskId(),
        revision: 1,
        subject: request.subject,
        description: request.description,
        blockedBy,
        status: "pending",
      };
      this.journal.append(task);
      return this.toView(task);
    });
  }

  listTasks(callerId: string): TeamTaskView[] {
    this.assertMember(callerId);
    return this.journal.tasks().map((task) => this.toView(task));
  }

  getTask(callerId: string, taskId: string): TeamTaskView {
    this.assertMember(callerId);
    return this.toView(this.requireTask(taskId));
  }

  async updateTask(
    callerId: string,
    taskId: string,
    expectedRevision: number,
    action: TeamTaskAction,
  ): Promise<TeamTaskView> {
    return this.journal.transact(() => {
      this.assertMember(callerId);
      const current = this.requireTask(taskId);
      if (current.revision !== expectedRevision) {
        throw new TeamTaskError(
          "TEAM_TASK_STALE_REVISION",
          `expected revision ${expectedRevision}, current revision is ${current.revision}`,
        );
      }

      let next: TeamTaskSnapshot;
      if (action.kind === "claim") {
        if (current.ownerId !== undefined && current.ownerId !== callerId) {
          throw new TeamTaskError(
            "TEAM_TASK_ALREADY_CLAIMED",
            `${taskId} is already owned by ${current.ownerId}`,
          );
        }
        if (current.status !== "pending") {
          throw new TeamTaskError(
            "TEAM_TASK_INVALID_TRANSITION",
            `${taskId} is not pending`,
          );
        }
        if (!this.isReady(current)) {
          throw new TeamTaskError(
            "TEAM_TASK_BLOCKED",
            `${taskId} has unfinished blockers`,
          );
        }
        next = { ...current, status: "in_progress", ownerId: callerId };
      } else {
        if (current.status !== "in_progress") {
          throw new TeamTaskError(
            "TEAM_TASK_INVALID_TRANSITION",
            `${taskId} is not in progress`,
          );
        }
        if (callerId !== this.leadId && current.ownerId !== callerId) {
          throw new TeamTaskError(
            "TEAM_TASK_UNAUTHORIZED",
            `only the owner or Lead can complete ${taskId}`,
          );
        }
        next = { ...current, status: "completed" };
      }

      const updated: TeamTaskSnapshot = {
        ...next,
        revision: current.revision + 1,
      };
      this.journal.append(updated);
      return this.toView(updated);
    });
  }

  private isReady(task: TeamTaskSnapshot): boolean {
    return task.status === "pending" &&
      task.blockedBy.every((blockerId) =>
        this.journal.tasks().find((candidate) => candidate.id === blockerId)
          ?.status === "completed"
      );
  }

  private toView(task: TeamTaskSnapshot): TeamTaskView {
    return { ...structuredClone(task), ready: this.isReady(task) };
  }

  private requireTask(taskId: string): TeamTaskSnapshot {
    const task = this.journal.tasks().find((candidate) =>
      candidate.id === taskId
    );
    if (task === undefined) {
      throw new TeamTaskError("TEAM_TASK_NOT_FOUND", `unknown task ${taskId}`);
    }
    return task;
  }

  private assertMember(agentId: string): void {
    if (!this.#members.has(agentId)) {
      throw new TeamTaskError(
        "TEAM_TASK_UNAUTHORIZED",
        `${agentId} is not a member of this Team`,
      );
    }
  }
}

/** Each Agent's tool facade reaches the same root-owned board service. */
export class TeamTaskClient {
  constructor(
    readonly agentId: string,
    private readonly board: TeamTaskBoard,
  ) {}

  createTask(request: {
    readonly subject: string;
    readonly description: string;
    readonly blockedBy?: readonly string[];
  }): Promise<TeamTaskView> {
    return this.board.createTask(this.agentId, request);
  }

  listTasks(): TeamTaskView[] {
    return this.board.listTasks(this.agentId);
  }

  getTask(taskId: string): TeamTaskView {
    return this.board.getTask(this.agentId, taskId);
  }

  updateTask(
    taskId: string,
    expectedRevision: number,
    action: TeamTaskAction,
  ): Promise<TeamTaskView> {
    return this.board.updateTask(
      this.agentId,
      taskId,
      expectedRevision,
      action,
    );
  }
}
