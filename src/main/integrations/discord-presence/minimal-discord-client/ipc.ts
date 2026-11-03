import EventEmitter from "events";
import { Socket } from "net";

export enum OPCode {
  HANDSHAKE = 0,
  FRAME = 1,
  CLOSE = 2,
  PING = 3,
  PONG = 4
}

const FRAME_HEADER_SIZE = 8;

export interface DecodedFrame {
  op: number;
  json: unknown;
}

/**
 * Reads one frame (a uint32 LE op code, a uint32 LE body length, then a JSON body) from a buffer.
 * Returns null when the buffer is shorter than the header, shorter than the length the header announces, or the body is not valid JSON.
 */
export function decodeFrame(buffer: Buffer): DecodedFrame | null {
  if (buffer.length < FRAME_HEADER_SIZE) return null;

  const op = buffer.readUInt32LE(0);
  const length = buffer.readUInt32LE(4);
  if (buffer.length < FRAME_HEADER_SIZE + length) return null;

  try {
    const json: unknown = JSON.parse(buffer.toString("utf-8", FRAME_HEADER_SIZE, FRAME_HEADER_SIZE + length));
    return { op, json };
  } catch {
    return null;
  }
}

export default class IPCClient extends EventEmitter {
  private socket!: Socket;

  constructor() {
    super();

    this.createSocket();
  }

  private createSocket() {
    this.socket = new Socket();
    this.socket.on("connect", () => {
      this.emit("connect");
    });
    this.socket.on("close", (hadError: boolean) => {
      this.emit("close", hadError);
    });
    this.socket.on("error", error => {
      this.emit("error", error);
    });
    this.socket.on("data", (buffer: Buffer) => {
      const frame = decodeFrame(buffer);
      if (frame) {
        this.emit("data", frame.op, frame.json);
      }
    });
  }

  public connect(ipcPath: string) {
    if (this.socket.destroyed) {
      this.createSocket();
    }
    this.socket.connect(ipcPath);
  }

  public send(data: unknown, op = OPCode.FRAME) {
    const json = JSON.stringify(data);
    const length = Buffer.byteLength(json);
    const buffer = Buffer.alloc(8 + length);
    buffer.writeInt32LE(op, 0);
    buffer.writeInt32LE(length, 4);
    buffer.write(json, 8, length);

    if (!this.socket.closed && this.socket.writable) {
      this.socket.write(buffer);
    } else {
      this.socket.end();
      this.createSocket();
    }
  }

  public close() {
    if (!this.socket.closed) {
      this.send({}, OPCode.CLOSE);
      this.socket.end();
    }
  }

  public destroy() {
    this.removeAllListeners();
    this.socket.destroy();
  }
}
