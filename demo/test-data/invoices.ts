/**
 * Test Invoice Data
 * Covers all grading criteria scenarios from the blueprint
 */

import { Invoice } from '../../src/types/index.js';

/**
 * Supplier GmbH - Invoice A-001
 * Tests: Leistungsdatum extraction (cold start)
 */
export const invoiceSupplierA001: Invoice = {
    id: 'INV-A-001',
    vendor: 'Supplier GmbH',
    invoiceNumber: 'A-001',
    date: '2023-12-15',
    totalAmount: 1000,
    rawText: `
    RECHNUNG
    Supplier GmbH
    Rechnungsnummer: A-001
    Rechnungsdatum: 15.12.2023
    Leistungsdatum: 01.12.2023
    
    Betrag: 1000.00 EUR
  `,
};

/**
 * Supplier GmbH - Invoice A-002
 * Tests: Warm start (should apply learned pattern)
 */
export const invoiceSupplierA002: Invoice = {
    id: 'INV-A-002',
    vendor: 'Supplier GmbH',
    invoiceNumber: 'A-002',
    date: '2024-01-20',
    totalAmount: 1500,
    rawText: `
    RECHNUNG
    Supplier GmbH
    Rechnungsnummer: A-002
    Rechnungsdatum: 20.01.2024
    Leistungsdatum: 15.01.2024
    
    Betrag: 1500.00 EUR
  `,
};

/**
 * Supplier GmbH - Invoice A-003
 * Tests: PO Matching
 */
export const invoiceSupplierA003: Invoice = {
    id: 'INV-A-003',
    vendor: 'Supplier GmbH',
    invoiceNumber: 'A-003',
    date: '2024-02-10',
    totalAmount: 2500,
    lineItems: [
        { description: 'Service A', quantity: 10, unitPrice: 100, amount: 1000 },
        { description: 'Service B', quantity: 15, unitPrice: 100, amount: 1500 },
    ],
    rawText: `
    RECHNUNG
    Supplier GmbH
    Rechnungsnummer: A-003
    Rechnungsdatum: 10.02.2024
    Leistungsdatum: 01.02.2024
    PO: PO-A-051
    
    Service A: 1000.00 EUR
    Service B: 1500.00 EUR
    Gesamt: 2500.00 EUR
  `,
};

/**
 * Parts AG - Invoice B-001
 * Tests: VAT recalculation (MwSt. inkl.)
 */
export const invoicePartsB001: Invoice = {
    id: 'INV-B-001',
    vendor: 'Parts AG',
    invoiceNumber: 'B-001',
    date: '2024-01-10',
    taxAmount: 0, // Missing - should be calculated
    netAmount: 0,
    totalAmount: 119,
    rawText: `
    RECHNUNG
    Parts AG
    Rechnungsnummer: B-001
    Datum: 10.01.2024
    
    Gesamt: 119.00 EUR (MwSt. inkl.)
  `,
};

/**
 * Parts AG - Invoice B-002
 * Tests: Warm start for VAT (should apply learned formula)
 */
export const invoicePartsB002: Invoice = {
    id: 'INV-B-002',
    vendor: 'Parts AG',
    invoiceNumber: 'B-002',
    date: '2024-02-15',
    taxAmount: 0,
    netAmount: 0,
    totalAmount: 238,
    rawText: `
    RECHNUNG
    Parts AG
    Rechnungsnummer: B-002
    Datum: 15.02.2024
    
    Gesamt: 238.00 EUR (MwSt. inkl.)
  `,
};

/**
 * Freight & Co - Invoice C-001
 * Tests: Skonto terms and SKU mapping
 */
export const invoiceFreightC001: Invoice = {
    id: 'INV-C-001',
    vendor: 'Freight & Co',
    invoiceNumber: 'C-001',
    date: '2024-01-15',
    totalAmount: 500,
    lineItems: [
        { description: 'Seefracht Hamburg-NY', quantity: 1, unitPrice: 500, amount: 500 },
    ],
    rawText: `
    RECHNUNG
    Freight & Co
    Rechnungsnummer: C-001
    Datum: 15.01.2024
    
    Seefracht Hamburg-NY: 500.00 EUR
    
    Zahlungsbedingungen: 3% Skonto bei Zahlung innerhalb 10 Tagen
    Gesamt: 500.00 EUR
  `,
};

/**
 * Freight & Co - Invoice C-002
 * Tests: Warm start (SKU mapping + Skonto)
 */
export const invoiceFreightC002: Invoice = {
    id: 'INV-C-002',
    vendor: 'Freight & Co',
    invoiceNumber: 'C-002',
    date: '2024-02-20',
    totalAmount: 750,
    lineItems: [
        { description: 'Seefracht Rotterdam-Boston', quantity: 1, unitPrice: 750, amount: 750 },
    ],
    rawText: `
    RECHNUNG
    Freight & Co
    Rechnungsnummer: C-002
    Datum: 20.02.2024
    
    Seefracht Rotterdam-Boston: 750.00 EUR
    
    Zahlungsbedingungen: 3% Skonto bei Zahlung innerhalb 10 Tagen
    Gesamt: 750.00 EUR
  `,
};

/**
 * Duplicate Invoice
 * Tests: Duplicate detection
 */
export const invoiceDuplicate: Invoice = {
    id: 'INV-A-004',
    vendor: 'Supplier GmbH',
    invoiceNumber: 'A-001', // Same as INV-A-001
    date: '2023-12-15', // Same
    totalAmount: 1000, // Same
    rawText: `
    RECHNUNG
    Supplier GmbH
    Rechnungsnummer: A-001
    Rechnungsdatum: 15.12.2023
    
    Betrag: 1000.00 EUR
  `,
};

/**
 * Human Corrections for Learning
 */

export const correctionSupplierA001: Invoice = {
    ...invoiceSupplierA001,
    serviceDate: '2023-12-01', // Extracted from "Leistungsdatum: 01.12.2023"
};

export const correctionSupplierA003: Invoice = {
    ...invoiceSupplierA003,
    serviceDate: '2024-02-01',
    poNumber: 'PO-A-051', // Extracted from raw text
};

export const correctionPartsB001: Invoice = {
    ...invoicePartsB001,
    taxAmount: 19, // 119 - (119 / 1.19) = 19
    netAmount: 100, // 119 / 1.19 = 100
};

export const correctionFreightC001: Invoice = {
    ...invoiceFreightC001,
    paymentTerms: '3% Skonto bei Zahlung innerhalb 10 Tagen',
    lineItems: [
        {
            description: 'Seefracht Hamburg-NY',
            quantity: 1,
            unitPrice: 500,
            amount: 500,
            sku: 'FREIGHT', // Human maps to SKU
        },
    ],
};
