/**
 * Induction Engine
 * Synthesizes rules from human corrections using three strategies:
 * 1. Regex Induction (field extraction)
 * 2. Arithmetic Induction (formula derivation)
 * 3. Mapping Induction (SKU/description mapping)
 */

import { Invoice, VendorPattern, CorrectionMemory, InductionResult } from '../../types/index.js';
import { computeDiff, extractChanges } from '../../utils/diff.js';
import { getCurrentTimestamp } from '../../utils/date.js';
import { createRegexRule, createMapRule, createArithmeticRule } from './engine.js';
import crypto from 'crypto';

/**
 * Main induction function
 * Analyzes diff between system output and human correction to generate rules
 */
export function induceRules(
    systemOutput: Invoice,
    humanCorrection: Invoice
): InductionResult {
    const result: InductionResult = {
        vendorRules: [],
        correctionRules: [],
    };

    // Compute diff
    const patch = computeDiff(systemOutput, humanCorrection);
    if (patch.length === 0) {
        return result; // No changes
    }

    const changes = extractChanges(patch);

    // Process each changed field
    for (const [field, newValue] of changes.entries()) {
        const oldValue = getFieldValue(systemOutput, field);

        // Skip if no actual change
        if (oldValue === newValue) continue;

        // Determine induction strategy based on field type
        if (isDateField(field)) {
            const rule = induceRegexForDate(field, newValue, systemOutput.rawText);
            if (rule) {
                result.vendorRules.push({ field, pattern: rule });
            }
        } else if (isNumericField(field) && typeof newValue === 'number') {
            // Check if it's a formula-based correction
            const formulaRule = induceArithmeticFormula(field, newValue, systemOutput);
            if (formulaRule) {
                result.correctionRules.push(formulaRule);
            } else {
                // Try regex extraction for numbers
                const rule = induceRegexForNumber(field, newValue, systemOutput.rawText);
                if (rule) {
                    result.vendorRules.push({ field, pattern: rule });
                }
            }
        } else if (field.includes('sku') || field.includes('Sku')) {
            // SKU mapping
            const description = getDescriptionForSku(field, systemOutput);
            if (description) {
                const rule = induceMapping(field, description, newValue, systemOutput);
                if (rule) {
                    result.vendorRules.push({ field, pattern: rule });
                }
            }
        } else if (field.includes('paymentTerms')) {
            // Payment terms extraction
            const rule = induceRegexForPaymentTerms(newValue, systemOutput.rawText);
            if (rule) {
                result.vendorRules.push({ field, pattern: rule });
            }
        } else if (field.includes('poNumber')) {
            // PO number extraction
            const rule = induceRegexForPO(newValue, systemOutput.rawText);
            if (rule) {
                result.vendorRules.push({ field, pattern: rule });
            }
        } else {
            // Generic text field
            const rule = induceRegexForText(field, newValue, systemOutput.rawText);
            if (rule) {
                result.vendorRules.push({ field, pattern: rule });
            }
        }
    }

    return result;
}

// =============================================================================
// Strategy 1: Regex Induction
// =============================================================================

/**
 * Induce regex pattern for date field (Leistungsdatum logic)
 */
function induceRegexForDate(
    _field: string,
    dateValue: string,
    rawText: string
): VendorPattern | null {
    if (!rawText || !dateValue) return null;

    // Common date labels
    const labels = [
        'Leistungsdatum',
        'Service Date',
        'Datum',
        'Date',
        'Rechnungsdatum',
        'Invoice Date',
    ];

    // Try to find the date value in raw text
    // Support formats: 2023-12-01, 01.12.2023, 01.12.23
    const dateVariants = generateDateVariants(dateValue);

    for (const variant of dateVariants) {
        const escapedVariant = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Search for label + date pattern
        for (const label of labels) {
            const pattern = `${label}[:\\s]*${escapedVariant}`;
            const regex = new RegExp(pattern, 'i');

            if (regex.test(rawText)) {
                // Found it! Create a generalizable pattern
                const extractPattern = `${label}[:\\s]*(\\d{2}\\.\\d{2}\\.\\d{2,4}|\\d{4}-\\d{2}-\\d{2})`;

                return {
                    ruleType: 'REGEX',
                    logic: createRegexRule(extractPattern, 'rawText', 1),
                    confidence: 0.95,
                    sampleEvidence: rawText.substring(Math.max(0, rawText.indexOf(variant) - 20), rawText.indexOf(variant) + variant.length + 20),
                    createdAt: getCurrentTimestamp(),
                };
            }
        }
    }

    // Fallback: just find the date value
    for (const variant of dateVariants) {
        if (rawText.includes(variant)) {
            // Create a more specific pattern
            const pattern = `(${variant.replace(/[\d]/g, '\\d')})`;

            return {
                ruleType: 'REGEX',
                logic: createRegexRule(pattern, 'rawText', 1),
                confidence: 0.70, // Lower confidence for non-labeled extraction
                sampleEvidence: variant,
                createdAt: getCurrentTimestamp(),
            };
        }
    }

    return null;
}

