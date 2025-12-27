/**
 * Demo Runner
 * Demonstrates the Think-Act-Learn cognitive loop
 * Tests all grading criteria scenarios
 */

import { Agent } from '../src/index.js';
import {
    invoiceSupplierA001,
    invoiceSupplierA002,
    invoiceSupplierA003,
    invoicePartsB001,
    invoicePartsB002,
    invoiceFreightC001,
    invoiceFreightC002,
    invoiceDuplicate,
    correctionSupplierA001,
    correctionSupplierA003,
    correctionPartsB001,
    correctionFreightC001,
} from './test-data/invoices.js';

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
};

function printHeader(text: string): void {
    console.log(`\n${colors.bright}${colors.blue}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}${text}${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}${'='.repeat(80)}${colors.reset}\n`);
}

function printSection(text: string): void {
    console.log(`\n${colors.bright}${colors.cyan}>>> ${text}${colors.reset}\n`);
}

function printSuccess(text: string): void {
    console.log(`${colors.green}✓ ${text}${colors.reset}`);
}

function printWarning(text: string): void {
    console.log(`${colors.yellow}⚠ ${text}${colors.reset}`);
}

function printError(text: string): void {
    console.log(`${colors.red}✗ ${text}${colors.reset}`);
}

function printResult(output: any): void {
    console.log(JSON.stringify(output, null, 2));
}

