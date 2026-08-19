import net from "node:net";

function canListen(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    const finish = (available) => {
      server.removeAllListeners();
      if (server.listening) {
        server.close(() => resolve(available));
      } else {
        resolve(available);
      }
    };

    server.once("error", () => finish(false));
    server.listen(port, host, () => finish(true));
  });
}

function reserveEphemeralPort(host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const port = server.address()?.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

/**
 * Return the preferred smoke-test port when it is free, otherwise ask the OS
 * for an ephemeral port. This keeps parallel local smoke runs independent.
 */
export async function findAvailablePort(preferredPort = 5176, host = "127.0.0.1") {
  const preferred = Number(preferredPort);
  if (Number.isInteger(preferred) && preferred > 0 && preferred < 65536) {
    if (await canListen(preferred, host)) return preferred;
  }
  return reserveEphemeralPort(host);
}
