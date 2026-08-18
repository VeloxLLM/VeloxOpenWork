import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";

const sessionPagePath = fileURLToPath(
  new URL("../src/react-app/domains/session/chat/session-page.tsx", import.meta.url),
);

test("the session header does not expose Cloud sign-in", () => {
  const source = readFileSync(sessionPagePath, "utf8");

  expect(source).not.toContain("showCloudSignIn");
  expect(source).not.toContain("openCloudSignIn");
  expect(source).not.toContain("den.signin_button");
});
