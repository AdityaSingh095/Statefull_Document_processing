/**
 * Cognitive Engine
 * Executes json-logic rules and computes confidence scores
 */

import { ProcessingContext, FieldConfidence, Invoice } from '../types/index.js';
import { executeRule } from '../core/logic/engine.js';
import { getCurrentTimestamp, daysBetween } from '../utils/date.js';

export class CognitiveEngine {
    /**
     * Apply vendor patterns and correction rules to invoice
     * Returns proposed field values with confidence scores
     */
    apply(context: ProcessingContext): Map<string, FieldConfidence> {
        const proposals = new Map<string, FieldConfidence>();
        const { invoice, vendorMemory, correctionMemories } = context;

        // Step 1: Apply vendor-specific patterns (highest priority)
        if (vendorMemory) {
            for (const [field, pattern] of Object.entries(vendorMemory.patterns)) {
                const result = executeRule(pattern.logic, invoice);

                if (result !== null && result !== undefined) {
                    // Calculate confidence from resolution memory
                    const patternId = `${vendorMemory.id}-${field}`;
                    const resolution = context.resolutionMemories.get(patternId);

                    const confidence = this.calculateConfidence(
                        pattern.confidence,
                        resolution,
                        pattern.lastUsed
                    );

                    proposals.set(field, {
                        field,
                        value: result,
                        confidence,
                        source: 'VENDOR_PATTERN',
                        ruleId: patternId,
                        reasoning: `Applied vendor pattern for "${vendorMemory.vendorName}"`,
                    });

                    context.auditTrail.push({
                        step: 'APPLY',
                        action: 'VENDOR_PATTERN',
                        field,
                        newValue: result,
                        reasoning: `Extracted using vendor pattern (confidence: ${confidence.toFixed(2)})`,
                        confidence,
                        timestamp: getCurrentTimestamp(),
                    });
                }
            }
        }

        // Step 2: Apply vendor defaults (if field not yet filled)
        if (vendorMemory?.defaults) {
            for (const [field, value] of Object.entries(vendorMemory.defaults)) {
                if (!proposals.has(field) && value) {
                    proposals.set(field, {
                        field,
                        value,
                        confidence: 0.90,
                        source: 'VENDOR_PATTERN',
                        reasoning: `Applied vendor default value`,
                    });

                    context.auditTrail.push({
                        step: 'APPLY',
                        action: 'VENDOR_DEFAULT',
                        field,
                        newValue: value,
                        reasoning: 'Applied vendor default value',
                        confidence: 0.90,
                        timestamp: getCurrentTimestamp(),
                    });
                }
            }
        }

        // Step 3: Apply correction rules (global patterns)
        for (const correction of correctionMemories) {
            // Test trigger condition
            const triggered = executeRule(correction.triggerCondition, invoice);

            if (triggered) {
                // Execute action to get field value
                const result = executeRule(correction.action, invoice);

                if (result !== null && result !== undefined) {
                    // Determine target field from action
                    const field = this.extractFieldFromAction(correction.action);

                    if (field) {
                        // Only apply if not already filled by vendor pattern
                        const existing = proposals.get(field);

                        if (!existing || existing.confidence < correction.confidence) {
                            const resolution = context.resolutionMemories.get(correction.id);
                            const confidence = this.calculateConfidence(
                                correction.confidence,
                                resolution,
                                correction.lastUsed
                            );

                            proposals.set(field, {
                                field,
                                value: result,
                                confidence,
                                source: 'CORRECTION_RULE',
                                ruleId: correction.id,
                                reasoning: correction.description,
                            });

                            context.auditTrail.push({
                                step: 'APPLY',
                                action: 'CORRECTION_RULE',
                                field,
                                newValue: result,
                                reasoning: correction.description,
                                confidence,
                                timestamp: getCurrentTimestamp(),
                            });
                        }
                    }
                }
            }
        }

        return proposals;
    }

    /**
     * Calculate dynamic confidence score using Laplace smoothing and decay
     */
    private calculateConfidence(
        baseConfidence: number,
        resolution: any,
        lastUsed?: string
    ): number {
        if (!resolution || resolution.totalApplications === 0) {
            return baseConfidence * 0.8; // Unproven rule
        }

        // Laplace smoothing: (accepted + 1) / (total + 2)
        const memoryConfidence =
            (resolution.acceptedCount + 1) / (resolution.totalApplications + 2);

        // Time decay factor
        let decayFactor = 1.0;
        if (lastUsed) {
            const daysSinceUse = daysBetween(lastUsed, getCurrentTimestamp());
            decayFactor = Math.pow(0.99, daysSinceUse); // 0.99 per day
        }

        // Weighted combination
        const alpha = 0.6; // Weight for base confidence
        const finalConfidence =
            alpha * baseConfidence + (1 - alpha) * memoryConfidence;

        return Math.max(0.1, finalConfidence * decayFactor);
    }

    /**
     * Extract target field from correction action
     */
    private extractFieldFromAction(action: any): string | null {
        // The action is a JsonLogic formula, we need to infer the target field
        // For now, we use common patterns
        const actionStr = JSON.stringify(action);

        if (actionStr.includes('taxAmount') || actionStr.includes('tax')) return 'taxAmount';
        if (actionStr.includes('netAmount') || actionStr.includes('net')) return 'netAmount';
        if (actionStr.includes('totalAmount') || actionStr.includes('total')) return 'totalAmount';

        return null;
    }
}
