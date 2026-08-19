import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { findAvailablePort } from "../scripts/smoke-port.mjs";

const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

function listenEphemeral() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      servers.push(server);
      resolve(server.address().port);
    });
  });
}

describe("smoke test port selection", () => {
  it("uses the preferred port when it is available", async () => {
    const port = await findAvailablePort(0);
    expect(port).toBeGreaterThan(0);
  });

  it("falls back when the preferred port is already occupied", async () => {
    const occupied = await listenEphemeral();
    const selected = await findAvailablePort(occupied);
    expect(selected).toBeGreaterThan(0);
    expect(selected).not.toBe(occupied);
  });
});
