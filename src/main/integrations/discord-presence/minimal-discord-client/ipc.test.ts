import { describe, expect, it } from "vitest";
import { decodeFrame, OPCode } from "./ipc";

function buildFrame(op: number, body: string, declaredLength?: number): Buffer {
  const length = Buffer.byteLength(body);
  const buffer = Buffer.alloc(8 + length);
  buffer.writeUInt32LE(op, 0);
  buffer.writeUInt32LE(declaredLength ?? length, 4);
  buffer.write(body, 8, length);
  return buffer;
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
