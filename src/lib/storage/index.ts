import "server-only";
import { getEnv } from "@/lib/env";
import { LocalStorageProvider } from "./local";
import { S3StorageProvider } from "./s3";
import type { StorageProvider } from "./types";

let provider: StorageProvider | undefined;

export function getStorage(): StorageProvider {
  if (!provider) {
    const env = getEnv();
    provider = env.STORAGE_DRIVER === "s3" ? new S3StorageProvider() : new LocalStorageProvider();
  }
  return provider;
}

export function setStorage(next: StorageProvider | undefined): void {
  provider = next;
}

export { STORAGE_NAMESPACE, assertSafeKey, buildKey } from "./types";
export type { StorageProvider, StoredObject, LoadedObject } from "./types";
