import { Buffer } from "buffer";

if (!(globalThis as unknown as { Buffer?: unknown }).Buffer) {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}
