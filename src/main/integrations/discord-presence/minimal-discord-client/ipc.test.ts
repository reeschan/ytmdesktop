import { randomUUID } from "node:crypto";
import { createServer, Server, Socket } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import IPCClient, { OPCode } from "./ipc";

function createIpcPath() {
  const name = `ytmd-ipc-test-${randomUUID()}`;
  return process.platform === "win32" ? `\\\\.\\pipe\\${name}` : path.join(tmpdir(), `${name}.sock`);
}

function encodeFrame(op: OPCode, data: unknown) {
  const json = JSON.stringify(data);
  const length = Buffer.byteLength(json);
  const buffer = Buffer.alloc(8 + length);
  buffer.writeInt32LE(op, 0);
  buffer.writeInt32LE(length, 4);
  buffer.write(json, 8, length);
  return buffer;
}

function decodeFrame(buffer: Buffer) {
  const op = buffer.readInt32LE(0);
  const length = buffer.readInt32LE(4);
  return { op, json: JSON.parse(buffer.toString("utf-8", 8, 8 + length)) };
}

describe("IPCClient", () => {
  let server: Server | null = null;
  let client: IPCClient | null = null;

  afterEach(async () => {
    client?.destroy();
    client = null;
    await new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve()));
    server = null;
  });

  async function connect(onServerSocket: (socket: Socket) => void) {
    const ipcPath = createIpcPath();
    server = createServer(onServerSocket);
    await new Promise<void>(resolve => server!.listen(ipcPath, resolve));

    client = new IPCClient();
    await new Promise<void>(resolve => {
      client!.once("connect", resolve);
      client!.connect(ipcPath);
    });
    return client;
  }

  it("emits the op code and the payload as separate arguments", async () => {
    const connected = await connect(socket => socket.write(encodeFrame(OPCode.PING, { nonce: "abc" })));

    const [op, json] = await new Promise<unknown[]>(resolve => connected.once("data", (...args: unknown[]) => resolve(args)));

    expect(op).toBe(OPCode.PING);
    expect(json).toEqual({ nonce: "abc" });
  });

  it("can answer a PING with a PONG carrying the same payload", async () => {
    let resolveServerSocket: (socket: Socket) => void;
    const serverSocket = new Promise<Socket>(resolve => (resolveServerSocket = resolve));
    const connected = await connect(socket => resolveServerSocket(socket));
    connected.on("data", (op: OPCode, json: unknown) => {
      if (op === OPCode.PING) connected.send(json, OPCode.PONG);
    });

    const socket = await serverSocket;
    const reply = new Promise<ReturnType<typeof decodeFrame>>(resolve => socket.once("data", (buffer: Buffer) => resolve(decodeFrame(buffer))));
    socket.write(encodeFrame(OPCode.PING, { nonce: "abc" }));

    expect(await reply).toEqual({ op: OPCode.PONG, json: { nonce: "abc" } });
  });
});
