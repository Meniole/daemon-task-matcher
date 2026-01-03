import { Context } from "../types";
import { MatcherCommentParser } from "./matcher-comment-parser";
import { PullRequestBodyLinker } from "./pull-request-body-linker";

export class CheckboxSelectionHandler {
  constructor(private readonly _context: Context<"issue_comment.edited">) {}

  async run(): Promise<void> {
    const { logger, payload } = this._context;

    const issue = payload.issue;
    const isPullRequestComment = Boolean(issue?.pull_request);
    if (!isPullRequestComment) return;

    const body = payload.comment.body ?? "";

    const parser = new MatcherCommentParser();
    const parsed = parser.parseCheckedIssues(body);
    if (!parsed.markerFound) return;

    if (parsed.checked.length === 0) {
      logger.info("No checked suggestions detected.");
      return;
    }

    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const pullNumber = issue.number;

    const linker = new PullRequestBodyLinker(this._context);
    await linker.addClosingReferences(owner, repo, pullNumber, parsed.checked);

    logger.ok("Linked selected issue(s) to PR.", { owner, repo, pullNumber });
  }
}
