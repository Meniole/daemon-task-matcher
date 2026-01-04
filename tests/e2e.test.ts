import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { customOctokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { http, HttpResponse } from "msw";
import manifest from "../manifest.json";
import { runPlugin } from "../src";
import type { Context } from "../src/types/index";
import { db } from "./__mocks__/db";
import { setupTests } from "./__mocks__/helpers";
import { server } from "./__mocks__/node";
import { STRINGS } from "./__mocks__/strings";

describe("e2e", () => {
  beforeAll(() => {
    server.listen();
  });

  beforeEach(async () => {
    drop(db);
    await setupTests();

    server.use(
      http.get("https://api.github.com/installation/repositories", () =>
        HttpResponse.json({
          total_count: 1,
          repositories: [
            {
              name: STRINGS.TEST_REPO,
              owner: { login: STRINGS.USER_1 },
            },
          ],
        })
      ),
      http.get("https://api.github.com/repos/:owner/:repo/pulls/:pull_number/files", ({ params }) =>
        HttpResponse.json([
          {
            filename: "src/example.ts",
            patch: `@@\n- old\n+ new\n// repo ${params.repo} pr ${params.pull_number}`,
          },
        ])
      ),
      http.get("https://api.github.com/repos/:owner/:repo/issues/:issue_number/comments", ({ params }) => {
        const issueNumber = Number(params.issue_number);
        const comments = db.issueComments.getAll().filter((c) => c.issue_number === issueNumber);
        return HttpResponse.json(comments);
      }),
      http.post("https://api.github.com/graphql", () =>
        HttpResponse.json({
          data: {
            repository: {
              pullRequest: {
                closingIssuesReferences: {
                  totalCount: 0,
                },
              },
            },
          },
        })
      ),
      http.post("https://ai.ubq.fi/v1/chat/completions", () =>
        HttpResponse.json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    {
                      owner: STRINGS.USER_1,
                      repo: STRINGS.TEST_REPO,
                      number: 1,
                      confidence: 0.9,
                      reason: "Matches mocked diff",
                    },
                  ],
                }),
              },
            },
          ],
        })
      )
    );
  });

  afterEach(() => {
    server.resetHandlers();
    jest.clearAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  it("serves manifest.json", async () => {
    const worker = (await import("../src/worker")).default;
    const response = await worker.fetch(new Request("http://localhost/manifest.json"), {} as never);
    expect(response.status).toBe(200);
    const content = await response.json();
    expect(content).toEqual(manifest);
  });

  it("runs matcher on pull_request.opened and posts suggestions", async () => {
    const context = createPullRequestContext();

    await runPlugin(context);

    const comments = db.issueComments.getAll();
    const suggestion = comments.find((c) => c.body.includes("<!-- daemon-task-matcher:suggestions -->"));
    expect(suggestion).toBeTruthy();
    expect(suggestion?.body).toContain("Task matcher suggestions");
    expect(suggestion?.body).toContain(`${STRINGS.USER_1}/${STRINGS.TEST_REPO}#1`);
  });
});

function createPullRequestContext(): Context {
  return {
    eventName: "pull_request.opened",
    payload: {
      action: "opened",
      repository: {
        name: STRINGS.TEST_REPO,
        owner: { login: STRINGS.USER_1 },
      },
      pull_request: {
        number: 1,
        title: "Test PR",
        body: "This PR changes something.",
      },
      installation: { id: 1 },
    },
    logger: new Logs("debug"),
    config: {
      confidenceThreshold: 0.5,
      maxSuggestions: 5,
      requirePriceLabel: true,
      priceLabelRegex: "^Price:\\s*\\d+(?:\\.\\d+)?\\s*[A-Za-z]{2,10}$",
      maxIssuesPerLlmCall: 40,
    },
    octokit: new customOctokit(),
    authToken: "token",
    command: null,
  } as unknown as Context;
}
