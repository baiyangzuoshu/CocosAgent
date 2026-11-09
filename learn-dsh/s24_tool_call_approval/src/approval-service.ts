import type { ApprovalOutcome, ApprovalRequest } from "./types.ts";
import { SessionLog } from "./session-log.ts";

export type Answerer = (
  request: ApprovalRequest,
) => ApprovalOutcome | Promise<ApprovalOutcome>;

/** Makes one request, records its audit pair, and remembers no grant. */
export class ApprovalService {
  #nextId = 1;

  constructor(
    private readonly session: SessionLog,
    private readonly answerer?: Answerer,
  ) {}

  async request(request: ApprovalRequest): Promise<ApprovalOutcome> {
    const id = `approval-${this.#nextId++}`;
    this.session.appendApprovalAsked(id, request);

    let outcome: ApprovalOutcome;
    try {
      outcome = this.answerer === undefined
        ? "unavailable"
        : await this.answerer(request);
    } catch {
      outcome = "unavailable";
    }

    this.session.appendApprovalDecided(id, outcome);
    return outcome;
  }
}
