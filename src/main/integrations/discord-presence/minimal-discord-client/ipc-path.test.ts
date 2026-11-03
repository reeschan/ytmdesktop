import { describe, expect, it } from "vitest";
import { getIPCBaseDir, getIPCPathCandidates } from "./ipc-path";

describe("getIPCPathCandidates", () => {
  it("returns a single named pipe on Windows", () => {
    expect(getIPCPathCandidates("win32", { TEMP: "C:\\Temp" }, 0)).toEqual(["\\\\?\\pipe\\discord-ipc-0"]);
  });

  it("returns the plain, flatpak and snap paths under XDG_RUNTIME_DIR in that order on Linux", () => {
    expect(getIPCPathCandidates("linux", { XDG_RUNTIME_DIR: "/run/user/1000", TMPDIR: "/var/tmp" }, 0)).toEqual([
      "/run/user/1000/discord-ipc-0",
      "/run/user/1000/app/com.discordapp.Discord/discord-ipc-0",
      "/run/user/1000/snap.discord/discord-ipc-0"
    ]);
  });

  it("uses /tmp when no environment variable is set", () => {
    expect(getIPCPathCandidates("linux", {}, 0)).toEqual([
      "/tmp/discord-ipc-0",
      "/tmp/app/com.discordapp.Discord/discord-ipc-0",
      "/tmp/snap.discord/discord-ipc-0"
    ]);
  });

  it("puts the pipe number into every path", () => {
    expect(getIPCPathCandidates("win32", {}, 7)).toEqual(["\\\\?\\pipe\\discord-ipc-7"]);
    for (const path of getIPCPathCandidates("darwin", { TMPDIR: "/var/folders/xy/T/" }, 9)) {
      expect(path.endsWith("/discord-ipc-9")).toBe(true);
    }
  });
});

describe("getIPCBaseDir", () => {
  it("takes the first non-empty variable in the order XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP", () => {
    expect(getIPCBaseDir({ TMPDIR: "/a", TMP: "/b", TEMP: "/c" })).toBe("/a");
    expect(getIPCBaseDir({ XDG_RUNTIME_DIR: "", TMP: "/b", TEMP: "/c" })).toBe("/b");
    expect(getIPCBaseDir({ TEMP: "/c" })).toBe("/c");
  });

  it("drops trailing slashes", () => {
    expect(getIPCBaseDir({ TMPDIR: "/var/folders/xy/T/" })).toBe("/var/folders/xy/T");
  });
});
