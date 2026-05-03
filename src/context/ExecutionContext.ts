/**
 * Shared execution context module.
 *
 * Extracted from index.ts to break the circular dependency between index.ts
 * and SearchOrchestrator.ts. Both modules import from here instead of from
 * each other, which guarantees that AsyncLocalStorage is fully initialised
 * before any consumer calls `.run()`.
 *
 * Circular dependency that was broken:
 *   index.ts → SearchOrchestrator.ts → index.ts (executionContext)
 *
 * New (acyclic) graph:
 *   index.ts                → ExecutionContext.ts
 *   SearchOrchestrator.ts   → ExecutionContext.ts
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import type { Account } from '../types/Account'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExecutionContext {
    isMobile: boolean
    account: Account
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * AsyncLocalStorage instance that carries per-request execution context
 * (mobile/desktop flag + current account) across the entire async call stack.
 * Created once at module load so it is always defined before any `.run()` call.
 */
export const executionContext = new AsyncLocalStorage<ExecutionContext>()

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the current execution context or a safe default when called outside
 * an active store (e.g., during startup).
 */
export function getCurrentContext(): ExecutionContext {
    return executionContext.getStore() ?? { isMobile: false, account: {} as Account }
}
