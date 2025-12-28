/**
 * Recall Engine
 * Responsible for contextual retrieval of vendor patterns and past resolutions
 */

import { MemoryStore } from '../core/memory/store.js';
import { Invoice, VendorMemory, ProcessingContext } from '../types/index.js';
import { fuzzyMatch } from '../utils/fuzzy.js';

export class RecallEngine {
    constructor(private store: MemoryStore) { }

    /**
     * Build processing context for an invoice
     * Retrieves relevant memories and patterns
     */
    async buildContext(invoice: Invoice): Promise<ProcessingContext> {
        const context: ProcessingContext = {
            invoice,
            correctionMemories: [],
            resolutionMemories: new Map(),
            auditTrail: [],
        };

        // Step 1: Fuzzy match vendor
        const vendorMemory = this.findVendorMemory(invoice.vendor);

        if (vendorMemory) {
            context.vendorMemory = vendorMemory;
            context.auditTrail.push({
                step: 'RECALL',
                action: 'VENDOR_MATCHED',
                reasoning: `Matched vendor "${invoice.vendor}" to existing memory "${vendorMemory.vendorName}"`,
                confidence: 0.95,
                timestamp: new Date().toISOString(),
            });

            // Load resolution memories for vendor patterns
            for (const field of Object.keys(vendorMemory.patterns)) {
                const patternId = `${vendorMemory.id}-${field}`;
                const resolution = this.store.getResolutionMemory(patternId);
                if (resolution) {
                    context.resolutionMemories.set(patternId, resolution);
                }
            }
        } else {
            context.auditTrail.push({
                step: 'RECALL',
                action: 'NEW_VENDOR',
                reasoning: `No existing memory found for vendor "${invoice.vendor}"`,
                confidence: 0.0,
                timestamp: new Date().toISOString(),
            });
        }

        // Step 2: Load applicable correction memories
        const allCorrections = this.store.getAllCorrectionMemories();
        context.correctionMemories = allCorrections;

        if (allCorrections.length > 0) {
            context.auditTrail.push({
                step: 'RECALL',
                action: 'CORRECTIONS_LOADED',
                reasoning: `Loaded ${allCorrections.length} global correction rule(s)`,
                timestamp: new Date().toISOString(),
            });
        }

        return context;
    }

    /**
     * Find vendor memory using fuzzy matching
     */
    private findVendorMemory(vendorName: string): VendorMemory | null {
        // Try exact match first
        const exact = this.store.findVendorByName(vendorName);
        if (exact) return exact;

        // Fuzzy match against all vendors
        const allVendors = this.store.getAllVendorMemories();

        if (allVendors.length === 0) return null;

        // Prepare searchable items (flatten fingerprints)
        const searchable = allVendors.map(v => ({
            memory: v,
            name: v.vendorName,
            fingerprints: v.fingerprints,
        }));

        const match = fuzzyMatch(
            vendorName,
            searchable,
            ['name', 'fingerprints'],
            0.4
        );

        return match ? match.item.memory : null;
    }

    /**
     * Get vendor memory by ID
     */
    getVendorMemory(id: string): VendorMemory | null {
        return this.store.getVendorMemory(id);
    }

    /**
     * Get all vendor memories
     */
    getAllVendorMemories(): VendorMemory[] {
        return this.store.getAllVendorMemories();
    }
}
