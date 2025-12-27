/**
 * SQLite Memory Store
 * Provides ACID-compliant persistence for all memory types
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    VendorMemory,
    CorrectionMemory,
    ResolutionMemory,
    VendorMemorySchema,
    CorrectionMemorySchema,
    ResolutionMemorySchema,
} from '../types/index.js';
import { generateFingerprints } from '../../utils/fuzzy.js';
import { getCurrentTimestamp } from '../../utils/date.js';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Memory Store class for SQLite operations
 */
export class MemoryStore {
    private db: Database.Database;

    constructor(dbPath?: string) {
        const defaultPath = path.join(process.cwd(), 'database', 'memory.db');
        this.db = new Database(dbPath || defaultPath);
        this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better performance
        this.initialize();
    }

    /**
     * Initialize database schema
     */
    private initialize(): void {
        // Vendor Memories Table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS vendor_memories (
        id TEXT PRIMARY KEY,
        vendor_name TEXT NOT NULL,
        fingerprints TEXT NOT NULL, -- JSON array
        defaults TEXT, -- JSON object
        patterns TEXT NOT NULL, -- JSON object
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_vendor_name ON vendor_memories(vendor_name);
    `);

        // Correction Memories Table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS correction_memories (
        id TEXT PRIMARY KEY,
        trigger_condition TEXT NOT NULL, -- JSON object
        action TEXT NOT NULL, -- JSON object
        description TEXT NOT NULL,
        confidence REAL NOT NULL,
        decay_factor REAL DEFAULT 0.95,
        created_at TEXT NOT NULL,
        last_used TEXT
      );
    `);