/**
 * Induce regex pattern for numeric field
 */
function induceRegexForNumber(
    field: string,
    numValue: number,
    rawText: string
): VendorPattern | null {
    if (!rawText) return null;

    const numStr = numValue.toString();
    const numVariants = [numStr, numStr.replace('.', ',')];

    for (const variant of numVariants) {
        if (rawText.includes(variant)) {
            // Try to find label
            const fieldLabels = generateFieldLabels(field);

            for (const label of fieldLabels) {
                const pattern = `${label}[:\\s]*(\\d+[.,]?\\d*)`;
                const regex = new RegExp(pattern, 'i');

                if (regex.test(rawText)) {
                    return {
                        ruleType: 'REGEX',
                        logic: createRegexRule(pattern, 'rawText', 1),
                        confidence: 0.85,
                        sampleEvidence: variant,
                        createdAt: getCurrentTimestamp(),
                    };
                }
            }
        }
    }

    return null;
}

/**
 * Induce regex pattern for payment terms (Skonto)
 */
function induceRegexForPaymentTerms(
    value: string,
    rawText: string
): VendorPattern | null {
    if (!rawText || !value) return null;

    // Look for skonto patterns
    if (value.toLowerCase().includes('skonto')) {
        const pattern = '(\\d+%\\s*Skonto)';
        const regex = new RegExp(pattern, 'i');

        if (regex.test(rawText)) {
            return {
                ruleType: 'REGEX',
                logic: createRegexRule(pattern, 'rawText', 1),
                confidence: 0.90,
                sampleEvidence: value,
                createdAt: getCurrentTimestamp(),
            };
        }
    }

    return induceRegexForText('paymentTerms', value, rawText);
}

/**
 * Induce regex pattern for PO number
 */
function induceRegexForPO(
    value: string,
    rawText: string
): VendorPattern | null {
    if (!rawText || !value) return null;

    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (rawText.includes(value)) {
        const pattern = `(${escaped.replace(/[A-Z0-9]/g, (m) => m.match(/[A-Z]/) ? '[A-Z]' : '\\d')})`;

        return {
            ruleType: 'REGEX',
            logic: createRegexRule(pattern, 'rawText', 1),
            confidence: 0.85,
            sampleEvidence: value,
            createdAt: getCurrentTimestamp(),
        };
    }

    return null;
}

/**
 * Induce regex pattern for generic text field
 */
function induceRegexForText(
    field: string,
    value: string,
    rawText: string
): VendorPattern | null {
    if (!rawText || !value) return null;

    if (rawText.includes(value)) {
        const labels = generateFieldLabels(field);

        for (const label of labels) {
            const pattern = `${label}[:\\s]*([^\\n\\r]+)`;
            const regex = new RegExp(pattern, 'i');

            const match = rawText.match(regex);
            if (match && match[1].includes(value)) {
                return {
                    ruleType: 'REGEX',
                    logic: createRegexRule(pattern, 'rawText', 1),
                    confidence: 0.80,
                    sampleEvidence: value,
                    createdAt: getCurrentTimestamp(),
                };
            }
        }
    }

    return null;
}

// =============================================================================
// Strategy 2: Arithmetic Induction
// =============================================================================

/**
 * Induce arithmetic formula for tax/amount calculations
 */
