/** Settings: secrets are encrypted at rest and readable through the pi-ai credential store. */
import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.TOMO_DATA_DIR ??= mkdtempSync(join(tmpdir(), "tomo-settings-"));

test("secrets, credentials, owners, pairing, auth", async () => {
  const { secrets, credentialStore, runtime, pairingCodes, auth, settings } = await import("../src/app/settings.ts");
  const { db } = await import("../src/app/db.ts");

  secrets.set("provider:google", "AIza-test-key-9876");
  const raw = (db.query("SELECT value FROM secrets WHERE key = 'provider:google'").get() as { value: string }).value;
  expect(raw).not.toContain("AIza");
  expect(await credentialStore.read("google")).toEqual({ type: "api_key", key: "AIza-test-key-9876" });
  expect(secrets.preview("provider:google")).toEqual({ set: true, last4: "9876" });

  settings.set("model", { provider: "google", modelId: "gemini-3.1-pro-preview" });
  expect(runtime.smallModel().provider).toBe("google"); // small follows main until chosen

  const { code } = pairingCodes.issue();
  expect(pairingCodes.redeem("000000")).toBe(false);
  expect(pairingCodes.redeem(code)).toBe(true);
  expect(pairingCodes.redeem(code)).toBe(false); // one-time
  runtime.addOwner("slack:U123");
  expect(runtime.owners()).toContain("slack:U123");

  await auth.setPassword("correct horse");
  expect(await auth.verify("wrong")).toBe(false);
  const t = auth.newSession();
  expect(auth.checkSession(t)).toBe(true);
  auth.endSession(t);
  expect(auth.checkSession(t)).toBe(false);

  settings.delete("model");
  secrets.delete("provider:google");
});