        // Resolution Memories Table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS resolution_memories (
        rule_id TEXT PRIMARY KEY,
        total_applications INTEGER DEFAULT 0,
        accepted_count INTEGER DEFAULT 0,
        rejected_count INTEGER DEFAULT 0,
        last_used TEXT,
        history TEXT NOT NULL -- JSON array
      );
    `);

        // Processed Invoices Table (for duplicate detection)
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS processed_invoices (
        fingerprint TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        vendor TEXT NOT NULL,
        invoice_number TEXT NOT NULL,
        total_amount REAL,
        processed_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_invoice_id ON processed_invoices(invoice_id);
    `);
    }

    // =========================================================================
    // Vendor Memory Operations
    // =========================================================================

    /**
     * Save vendor memory
     */
    saveVendorMemory(memory: VendorMemory): void {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO vendor_memories
      (id, vendor_name, fingerprints, defaults, patterns, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            memory.id,
            memory.vendorName,
            JSON.stringify(memory.fingerprints),
            JSON.stringify(memory.defaults || {}),
            JSON.stringify(memory.patterns),
            memory.createdAt,
            memory.updatedAt
        );
    }

    /**
     * Get vendor memory by ID
     */
    getVendorMemory(id: string): VendorMemory | null {
        const stmt = this.db.prepare('SELECT * FROM vendor_memories WHERE id = ?');
        const row = stmt.get(id) as any;

        if (!row) return null;

        return this.parseVendorMemory(row);
    }

    /**
     * Find vendor memory by name (exact match)
     */
    findVendorByName(name: string): VendorMemory | null {
        const stmt = this.db.prepare('SELECT * FROM vendor_memories WHERE vendor_name = ?');
        const row = stmt.get(name) as any;

        if (!row) return null;

        return this.parseVendorMemory(row);
    }

    /**
     * Get all vendor memories
     */
    getAllVendorMemories(): VendorMemory[] {
        const stmt = this.db.prepare('SELECT * FROM vendor_memories');
        const rows = stmt.all() as any[];

        return rows.map(row => this.parseVendorMemory(row));
    }

    /**
     * Update vendor pattern
     */
    updateVendorPattern(vendorId: string, field: string, pattern: any): void {
        const memory = this.getVendorMemory(vendorId);
        if (!memory) return;

        memory.patterns[field] = pattern;
        memory.updatedAt = getCurrentTimestamp();

        this.saveVendorMemory(memory);
    }

    private parseVendorMemory(row: any): VendorMemory {
        return {
            id: row.id,
            vendorName: row.vendor_name,
            fingerprints: JSON.parse(row.fingerprints),
            defaults: JSON.parse(row.defaults || '{}'),
            patterns: JSON.parse(row.patterns),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    // =========================================================================
    // Correction Memory Operations
    // =========================================================================

    /**
     * Save correction memory
     */
    saveCorrectionMemory(memory: CorrectionMemory): void {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO correction_memories
      (id, trigger_condition, action, description, confidence, decay_factor, created_at, last_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            memory.id,
            JSON.stringify(memory.triggerCondition),
            JSON.stringify(memory.action),
            memory.description,
            memory.confidence,
            memory.decayFactor,
            memory.createdAt,
            memory.lastUsed || null
        );
    }

    /**
     * Get all correction memories
     */
    getAllCorrectionMemories(): CorrectionMemory[] {
        const stmt = this.db.prepare('SELECT * FROM correction_memories');
        const rows = stmt.all() as any[];

        return rows.map(row => ({
            id: row.id,
            triggerCondition: JSON.parse(row.trigger_condition),
            action: JSON.parse(row.action),
            description: row.description,
            confidence: row.confidence,
            decayFactor: row.decay_factor,
            createdAt: row.created_at,
            lastUsed: row.last_used,
        }));
    }

    /**
     * Update correction memory last used
     */
    updateCorrectionLastUsed(id: string): void {
        const stmt = this.db.prepare('UPDATE correction_memories SET last_used = ? WHERE id = ?');
        stmt.run(getCurrentTimestamp(), id);
    }

    // =========================================================================
    // Resolution Memory Operations
    // =========================================================================

    /**
     * Save or update resolution memory
     */
    saveResolutionMemory(memory: ResolutionMemory): void {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO resolution_memories
      (rule_id, total_applications, accepted_count, rejected_count, last_used, history)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            memory.ruleId,
            memory.totalApplications,
            memory.acceptedCount,
            memory.rejectedCount,
            memory.lastUsed || null,
            JSON.stringify(memory.history)
        );
    }

    /**
     * Get resolution memory by rule ID
     */
    getResolutionMemory(ruleId: string): ResolutionMemory | null {
        const stmt = this.db.prepare('SELECT * FROM resolution_memories WHERE rule_id = ?');
        const row = stmt.get(ruleId) as any;

        if (!row) {
            // Return default
            return {
                ruleId,
                totalApplications: 0,
                acceptedCount: 0,
                rejectedCount: 0,
                history: [],
            };
        }

        return {
            ruleId: row.rule_id,
            totalApplications: row.total_applications,
            acceptedCount: row.accepted_count,
            rejectedCount: row.rejected_count,
            lastUsed: row.last_used,
            history: JSON.parse(row.history),
        };
    }

    /**
     * Record resolution outcome
     */
    recordResolution(
        ruleId: string,
        invoiceId: string,
        outcome: 'ACCEPTED' | 'REJECTED' | 'MODIFIED'
    ): void {
        const memory = this.getResolutionMemory(ruleId);

        memory.totalApplications++;
        if (outcome === 'ACCEPTED') {
            memory.acceptedCount++;
        } else if (outcome === 'REJECTED') {
            memory.rejectedCount++;
        }

        memory.lastUsed = getCurrentTimestamp();
        memory.history.push({
            invoiceId,
            outcome,
            timestamp: getCurrentTimestamp(),
        });

        // Keep only last 100 history items
        if (memory.history.length > 100) {
            memory.history = memory.history.slice(-100);
        }

        this.saveResolutionMemory(memory);
    }

    // =========================================================================
    // Duplicate Detection
    // =========================================================================

    /**
     * Generate invoice fingerprint
     */
    generateInvoiceFingerprint(
        vendor: string,
        invoiceNumber: string,
        date: string | undefined,
        totalAmount: number | undefined
    ): string {
        const data = `${vendor}|${invoiceNumber}|${date || ''}|${totalAmount || 0}`;
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Check if invoice is duplicate
     */
    isDuplicate(fingerprint: string): boolean {
        const stmt = this.db.prepare('SELECT fingerprint FROM processed_invoices WHERE fingerprint = ?');
        const row = stmt.get(fingerprint);
        return row !== undefined;
    }

    /**
     * Record processed invoice
     */
    recordProcessedInvoice(
        fingerprint: string,
        invoiceId: string,
        vendor: string,
        invoiceNumber: string,
        totalAmount?: number
    ): void {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO processed_invoices
      (fingerprint, invoice_id, vendor, invoice_number, total_amount, processed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            fingerprint,
            invoiceId,
            vendor,
            invoiceNumber,
            totalAmount || null,
            getCurrentTimestamp()
        );
    }

    /**
     * Close database connection
     */
    close(): void {
        this.db.close();
    }
}
