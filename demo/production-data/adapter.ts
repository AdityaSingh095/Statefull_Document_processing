/**
 * Data Adapter
 * Converts production data format to internal Invoice schema
 */

import { Invoice, LineItem } from '../../src/types/index.js';
import { parseGermanDate } from '../../src/utils/date.js';

/**
 * Production invoice format (nested fields)
 */
export interface ProductionInvoice {
    invoiceId: string;
    vendor: string;
    fields: {
        invoiceNumber: string;
        invoiceDate: string;
        serviceDate?: string | null;
        currency?: string | null;
        poNumber?: string | null;
        netTotal: number;
        taxRate: number;
        taxTotal: number;
        grossTotal: number;
        lineItems?: Array<{
            sku?: string | null;
            description?: string;
            qty: number;
            unitPrice: number;
        }>;
        discountTerms?: string | null;
    };
    confidence: number;
    rawText: string;
}

/**
 * Purchase Order
 */
export interface PurchaseOrder {
    poNumber: string;
    vendor: string;
    date: string;
    lineItems: Array<{
        sku: string;
        qty: number;
        unitPrice: number;
    }>;
}

/**
 * Human Correction
 */
export interface HumanCorrection {
    invoiceId: string;
    vendor: string;
    corrections: Array<{
        field: string;
        from: any;
        to: any;
        reason: string;
    }>;
    finalDecision: string;
}

/**
 * Convert production invoice to internal schema
 */
export function adaptInvoice(prodInvoice: ProductionInvoice): Invoice {
    const { invoiceId, vendor, fields, rawText } = prodInvoice;

    // Parse dates
    const invoiceDate = parseGermanDate(fields.invoiceDate) || fields.invoiceDate;
    const serviceDate = fields.serviceDate ?
        (parseGermanDate(fields.serviceDate) || fields.serviceDate) : undefined;

    // Convert line items
    const lineItems: LineItem[] | undefined = fields.lineItems?.map(item => ({
        description: item.description || '',
        quantity: item.qty,
        unitPrice: item.unitPrice,
        amount: item.qty * item.unitPrice,
        sku: item.sku || undefined,
    }));

    return {
        id: invoiceId,
        vendor,
        invoiceNumber: fields.invoiceNumber,
        date: invoiceDate,
        serviceDate,
        currency: fields.currency || undefined,
        netAmount: fields.netTotal,
        taxAmount: fields.taxTotal,
        totalAmount: fields.grossTotal,
        lineItems,
        poNumber: fields.poNumber || undefined,
        paymentTerms: fields.discountTerms || undefined,
        rawText,
    };
}

/**
 * Apply human corrections to an invoice
 */
export function applyCorrections(
    invoice: Invoice,
    corrections: HumanCorrection
): Invoice {
    const corrected = { ...invoice };

    for (const correction of corrections.corrections) {
        const { field, to } = correction;

        // Handle nested field paths (e.g., "lineItems[0].sku")
        if (field.includes('[')) {
            // Parse array index field
            const match = field.match(/(\w+)\[(\d+)\]\.(\w+)/);
            if (match) {
                const [, arrayField, index, prop] = match;
                const idx = parseInt(index);

                if ((corrected as any)[arrayField] && (corrected as any)[arrayField][idx]) {
                    (corrected as any)[arrayField][idx][prop] = to;
                }
            }
        } else {
            // Simple field
            (corrected as any)[field] = to;
        }
    }

    return corrected;
}

/**
 * Match invoice to purchase orders
 * Returns best matching PO based on vendor, date proximity, and line items
 */
export function matchPurchaseOrder(
    invoice: Invoice,
    purchaseOrders: PurchaseOrder[]
): string | null {
    // Filter POs by vendor
    const vendorPOs = purchaseOrders.filter(po => po.vendor === invoice.vendor);

    if (vendorPOs.length === 0) return null;

    // If invoice already has PO, verify it exists
    if (invoice.poNumber) {
        const exists = vendorPOs.find(po => po.poNumber === invoice.poNumber);
        return exists ? invoice.poNumber : null;
    }

    // Match based on line items
    if (!invoice.lineItems || invoice.lineItems.length === 0) return null;

    const invoiceSKUs = invoice.lineItems
        .map(item => item.sku)
        .filter(sku => sku) as string[];

    if (invoiceSKUs.length === 0) return null;

    // Find POs with matching SKUs
    const matchedPOs = vendorPOs.filter(po => {
        const poSKUs = po.lineItems.map(item => item.sku);
        return invoiceSKUs.some(sku => poSKUs.includes(sku));
    });

    if (matchedPOs.length === 0) return null;
    if (matchedPOs.length === 1) return matchedPOs[0].poNumber;

    // Multiple matches: choose closest by date (within 30 days)
    if (!invoice.date) return matchedPOs[0].poNumber;

    const invoiceDate = new Date(invoice.date);

    const scored = matchedPOs.map(po => {
        const poDate = new Date(po.date);
        const daysDiff = Math.abs((invoiceDate.getTime() - poDate.getTime()) / (1000 * 60 * 60 * 24));
        return { po, score: daysDiff };
    });

    scored.sort((a, b) => a.score - b.score);

    // Only return if within 30 days
    return scored[0].score <= 30 ? scored[0].po.poNumber : null;
}
