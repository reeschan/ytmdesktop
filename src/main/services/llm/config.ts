// Reads the LLM provider, model and API key from the settings. Loaded at startup, so it never imports the AI SDK
// (the calls themselves are in transport.ts, which is loaded lazily and must not be imported from here as a value).
import { safeStorage } from "electron";
import log from "electron-log";
import { GROOVING_DEFAULT_MODELS, GroovingProvider } from "~shared/grooving";
import type { MemoryStoreSchema } from "~shared/store/schema";
import type ConfigStore from "../configstore";
import type MemoryStore from "../memorystore";

export type LlmConfig = { provider: GroovingProvider; apiKey: string; model: string };

export function readLlmProvider(configStore: ConfigStore): GroovingProvider {
  const provider = configStore.get("integrations.groovingProvider");
  return Object.values(GroovingProvider).find(value => value === provider) ?? GroovingProvider.Gemini;
}

export function readLlmModel(configStore: ConfigStore, provider: GroovingProvider): string {
  const model = configStore.get("integrations.groovingModels")?.[provider];
  return typeof model === "string" && model.trim() !== "" ? model.trim() : GROOVING_DEFAULT_MODELS[provider];
}

function readEncryptedKey(configStore: ConfigStore, provider: GroovingProvider): string | null {
  const encrypted = configStore.get("integrations.groovingApiKeys")?.[provider];
  return typeof encrypted === "string" && encrypted !== "" ? encrypted : null;
}

export function safeStorageAvailable(memoryStore: MemoryStore<MemoryStoreSchema>): boolean {
  return memoryStore.get("safeStorageAvailable") === true;
}

export function hasLlmKey(configStore: ConfigStore, memoryStore: MemoryStore<MemoryStoreSchema>): boolean {
  return safeStorageAvailable(memoryStore) && readEncryptedKey(configStore, readLlmProvider(configStore)) !== null;
}

/**
 * Decrypts the key just before an LLM call. The plain key lives only in the returned config of that call
 */
export async function readLlmConfig(configStore: ConfigStore, memoryStore: MemoryStore<MemoryStoreSchema>): Promise<LlmConfig | null> {
  const provider = readLlmProvider(configStore);
  const encrypted = readEncryptedKey(configStore, provider);
  if (encrypted === null || !safeStorageAvailable(memoryStore)) return null;

  try {
    const apiKey = (await safeStorage.decryptStringAsync(Buffer.from(encrypted, "hex"))).result;
    return apiKey === "" ? null : { provider, apiKey, model: readLlmModel(configStore, provider) };
  } catch {
    // The error is not logged
    log.error("Could not decrypt the LLM API key");
    return null;
  }
}
