import { describe, expect, test } from "bun:test";
import {
  boardChannelId,
  githubRepoUrl,
  resolveRepoUrl,
} from "./github-repo.js";

describe("boardChannelId", () => {
  test("uses parent for ticket threads", () => {
    expect(boardChannelId({ id: "t1", parentId: "board" })).toBe("board");
  });

  test("uses self for board channels", () => {
    expect(boardChannelId({ id: "board", parentId: null })).toBe("board");
  });
});

describe("githubRepoUrl", () => {
  test("builds https URL", () => {
    expect(githubRepoUrl("acme", "app")).toBe("https://github.com/acme/app");
  });
});

describe("resolveRepoUrl", () => {
  test("prefers linked repo over env", () => {
    const prev = process.env.CURSOR_REPO_URL;
    process.env.CURSOR_REPO_URL = "https://github.com/env/fallback";
    expect(
      resolveRepoUrl({
        github: { repoUrl: "https://github.com/linked/repo" },
      }),
    ).toBe("https://github.com/linked/repo");
    process.env.CURSOR_REPO_URL = prev;
  });

  test("falls back to env when no link", () => {
    const prev = process.env.CURSOR_REPO_URL;
    process.env.CURSOR_REPO_URL = "https://github.com/env/fallback";
    expect(resolveRepoUrl({ github: null })).toBe(
      "https://github.com/env/fallback",
    );
    process.env.CURSOR_REPO_URL = prev;
  });
});
