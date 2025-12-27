/**
 * JSON Patch Diff Utility
 * Wraps rfc6902 for computing differences between objects
 */

import { createPatch, applyPatch } from 'rfc6902';

export interface PatchOperation {
    op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
    path: string;
    value?: any;
    from?: string;
}

/**
 * Compute JSON Patch diff between two objects
 * @param original Original object
 * @param modified Modified object
 * @returns Array of patch operations
 */
export function computeDiff(original: any, modified: any): PatchOperation[] {
    return createPatch(original, modified) as PatchOperation[];
}

/**
 * Apply JSON Patch operations to an object
 * @param target Target object to modify
 * @param patch Array of patch operations
 * @returns Modified object
 */
export function applyDiff(target: any, patch: PatchOperation[]): any {
    const clone = JSON.parse(JSON.stringify(target));
    applyPatch(clone, patch);
    return clone;
}

/**
 * Extract field changes from patch operations
 * @param patch Array of patch operations
 * @returns Map of field path to new value
 */
export function extractChanges(patch: PatchOperation[]): Map<string, any> {
    const changes = new Map<string, any>();

    for (const op of patch) {
        if (op.op === 'replace' || op.op === 'add') {
            // Remove leading slash from path
            const field = op.path.substring(1);
            changes.set(field, op.value);
        }
    }

    return changes;
}

/**
 * Group patch operations by field
 * @param patch Array of patch operations
 * @returns Map of field to operations
 */
export function groupByField(patch: PatchOperation[]): Map<string, PatchOperation[]> {
    const grouped = new Map<string, PatchOperation[]>();

    for (const op of patch) {
        const field = op.path.split('/')[1]; // Get first level field
        if (!grouped.has(field)) {
            grouped.set(field, []);
        }
        grouped.get(field)!.push(op);
    }

    return grouped;
}