function induceArithmeticFormula(
    field: string,
    correctedValue: number,
    invoice: Invoice
): CorrectionMemory | null {
    const { netAmount, totalAmount, taxAmount, rawText } = invoice;

    // Hypothesis 1: Inclusive VAT (Tax = Total - (Total / 1.19))
    if (field === 'taxAmount' && totalAmount && !taxAmount) {
        const calculated = totalAmount - (totalAmount / 1.19);

        if (Math.abs(calculated - correctedValue) < 0.01) {
            // Check for "MwSt. inkl." or similar in raw text
            if (rawText && /mwst\.?\s*inkl|gross|brutto|tax\s*incl/i.test(rawText)) {
                return {
                    id: generateRuleId('inclusive_vat_19'),
                    triggerCondition: {
                        and: [
                            { '==': [{ var: 'taxAmount' }, 0] },
                            { '>': [{ var: 'totalAmount' }, 0] },
                            { regexTest: ['mwst\\.?\\s*inkl|gross|brutto|tax\\s*incl', { var: 'rawText' }] },
                        ],
                    },
                    action: createArithmeticRule('inclusive_vat_19', 'totalAmount'),
                    description: 'Calculate 19% VAT from gross amount when "MwSt. inkl." detected',
                    confidence: 0.95,
                    decayFactor: 0.95,
                    createdAt: getCurrentTimestamp(),
                };
            }
        }
    }

    // Hypothesis 2: Exclusive VAT (Tax = Net * 0.19)
    if (field === 'taxAmount' && netAmount && !taxAmount) {
        const calculated = netAmount * 0.19;

        if (Math.abs(calculated - correctedValue) < 0.01) {
            return {
                id: generateRuleId('exclusive_vat_19'),
                triggerCondition: {
                    and: [
                        { '==': [{ var: 'taxAmount' }, 0] },
                        { '>': [{ var: 'netAmount' }, 0] },
                    ],
                },
                action: createArithmeticRule('exclusive_vat_19', 'netAmount'),
                description: 'Calculate 19% VAT from net amount',
                confidence: 0.90,
                decayFactor: 0.95,
                createdAt: getCurrentTimestamp(),
            };
        }
    }

    // Hypothesis 3: Net from Gross (Net = Total / 1.19)
    if (field === 'netAmount' && totalAmount && !netAmount) {
        const calculated = totalAmount / 1.19;

        if (Math.abs(calculated - correctedValue) < 0.01) {
            return {
                id: generateRuleId('net_from_gross_19'),
                triggerCondition: {
                    and: [
                        { '==': [{ var: 'netAmount' }, 0] },
                        { '>': [{ var: 'totalAmount' }, 0] },
                    ],
                },
                action: createArithmeticRule('net_from_gross_19', 'totalAmount'),
                description: 'Calculate net amount from gross (19% VAT)',
                confidence: 0.90,
                decayFactor: 0.95,
                createdAt: getCurrentTimestamp(),
            };
        }
    }

    return null;
}

// =============================================================================
// Strategy 3: Mapping Induction
// =============================================================================

/**
 * Induce SKU mapping from description
 */
function induceMapping(
    field: string,
    description: string,
    sku: string,
    _invoice: Invoice
): VendorPattern | null {
    if (!description || !sku) return null;

    // Tokenize description
    const tokens = description.toLowerCase().split(/\s+/);

    // Create mapping
    const mapping: Record<string, string> = {};

    // Add full description
    mapping[description.toLowerCase()] = sku;

    // Add significant tokens (length > 3)
    for (const token of tokens) {
        if (token.length > 3) {
            mapping[token] = sku;
        }
    }

    return {
        ruleType: 'MAP',
        logic: createMapRule(mapping, field.replace('.sku', '.description')),
        confidence: 0.85,
        sampleEvidence: description,
        createdAt: getCurrentTimestamp(),
    };
}

// =============================================================================
// Helper Functions
// =============================================================================

function getFieldValue(obj: any, path: string): any {
    const parts = path.split('/').filter(p => p);
    let value = obj;

    for (const part of parts) {
        if (value && typeof value === 'object') {
            value = value[part];
        } else {
            return undefined;
        }
    }

    return value;
}

function isDateField(field: string): boolean {
    return /date/i.test(field);
}

function isNumericField(field: string): boolean {
    return /amount|price|quantity|tax|total|net/i.test(field);
}

function generateDateVariants(isoDate: string): string[] {
    const variants = [isoDate];

    // Convert ISO to German format
    const match = isoDate.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const [, year, month, day] = match;
        variants.push(`${day}.${month}.${year}`);
        variants.push(`${day}.${month}.${year.substring(2)}`);
    }

    return variants;
}

function generateFieldLabels(field: string): string[] {
    const labels = [field];

    // Convert camelCase to space-separated
    const spaced = field.replace(/([A-Z])/g, ' $1').trim();
    labels.push(spaced);

    // Common variations
    const fieldLower = field.toLowerCase();
    if (fieldLower.includes('net')) labels.push('Netto', 'Net');
    if (fieldLower.includes('total')) labels.push('Gesamt', 'Total', 'Summe');
    if (fieldLower.includes('tax')) labels.push('MwSt', 'Tax', 'VAT');
    if (fieldLower.includes('date')) labels.push('Datum', 'Date');

    return labels;
}

function getDescriptionForSku(field: string, invoice: Invoice): string | null {
    // Extract line item index from field path (e.g., "lineItems/0/sku")
    const match = field.match(/lineItems\/(\d+)/);
    if (!match) return null;

    const index = parseInt(match[1]);
    const lineItem = invoice.lineItems?.[index];

    return lineItem?.description || null;
}

function generateRuleId(base: string): string {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5').update(`${base}-${timestamp}`).digest('hex').substring(0, 8);
    return `${base}-${hash}`;
}
