/**
 * Fuzzy String Matching Utility
 * Wraps Fuse.js for vendor name matching
 */

import Fuse from 'fuse.js';

export interface FuzzyMatch<T> {
    item: T;
    score: number;
    refIndex: number;
}

/**
 * Fuzzy search configuration
 */
const FUZZY_CONFIG = {
    threshold: 0.4, // Maximum score (0=perfect, 1=no match)
    distance: 100,
    minMatchCharLength: 3,
    keys: ['name', 'fingerprints'],
};

/**
 * Create a fuzzy matcher for vendor names
 * @param items Array of objects to search
 * @param keys Keys to search in
 * @param threshold Match threshold (0-1, lower is stricter)
 * @returns Fuse instance
 */
export function createFuzzyMatcher<T>(
    items: T[],
    keys?: string[],
    threshold: number = 0.4
): Fuse<T> {
    const config = {
        ...FUZZY_CONFIG,
        threshold,
        keys: keys || FUZZY_CONFIG.keys,
    };

    return new Fuse(items, config);
}

/**
 * Find best fuzzy match for a query string
 * @param query Search query
 * @param items Array of objects to search
 * @param keys Keys to search in
 * @param threshold Match threshold
 * @returns Best match or null
 */
export function fuzzyMatch<T>(
    query: string,
    items: T[],
    keys?: string[],
    threshold: number = 0.4
): FuzzyMatch<T> | null {
    const fuse = createFuzzyMatcher(items, keys, threshold);
    const results = fuse.search(query);

    if (results.length === 0) {
        return null;
    }

    const best = results[0];
    return {
        item: best.item,
        score: best.score || 0,
        refIndex: best.refIndex,
    };
}

/**
 * Find all fuzzy matches above threshold
 * @param query Search query
 * @param items Array of objects to search
 * @param keys Keys to search in
 * @param threshold Match threshold
 * @param limit Maximum results
 * @returns Array of matches
 */
export function fuzzyMatchAll<T>(
    query: string,
    items: T[],
    keys?: string[],
    threshold: number = 0.4,
    limit: number = 5
): FuzzyMatch<T>[] {
    const fuse = createFuzzyMatcher(items, keys, threshold);
    const results = fuse.search(query, { limit });

    return results.map(r => ({
        item: r.item,
        score: r.score || 0,
        refIndex: r.refIndex,
    }));
}

/**
 * Normalize vendor name for matching
 * @param name Vendor name
 * @returns Normalized name
 */
export function normalizeVendorName(name: string): string {
    return name
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
        .trim();
}

/**
 * Generate vendor fingerprints (variations)
 * @param name Original vendor name
 * @returns Array of fingerprint variations
 */
export function generateFingerprints(name: string): string[] {
    const normalized = normalizeVendorName(name);
    const fingerprints = [name, normalized];

    // Add variations without common suffixes
    const suffixes = ['gmbh', 'ltd', 'inc', 'llc', 'ag', 'co'];
    for (const suffix of suffixes) {
        const pattern = new RegExp(`\\s*${suffix}\\s*$`, 'i');
        if (pattern.test(normalized)) {
            fingerprints.push(normalized.replace(pattern, '').trim());
        }
    }

    return [...new Set(fingerprints)]; // Remove duplicates
}
