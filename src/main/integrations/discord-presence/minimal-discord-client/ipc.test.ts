import { randomUUID } from "node:crypto";
import { createServer, Server, Socket } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import IPCClient, { decodeFrame, OPCode } from "./ipc";

function buildFrame(op: number, body: string, declaredLength?: number): Buffer {
  const length = Buffer.byteLength(body);
  const buffer = Buffer.alloc(8 + length);
  buffer.writeUInt32LE(op, 0);
  buffer.writeUInt32LE(declaredLength ?? length, 4);
  buffer.write(body, 8, length);
  return buffer;
}

function encodeFrame(op: OPCode, data: unknown) {
  return buildFrame(op, JSON.stringify(data));
}

function createIpcPath() {
  const name = `ytmd-ipc-test-${randomUUID()}`;
  return process.platform === "win32" ? `\\\\.\\pipe\\${name}` : path.join(tmpdir(), `${name}.sock`);
}

describe("decodeFrame", () => {
  it("reads the op and the json from a valid frame", () => {
    const frame = decodeFrame(buildFrame(OPCode.PING, JSON.stringify({ nonce: "abc" })));

    expect(frame).toEqual({ op: OPCode.PING, json: { nonce: "abc" } });
  });

  it("reads a body that has multi-byte characters", () => {
    const frame = decodeFrame(buildFrame(OPCode.FRAME, JSON.stringify({ title: "音楽" })));

    expect(frame).toEqual({ op: OPCode.FRAME, json: { title: "音楽" } });
  });

  it("returns null for a buffer shorter than the header", () => {
    expect(decodeFrame(Buffer.alloc(0))).toBeNull();
    expect(decodeFrame(Buffer.alloc(7))).toBeNull();
  });

  it("returns null when the body is shorter than the length in the header", () => {
    const body = JSON.stringify({ a: 1 });

    expect(decodeFrame(buildFrame(OPCode.FRAME, body, Buffer.byteLength(body) + 1))).toBeNull();
  });

  it("returns null when the body is not valid json", () => {
    expect(decodeFrame(buildFrame(OPCode.FRAME, "{not json"))).toBeNull();
  });
});

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
