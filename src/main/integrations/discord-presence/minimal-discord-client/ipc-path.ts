/** Environment variables that may name the base directory of the IPC sockets, in the order they are looked at. */
export const IPC_BASE_DIR_ENV_KEYS = ["XDG_RUNTIME_DIR", "TMPDIR", "TMP", "TEMP"] as const;
export type IPCBaseDirEnvKey = (typeof IPC_BASE_DIR_ENV_KEYS)[number];
export type IPCPathEnv = Partial<Record<IPCBaseDirEnvKey, string | undefined>>;

/** Base directory used when none of the environment variables is set. */
export const DEFAULT_IPC_BASE_DIR = "/tmp";

const WINDOWS_PLATFORM: NodeJS.Platform = "win32";

/** Sub-directories under the base directory, in the order they are tried (for example a sandboxed install keeps its socket in its own directory). */
const UNIX_SOCKET_SUB_DIRS = [
  "", // installed directly on the system
  "app/com.discordapp.Discord", // flatpak
  "snap.discord" // snap
] as const;

function ipcSocketName(id: number): string {
  return `discord-ipc-${id}`;
}

/** Returns the first non-empty value of the environment variables, without trailing slashes, or the default directory. */
export function getIPCBaseDir(env: IPCPathEnv): string {
  for (const key of IPC_BASE_DIR_ENV_KEYS) {
    const value = env[key];
    if (value) return value.replace(/\/+$/, "");
  }
  return DEFAULT_IPC_BASE_DIR;
}

/**
 * Returns the IPC paths to try for one pipe number, in the order they should be tried.
 * On Windows this is a single named pipe. Elsewhere it is one socket path per known install layout under the base directory.
 */
export function getIPCPathCandidates(platform: NodeJS.Platform, env: IPCPathEnv, id: number): string[] {
  if (platform === WINDOWS_PLATFORM) {
    return [`\\\\?\\pipe\\${ipcSocketName(id)}`];
  }

  const baseDir = getIPCBaseDir(env);
  return UNIX_SOCKET_SUB_DIRS.map(subDir =>
    subDir ? `${baseDir}/${subDir}/${ipcSocketName(id)}` : `${baseDir}/${ipcSocketName(id)}`
  );
}
