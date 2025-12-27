/**
 * Main Agent Class
 * Orchestrates the Think-Act-Learn cognitive loop
 */

import { MemoryStore } from '../core/memory/store.js';
import { RecallEngine } from './recall-engine.js';
import { CognitiveEngine } from './cognitive-engine.js';
import { DecisionEngine } from './decision-engine.js';
import { induceRules } from '../core/logic/induction.js';
import {
    Invoice,
    OutputContract,
    VendorMemory,
    OutputContractSchema,
    InvoiceSchema
} from '../types/index.js';
import { getCurrentTimestamp } from '../utils/date.js';
import { generateFingerprints } from '../utils/fuzzy.js';
import crypto from 'crypto';

/**
 * Intelligent Document Processing Agent
 * Implements Case-Based Reasoning with Learned Memory
 */
export class Agent {
    private store: MemoryStore;
    private recallEngine: RecallEngine;
    private cognitiveEngine: CognitiveEngine;
    private decisionEngine: DecisionEngine;

    constructor(dbPath?: string) {
        this.store = new MemoryStore(dbPath);
        this.recallEngine = new RecallEngine(this.store);
        this.cognitiveEngine = new CognitiveEngine();
        this.decisionEngine = new DecisionEngine(this.store);
    }

    /**
     * Initialize the agent (ensures database is ready)
     */
    async initialize(): Promise<void> {
        // Database is initialized in MemoryStore constructor
        console.log('Agent initialized successfully');
    }

    /**
     * Process an invoice through the Think-Act-Learn loop
     * THINK: Recall relevant memories
     * ACT: Apply rules and make decisions
     * @param invoice Input invoice
     * @returns Output contract with decision
     */
    async process(invoice: Invoice): Promise<OutputContract> {
        // Validate input
        const validatedInvoice = InvoiceSchema.parse(invoice);

        // THINK: Recall - Build context
        const context = await this.recallEngine.buildContext(validatedInvoice);

        context.auditTrail.push({
            step: 'START',
            action: 'PROCESSING_STARTED',
            reasoning: `Processing invoice ${invoice.id} from ${invoice.vendor}`,
            timestamp: getCurrentTimestamp(),
        });

        // ACT: Apply - Execute rules
        const proposals = this.cognitiveEngine.apply(context);

        // DECIDE: Make final decision
        const output = this.decisionEngine.decide(context, proposals);

        // Validate output contract
        const validatedOutput = OutputContractSchema.parse(output);

        return validatedOutput;
    }

    /**
     * Learn from human correction
     * LEARN: Induce new rules from the diff between system output and correction
     * @param systemOutput Original system output
     * @param humanCorrection Human-corrected invoice
     */
    async learn(systemOutput: Invoice, humanCorrection: Invoice): Promise<void> {
        console.log(`\nLearning from correction for invoice ${humanCorrection.id}...`);

        // Induce rules from the diff
        const induction = induceRules(systemOutput, humanCorrection);

        console.log(`- Generated ${induction.vendorRules.length} vendor rule(s)`);
        console.log(`- Generated ${induction.correctionRules.length} correction rule(s)`);

        // Get or create vendor memory
        let vendorMemory = this.recallEngine.findVendorMemory(humanCorrection.vendor);

        if (!vendorMemory) {
            // Create new vendor memory
            vendorMemory = {
                id: this.generateId(),
                vendorName: humanCorrection.vendor,
                fingerprints: generateFingerprints(humanCorrection.vendor),
                defaults: {},
                patterns: {},
                createdAt: getCurrentTimestamp(),
                updatedAt: getCurrentTimestamp(),
            };

            console.log(`- Created new vendor memory for "${humanCorrection.vendor}"`);
        }

        // Add vendor rules to memory
        for (const { field, pattern } of induction.vendorRules) {
            vendorMemory.patterns[field] = pattern;
            vendorMemory.updatedAt = getCurrentTimestamp();

            console.log(`  • Learned pattern for field: ${field}`);
        }

        // Save vendor memory
        if (induction.vendorRules.length > 0) {
            this.store.saveVendorMemory(vendorMemory);
        }

        // Save correction rules
        for (const correctionRule of induction.correctionRules) {
            this.store.saveCorrectionMemory(correctionRule);
            console.log(`  • Learned correction rule: ${correctionRule.description}`);
        }

        console.log('Learning complete!\n');
    }

    /**
     * Get vendor memory by name (for inspection)
     */
    getVendorMemory(vendorName: string): VendorMemory | null {
        return this.store.findVendorByName(vendorName);
    }

    /**
     * Get all vendor memories
     */
    getAllVendorMemories(): VendorMemory[] {
        return this.store.getAllVendorMemories();
    }

    /**
     * Close the agent (cleanup)
     */
    close(): void {
        this.store.close();
    }

    /**
     * Helper to find vendor memory (expose recall engine method)
     */
    private findVendorMemory(vendorName: string): VendorMemory | null {
        const allVendors = this.store.getAllVendorMemories();

        // Try exact match
        const exact = allVendors.find(v => v.vendorName === vendorName);
        if (exact) return exact;

        // Try fuzzy match via recall engine
        return this.recallEngine.getAllVendorMemories().find(v =>
            v.vendorName.toLowerCase() === vendorName.toLowerCase()
        ) || null;
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return crypto.randomBytes(16).toString('hex');
    }
}
