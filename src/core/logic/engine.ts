/**
 * JSON Logic Engine
 * Wraps json-logic-js with custom operations for invoice processing
 */

import jsonLogic from 'json-logic-js';
import { parseGermanDate, normalizeDate } from '../../utils/date.js';

/**
 * Custom operation: Extract value using regex
 */
jsonLogic.add_operation('regexExtract', (pattern: string, text: string, groupIndex: number = 1) => {
    if (!text || !pattern) return null;

    try {
        const regex = new RegExp(pattern, 'i');
        const match = text.match(regex);
        return match ? (match[groupIndex] || null) : null;
    } catch (error) {
        console.error('Regex error:', error);
        return null;
    }
});

/**
 * Custom operation: Test if regex matches
 */
jsonLogic.add_operation('regexTest', (pattern: string, text: string) => {
    if (!text || !pattern) return false;

    try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(text);
    } catch (error) {
        return false;
    }
});

/**
 * Custom operation: Map description to SKU
 */
jsonLogic.add_operation('mapDescription', (description: string, mapping: Record<string, string>) => {
    if (!description || !mapping) return null;

    const normalized = description.toLowerCase().trim();

    // Check for exact match first
    for (const [key, value] of Object.entries(mapping)) {
        if (normalized === key.toLowerCase()) {
            return value;
        }
    }

    // Check for partial match
    for (const [key, value] of Object.entries(mapping)) {
        if (normalized.includes(key.toLowerCase())) {
            return value;
        }
    }

    return null;
});

/**
 * Custom operation: Normalize date (German format)
 */
jsonLogic.add_operation('dateNormalize', (dateStr: string) => {
    if (!dateStr) return null;
    return normalizeDate(dateStr);
});

/**
 * Custom operation: Parse German date specifically
 */
jsonLogic.add_operation('parseGermanDate', (dateStr: string) => {
    if (!dateStr) return null;
    return parseGermanDate(dateStr);
});

/**
 * Custom operation: Extract number from text
 */
jsonLogic.add_operation('extractNumber', (text: string) => {
    if (!text) return null;

    const match = text.match(/[\d.,]+/);
    if (!match) return null;

    // Replace comma with period for parsing
    const cleaned = match[0].replace(',', '.');
    const num = parseFloat(cleaned);

    return isNaN(num) ? null : num;
});

/**
 * Custom operation: Contains (case-insensitive)
 */
jsonLogic.add_operation('containsIgnoreCase', (text: string, search: string) => {
    if (!text || !search) return false;
    return text.toLowerCase().includes(search.toLowerCase());
});

/**
 * Custom operation: Extract currency code
 */
jsonLogic.add_operation('extractCurrency', (text: string) => {
    if (!text) return null;

    // Common currency codes
    const currencies = ['EUR', 'USD', 'GBP', 'CHF', 'JPY'];

    for (const currency of currencies) {
        if (new RegExp(`\\b${currency}\\b`, 'i').test(text)) {
            return currency;
        }
    }

    return null;
});

/**
 * Execute JSON Logic rule
 * @param rule JsonLogic rule object
 * @param data Data context
 * @returns Result of rule execution
 */
export function executeRule(rule: any, data: any): any {
    try {
        return jsonLogic.apply(rule, data);
    } catch (error) {
        console.error('JSON Logic execution error:', error);
        return null;
    }
}

/**
 * Test if rule is valid
 * @param rule JsonLogic rule object
 * @returns true if valid
 */
export function isValidRule(rule: any): boolean {
    try {
        jsonLogic.apply(rule, {});
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Create a regex extraction rule
 * @param pattern Regex pattern
 * @param sourceField Field containing text to search
 * @param groupIndex Capture group index
 * @returns JsonLogic rule
 */
export function createRegexRule(
    pattern: string,
    sourceField: string = 'rawText',
    groupIndex: number = 1
): any {
    return {
        regexExtract: [pattern, { var: sourceField }, groupIndex],
    };
}

/**
 * Create a mapping rule
 * @param mapping Map of descriptions to values
 * @param sourceField Field containing description
 * @returns JsonLogic rule
 */
export function createMapRule(mapping: Record<string, string>, sourceField: string): any {
    return {
        mapDescription: [{ var: sourceField }, mapping],
    };
}

/**
 * Create an arithmetic rule
 * @param formula Formula type ('inclusive_vat', 'exclusive_vat', etc.)
 * @param sourceField Field containing base value
 * @returns JsonLogic rule
 */
export function createArithmeticRule(formula: string, sourceField: string): any {
    switch (formula) {
        case 'inclusive_vat_19':
            // Tax = Total - (Total / 1.19)
            return {
                '-': [
                    { var: sourceField },
                    { '/': [{ var: sourceField }, 1.19] },
                ],
            };

        case 'exclusive_vat_19':
            // Tax = Net * 0.19
            return {
                '*': [{ var: sourceField }, 0.19],
            };

        case 'net_from_gross_19':
            // Net = Total / 1.19
            return {
                '/': [{ var: sourceField }, 1.19],
            };

        default:
            return null;
    }
}

/**
 * Create a condition rule
 * @param condition Condition logic
 * @param thenValue Value if true
 * @param elseValue Value if false
 * @returns JsonLogic rule
 */
export function createConditionRule(condition: any, thenValue: any, elseValue: any = null): any {
    return {
        if: [condition, thenValue, elseValue],
    };
}
