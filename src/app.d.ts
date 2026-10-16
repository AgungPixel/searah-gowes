import type { User } from '$lib/types';
declare global {
  namespace App {
    interface Locals { user: User | null; sessionHash: string | null }
    interface Platform {
      env: { DB: D1Database; AUTH_SECRET: string };
      context: { waitUntil(promise: Promise<unknown>): void };
    }
  }
}
export {};