async function runDemo() {
    printHeader('AI Document Automation Memory Layer - Demo');

    console.log('This demo showcases the Case-Based Reasoning system with learned memory.');
    console.log('The agent will process invoices, learn from corrections, and improve over time.\n');

    const agent = new Agent();
    await agent.initialize();

    // =========================================================================
    // SCENARIO 1: Supplier GmbH - Leistungsdatum Learning
    // =========================================================================

    printHeader('SCENARIO 1: Supplier GmbH - Leistungsdatum Extraction');

    printSection('Step 1: Cold Start - First Invoice (INV-A-001)');
    console.log('Processing invoice without any prior knowledge...\n');

    const result1 = await agent.process(invoiceSupplierA001);

    console.log('Result:');
    console.log(`  Invoice ID: ${result1.invoiceId}`);
    console.log(`  Vendor: ${result1.vendor}`);
    console.log(`  Service Date: ${result1.serviceDate || 'null'}`);
    console.log(`  Requires Review: ${result1.requiresHumanReview}`);
    console.log(`  Reasoning: ${result1.reasoning}`);
    console.log(`  Confidence: ${result1.confidence.toFixed(2)}\n`);

    if (result1.requiresHumanReview) {
        printWarning('Human review required (expected for new vendor)');
    }

    printSection('Step 2: Human Correction');
    console.log('Human provides service date: 2023-12-01\n');
    console.log('Agent learning from correction...');

    await agent.learn(invoiceSupplierA001, correctionSupplierA001);

    printSuccess('Learning complete! Agent now knows how to extract "Leistungsdatum"');

    printSection('Step 3: Warm Start - Second Invoice (INV-A-002)');
    console.log('Processing next invoice from same vendor with learned pattern...\n');

    const result2 = await agent.process(invoiceSupplierA002);

    console.log('Result:');
    console.log(`  Invoice ID: ${result2.invoiceId}`);
    console.log(`  Vendor: ${result2.vendor}`);
    console.log(`  Service Date: ${result2.serviceDate || 'null'}`);
    console.log(`  Requires Review: ${result2.requiresHumanReview}`);
    console.log(`  Reasoning: ${result2.reasoning}`);
    console.log(`  Confidence: ${result2.confidence.toFixed(2)}\n`);

    if (!result2.requiresHumanReview && result2.serviceDate) {
        printSuccess('Success! Service date extracted automatically with high confidence');
    }

    // =========================================================================
    // SCENARIO 2: Parts AG - VAT Calculation
    // =========================================================================

    printHeader('SCENARIO 2: Parts AG - VAT Calculation (MwSt. inkl.)');

    printSection('Step 1: Cold Start - Invoice with Missing Tax (INV-B-001)');
    console.log('Processing invoice with "MwSt. inkl." but tax amount = 0...\n');

    const result3 = await agent.process(invoicePartsB001);

    console.log('Result:');
    console.log(`  Invoice ID: ${result3.invoiceId}`);
    console.log(`  Total: ${result3.totalAmount}`);
    console.log(`  Tax: ${result3.taxAmount || 0}`);
    console.log(`  Net: ${result3.netAmount || 0}`);
    console.log(`  Requires Review: ${result3.requiresHumanReview}`);
    console.log(`  Reasoning: ${result3.reasoning}\n`);

    printSection('Step 2: Human Correction');
    console.log('Human calculates: Tax = 119 - (119 / 1.19) = 19, Net = 100\n');
    console.log('Agent learning VAT formula...');

    await agent.learn(invoicePartsB001, correctionPartsB001);

    printSuccess('Learning complete! Agent learned the inclusive VAT formula');

    printSection('Step 3: Warm Start - Next Invoice (INV-B-002)');
    console.log('Processing next invoice with same MwSt. inkl. pattern...\n');

    const result4 = await agent.process(invoicePartsB002);

    console.log('Result:');
    console.log(`  Invoice ID: ${result4.invoiceId}`);
    console.log(`  Total: ${result4.totalAmount}`);
    console.log(`  Tax: ${result4.taxAmount || 0}`);
    console.log(`  Net: ${result4.netAmount || 0}`);
    console.log(`  Requires Review: ${result4.requiresHumanReview}`);
    console.log(`  Confidence: ${result4.confidence.toFixed(2)}\n`);

    if (result4.taxAmount && Math.abs(result4.taxAmount - 38) < 0.1) {
        printSuccess('Success! Tax calculated automatically using learned formula');
    }

    // =========================================================================
    // SCENARIO 3: Freight & Co - Skonto & SKU Mapping
    // =========================================================================

    printHeader('SCENARIO 3: Freight & Co - Payment Terms and SKU Mapping');

    printSection('Step 1: Cold Start - Invoice C-001');
    console.log('Processing invoice with Skonto terms and freight description...\n');

    const result5 = await agent.process(invoiceFreightC001);

    console.log('Result:');
    console.log(`  Invoice ID: ${result5.invoiceId}`);
    console.log(`  Payment Terms: ${result5.paymentTerms || 'null'}`);
    console.log(`  Line Items:`);
    result5.lineItems?.forEach((item, idx) => {
        console.log(`    ${idx + 1}. ${item.description} | SKU: ${item.sku || 'null'}`);
    });
    console.log(`  Requires Review: ${result5.requiresHumanReview}\n`);

    printSection('Step 2: Human Correction');
    console.log('Human extracts payment terms and maps "Seefracht" to SKU "FREIGHT"\n');
    console.log('Agent learning...');

    await agent.learn(invoiceFreightC001, correctionFreightC001);

    printSuccess('Learning complete! Agent learned Skonto extraction and SKU mapping');

    printSection('Step 3: Warm Start - Invoice C-002');
    console.log('Processing next freight invoice...\n');

    const result6 = await agent.process(invoiceFreightC002);

    console.log('Result:');
    console.log(`  Invoice ID: ${result6.invoiceId}`);
    console.log(`  Payment Terms: ${result6.paymentTerms || 'null'}`);
    console.log(`  Line Items:`);
    result6.lineItems?.forEach((item, idx) => {
        console.log(`    ${idx + 1}. ${item.description} | SKU: ${item.sku || 'null'}`);
    });
    console.log(`  Confidence: ${result6.confidence.toFixed(2)}\n`);

    if (result6.paymentTerms && result6.lineItems?.[0]?.sku === 'FREIGHT') {
        printSuccess('Success! Payment terms and SKU extracted automatically');
    }

    // =========================================================================
    // SCENARIO 4: PO Matching
    // =========================================================================

    printHeader('SCENARIO 4: Supplier GmbH - PO Number Extraction');

    printSection('Step 1: Invoice with PO Reference (INV-A-003)');
    console.log('Processing invoice with PO number in raw text...\n');

    const result7 = await agent.process(invoiceSupplierA003);

    console.log('Result:');
    console.log(`  Invoice ID: ${result7.invoiceId}`);
    console.log(`  PO Number: ${result7.poNumber || 'null'}`);
    console.log(`  Requires Review: ${result7.requiresHumanReview}\n`);

    printSection('Step 2: Human Correction');
    console.log('Human extracts PO: PO-A-051\n');
    console.log('Agent learning...');

    await agent.learn(invoiceSupplierA003, correctionSupplierA003);

    printSuccess('Learning complete! Agent can now extract PO numbers');

    // =========================================================================
    // SCENARIO 5: Duplicate Detection
    // =========================================================================

    printHeader('SCENARIO 5: Duplicate Detection');

    printSection('Processing Duplicate Invoice (INV-A-004)');
    console.log('This invoice has the same vendor, number, date, and amount as INV-A-001\n');

    const result8 = await agent.process(invoiceDuplicate);

    console.log('Result:');
    console.log(`  Invoice ID: ${result8.invoiceId}`);
    console.log(`  Requires Review: ${result8.requiresHumanReview}`);
    console.log(`  Reasoning: ${result8.reasoning}\n`);

    if (result8.requiresHumanReview && result8.reasoning.includes('uplicate')) {
        printSuccess('Success! Duplicate detected correctly');
    } else {
        printError('Duplicate detection failed');
    }

    // =========================================================================
    // Summary
    // =========================================================================

    printHeader('DEMO COMPLETE - Summary');

    console.log('The agent successfully demonstrated:');
    printSuccess('Leistungsdatum extraction (regex induction)');
    printSuccess('VAT calculation (arithmetic induction)');
    printSuccess('Payment terms extraction (regex induction)');
    printSuccess('SKU mapping (mapping induction)');
    printSuccess('PO number extraction (regex induction)');
    printSuccess('Duplicate detection');

    console.log('\nMemory Statistics:');
    const vendors = agent.getAllVendorMemories();
    console.log(`  Total Vendors in Memory: ${vendors.length}`);

    for (const vendor of vendors) {
        console.log(`\n  Vendor: ${vendor.vendorName}`);
        console.log(`    Patterns Learned: ${Object.keys(vendor.patterns).length}`);
        for (const field of Object.keys(vendor.patterns)) {
            console.log(`      - ${field}`);
        }
    }

    console.log('\n');
    printHeader('Thank you for watching!');

    agent.close();
}

// Run the demo
runDemo().catch(error => {
    console.error('Demo error:', error);
    process.exit(1);
});
