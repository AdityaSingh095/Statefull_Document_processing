/**
 * Decision Engine
 * Manages confidence thresholds, conflict resolution, and escalation logic
 */

import { MemoryStore } from '../core/memory/store.js';
import { ProcessingContext, FieldConfidence, OutputContract, Invoice } from '../types/index.js';
import { getCurrentTimestamp } from '../utils/date.js';

export class DecisionEngine {
    constructor(private store: MemoryStore) { }

    /**
     * Make final decision on invoice processing
     * Determines if human review is required
     */
    decide(
        context: ProcessingContext,
        proposals: Map<string, FieldConfidence>
    ): OutputContract {
        const { invoice } = context;

        // Build output object
        const output: any = {
            invoiceId: invoice.id,
            vendor: invoice.vendor,
            invoiceNumber: invoice.invoiceNumber,
        };

        // Apply proposals
        const confidences: number[] = [];

        for (const [field, proposal] of proposals.entries()) {
            output[field] = proposal.value;
            confidences.push(proposal.confidence);
        }

        // Fill remaining fields from original invoice
        const fields = [
            'date', 'serviceDate', 'dueDate', 'totalAmount', 'taxAmount',
            'netAmount', 'currency', 'lineItems', 'paymentTerms', 'poNumber'
        ];

        for (const field of fields) {
            if (!(field in output) && (invoice as any)[field] !== undefined) {
                output[field] = (invoice as any)[field];

                // Mark as OCR with lower confidence if empty
                if ((invoice as any)[field] === null || (invoice as any)[field] === undefined) {
                    confidences.push(0.0);
                } else {
                    confidences.push(0.70); // OCR baseline
                }
            }
        }

        // Calculate overall confidence
        const overallConfidence = confidences.length > 0
            ? confidences.reduce((a, b) => a + b, 0) / confidences.length
            : 0.0;

        // Check for duplicate
        const fingerprint = this.store.generateInvoiceFingerprint(
            invoice.vendor,
            invoice.invoiceNumber,
            invoice.date,
            invoice.totalAmount
        );

        const isDuplicate = this.store.isDuplicate(fingerprint);

        // Determine if human review is required
        const reviewDecision = this.shouldEscalate(
            context,
            output,
            overallConfidence,
            proposals,
            isDuplicate
        );

        // Build output contract
        const contract: OutputContract = {
            ...output,
            requiresHumanReview: reviewDecision.required,
            reasoning: reviewDecision.reasoning,
            confidence: overallConfidence,
            auditTrail: context.auditTrail,
            processedAt: getCurrentTimestamp(),
        };

        // Record processing
        if (!isDuplicate) {
            this.store.recordProcessedInvoice(
                fingerprint,
                invoice.id,
                invoice.vendor,
                invoice.invoiceNumber,
                invoice.totalAmount
            );
        }

        // Add final decision to audit trail
        contract.auditTrail.push({
            step: 'DECIDE',
            action: reviewDecision.required ? 'ESCALATE' : 'AUTO_APPROVE',
            reasoning: reviewDecision.reasoning,
            confidence: overallConfidence,
            timestamp: getCurrentTimestamp(),
        });

        return contract;
    }

    /**
     * Determine if invoice should be escalated for human review
     */
    private shouldEscalate(
        context: ProcessingContext,
        output: any,
        overallConfidence: number,
        proposals: Map<string, FieldConfidence>,
        isDuplicate: boolean
    ): { required: boolean; reasoning: string } {
        // Rule 1: Duplicate detection
        if (isDuplicate) {
            return {
                required: true,
                reasoning: 'Duplicate invoice detected: matches fingerprint of previously processed invoice',
            };
        }

        // Rule 2: New vendor (cold start)
        if (!context.vendorMemory) {
            return {
                required: true,
                reasoning: 'New vendor: no existing memory found, requires initial human review',
            };
        }

        // Rule 3: Critical fields missing or low confidence
        const criticalFields = ['totalAmount', 'date', 'vendor'];
        for (const field of criticalFields) {
            const proposal = proposals.get(field);
            const value = output[field];

            if (!value || (proposal && proposal.confidence < 0.90)) {
                return {
                    required: true,
                    reasoning: `Critical field "${field}" is missing or has low confidence`,
                };
            }
        }

        // Rule 4: Global confidence threshold
        if (overallConfidence < 0.80) {
            return {
                required: true,
                reasoning: `Overall confidence (${overallConfidence.toFixed(2)}) below threshold (0.80)`,
            };
        }

        // Rule 5: Anomaly detection (total != sum of line items)
        if (output.lineItems && output.lineItems.length > 0 && output.totalAmount) {
            const lineItemSum = output.lineItems.reduce(
                (sum: number, item: any) => sum + (item.amount || 0),
                0
            );

            const diff = Math.abs(output.totalAmount - lineItemSum);
            if (diff > 0.01 && lineItemSum > 0) {
                return {
                    required: true,
                    reasoning: `Total amount mismatch: invoice total (${output.totalAmount}) differs from line item sum (${lineItemSum})`,
                };
            }
        }

        // All checks passed
        return {
            required: false,
            reasoning: `High confidence automation: overall score ${overallConfidence.toFixed(2)}`,
        };
    }

    /**
     * Record resolution outcomes for reinforcement learning
     */
    recordResolutions(
        proposals: Map<string, FieldConfidence>,
        humanCorrection: Invoice,
        outcome: 'ACCEPTED' | 'REJECTED'
    ): void {
        for (const [field, proposal] of proposals.entries()) {
            if (proposal.ruleId) {
                const humanValue = (humanCorrection as any)[field];
                const systemValue = proposal.value;

                // Determine if this specific field was accepted or rejected
                const fieldOutcome = (humanValue === systemValue || humanValue === undefined)
                    ? 'ACCEPTED'
                    : 'REJECTED';

                this.store.recordResolution(
                    proposal.ruleId,
                    humanCorrection.id,
                    fieldOutcome
                );
            }
        }
    }
}
