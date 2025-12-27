/**
 * Core Type Definitions for AI Document Automation Memory Layer
 * Implements the memory ontology from the architectural blueprint
 */

import { z } from 'zod';

// ============================================================================
// JSON Logic Types
// ============================================================================

export type JsonLogicRule = Record<string, any>;

// ============================================================================
// Invoice and Line Item Schemas
// ============================================================================

export const LineItemSchema = z.object({
    description: z.string(),
    quantity: z.number().optional(),
    unitPrice: z.number().optional(),
    amount: z.number().optional(),
    sku: z.string().optional(),
    taxRate: z.number().optional(),
});

export const InvoiceSchema = z.object({
    id: z.string(),
    vendor: z.string(),
    invoiceNumber: z.string(),
    date: z.string().optional(),
    serviceDate: z.string().optional(),
    dueDate: z.string().optional(),
    currency: z.string().optional(),
    netAmount: z.number().optional(),
    taxAmount: z.number().optional(),
    totalAmount: z.number().optional(),
    lineItems: z.array(LineItemSchema).optional(),
    paymentTerms: z.string().optional(),
    poNumber: z.string().optional(),
    rawText: z.string(),
});

export type Invoice = z.infer<typeof InvoiceSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;

// ============================================================================
// Vendor Memory Schema (Contextual Knowledge)
// ============================================================================

export const VendorPatternSchema = z.object({
    ruleType: z.enum(['REGEX', 'ANCHOR', 'POSITIONAL', 'FORMULA', 'MAP']),
    logic: z.record(z.any()), // JsonLogicRule
    confidence: z.number().min(0).max(1),
    sampleEvidence: z.string().optional(),
    createdAt: z.string(),
    lastUsed: z.string().optional(),
});

export const VendorMemorySchema = z.object({
    id: z.string(),
    vendorName: z.string(),
    fingerprints: z.array(z.string()), // Fuzzy match aliases
    defaults: z.object({
        currency: z.string().optional(),
        paymentTerms: z.string().optional(),
    }).optional(),
    patterns: z.record(VendorPatternSchema), // [targetField]: pattern
    createdAt: z.string(),
    updatedAt: z.string(),
});

export type VendorMemory = z.infer<typeof VendorMemorySchema>;
export type VendorPattern = z.infer<typeof VendorPatternSchema>;

// ============================================================================
// Correction Memory Schema (Reactive/Global Knowledge)
// ============================================================================

export const CorrectionMemorySchema = z.object({
    id: z.string(),
    triggerCondition: z.record(z.any()), // JsonLogicRule
    action: z.record(z.any()), // JsonLogicRule
    description: z.string(),
    confidence: z.number().min(0).max(1),
    decayFactor: z.number().default(0.95),
    createdAt: z.string(),
    lastUsed: z.string().optional(),
});

export type CorrectionMemory = z.infer<typeof CorrectionMemorySchema>;

// ============================================================================
// Resolution Memory Schema (Meta-Cognition)
// ============================================================================

export const ResolutionHistoryItemSchema = z.object({
    invoiceId: z.string(),
    outcome: z.enum(['ACCEPTED', 'REJECTED', 'MODIFIED']),
    timestamp: z.string(),
});

export const ResolutionMemorySchema = z.object({
    ruleId: z.string(),
    totalApplications: z.number().default(0),
    acceptedCount: z.number().default(0),
    rejectedCount: z.number().default(0),
    lastUsed: z.string().optional(),
    history: z.array(ResolutionHistoryItemSchema),
});

export type ResolutionMemory = z.infer<typeof ResolutionMemorySchema>;
export type ResolutionHistoryItem = z.infer<typeof ResolutionHistoryItemSchema>;

// ============================================================================
// Audit Trail
// ============================================================================

export const AuditTrailEntrySchema = z.object({
    step: z.string(),
    action: z.string(),
    field: z.string().optional(),
    oldValue: z.any().optional(),
    newValue: z.any().optional(),
    reasoning: z.string(),
    confidence: z.number().min(0).max(1).optional(),
    timestamp: z.string(),
});

export type AuditTrailEntry = z.infer<typeof AuditTrailEntrySchema>;

// ============================================================================
// Output Contract
// ============================================================================

export const OutputContractSchema = z.object({
    invoiceId: z.string(),
    vendor: z.string(),
    invoiceNumber: z.string(),
    date: z.string().optional(),
    serviceDate: z.string().optional(),
    dueDate: z.string().optional(),
    totalAmount: z.number().optional(),
    taxAmount: z.number().optional(),
    netAmount: z.number().optional(),
    currency: z.string().optional(),
    lineItems: z.array(LineItemSchema).optional(),
    paymentTerms: z.string().optional(),
    poNumber: z.string().optional(),
    requiresHumanReview: z.boolean(),
    reasoning: z.string(),
    confidence: z.number().min(0).max(1),
    auditTrail: z.array(AuditTrailEntrySchema),
    processedAt: z.string(),
});

export type OutputContract = z.infer<typeof OutputContractSchema>;

// ============================================================================
// Context for Processing
// ============================================================================

export interface ProcessingContext {
    invoice: Invoice;
    vendorMemory?: VendorMemory;
    correctionMemories: CorrectionMemory[];
    resolutionMemories: Map<string, ResolutionMemory>;
    auditTrail: AuditTrailEntry[];
}

// ============================================================================
// Field Confidence Score
// ============================================================================

export interface FieldConfidence {
    field: string;
    value: any;
    confidence: number;
    source: 'OCR' | 'VENDOR_PATTERN' | 'CORRECTION_RULE' | 'HUMAN';
    ruleId?: string;
    reasoning: string;
}

// ============================================================================
// Induction Result
// ============================================================================

export interface InductionResult {
    vendorRules: Array<{
        field: string;
        pattern: VendorPattern;
    }>;
    correctionRules: CorrectionMemory[];
    vendorId?: string;
}
