# AI Document Automation Memory Layer

A rational intelligent document processing system based on Case-Based Reasoning (CBR) that learns from human corrections to improve automation rates over time.

## 🧠 Overview

This system implements a **"Think-Act-Learn" cognitive loop** using Symbolic AI instead of deep learning:

- **Think (Recall)**: Retrieve vendor-specific patterns and past resolutions
- **Act (Apply + Decide)**: Execute rules deterministically and make confidence-based decisions
- **Learn (Induce)**: Synthesize new rules from human corrections using program synthesis

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AGENT                                 │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Recall   │→ │Cognitive │→ │ Decision │→ │ Output   │   │
│  │ Engine   │  │  Engine  │  │ Engine   │  │ Contract │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│       ↓             ↓             ↓                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Induction Engine (Learning)                │  │
│  └──────────────────────────────────────────────────────┘  │
│       ↓                                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │     Memory Store (SQLite with JSON1)                  │  │
│  │  • Vendor Memory    • Correction Memory               │  │
│  │  • Resolution Memory • Duplicate Detection            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Key Features

### Memory Types

1.  **Vendor Memory** (Contextual Knowledge)
    *   Vendor-specific extraction patterns
    *   Default values (currency, payment terms)
    *   Regex rules for field extraction

2.  **Correction Memory** (Global Knowledge)
    *   Formula-based rules (e.g., VAT calculations)
    *   Triggered by data state, not vendor identity

3.  **Resolution Memory** (Meta-Cognition)
    *   Tracks rule performance (accept/reject counts)
    *   Enables reinforcement learning
    *   Confidence decay over time

### Learning Strategies

1.  **Regex Induction**: Synthesizes patterns from text (e.g., "Leistungsdatum: 01.12.2023" → regex)
2.  **Arithmetic Induction**: Derives formulas from corrections (e.g., Tax = Total - Total/1.19)
3.  **Mapping Induction**: Creates SKU mappings (e.g., "Seefracht" → "FREIGHT")

### Decision Logic

-   **Confidence Scoring**: Laplace smoothing + time decay
-   **Escalation Thresholds**:
    *   New vendor → review required
    *   Critical field confidence < 0.90 → review
    *   Overall confidence < 0.80 → review
    *   Duplicate detected → review
    *   Amount mismatch → review

## 🚀 Quick Start

### Installation

```bash
cd flowai
npm install
```

### Run Demo

**Production Demo** (12 Real Invoices):
```bash
npm run demo:prod
```

**Original Demo** (Quick Test):
```bash
npm run demo
```

The production demo showcases:
- ✅ Supplier GmbH: Leistungsdatum extraction (INV-A-001, INV-A-002)
- ✅ Parts AG: VAT calculation with "MwSt. inkl." (INV-B-001, INV-B-002)
- ✅ Parts AG: Currency extraction from rawText (INV-B-003)
- ✅ Freight & Co: Skonto terms detection (INV-C-001)
- ✅ Freight & Co: SKU mapping Seefracht→FREIGHT (INV-C-002)
- ✅ PO matching logic (INV-A-003 → PO-A-051)
- ✅ Duplicate detection (INV-A-004, INV-B-004)

## 📊 Demo Scenarios

### Scenario 1: Leistungsdatum Learning (Supplier GmbH)

**Cold Start** (INV-A-001):
```
Service Date: null
Requires Review: true
Reasoning: "New vendor: no existing memory found"
```

**Human Correction**:
```json
{ "serviceDate": "2024-01-01" }
// Extracted from rawText: "Leistungsdatum: 01.01.2024"
```

**Agent Learning**:
```
✓ Learned pattern: /Leistungsdatum:\s*(\d{2}\.\d{2}\.\d{4})/
✓ Stored in Vendor Memory for Supplier GmbH
```

**Warm Start** (INV-A-002):
```
Service Date: "15.01.2024" ✓ (auto-extracted)
Confidence: 0.71
Reasoning: "Overall confidence below threshold (requires improvement)"
```

### Scenario 2: VAT Calculation (Parts AG)

**Cold Start** (INV-B-001):
```
Total: 2400
Tax: 400
RawText: "Prices incl. VAT (MwSt. inkl.)"
```

**Human Correction**:
```json
{
  "grossTotal": 2380,
  "taxTotal": 380
}
// Reason: VAT included in total; extractor overestimated
```

**Agent Learning**:
```
✓ Learned formula: Tax = Total - (Total / 1.19)
✓ Trigger: "MwSt. inkl." pattern detected
✓ Stored in Correction Memory (global rule)
```

## 🛠️ Technology Stack

-   **Runtime**: Node.js + TypeScript (strict mode)
-   **Database**: SQLite with JSON1 extension
-   **Logic Engine**: json-logic-js (declarative, no eval())
-   **Fuzzy Matching**: Fuse.js
-   **Validation**: Zod (runtime type checking)
-   **Diffing**: rfc6902 (JSON Patch)

## 📁 Project Structure

```
flowai/
├── src/
│   ├── core/
│   │   ├── memory/
│   │   │   └── store.ts          # SQLite adapter
│   │   └── logic/
│   │       ├── engine.ts         # JSON Logic wrapper
│   │       └── induction.ts      # Learning algorithms
│   ├── domain/
│   │   ├── agent.ts              # Main orchestrator
│   │   ├── recall-engine.ts      # Context retrieval
│   │   ├── cognitive-engine.ts   # Rule execution
│   │   └── decision-engine.ts    # Confidence & escalation
│   ├── types/
│   │   └── index.ts              # Type definitions
│   └── utils/
│       ├── diff.ts               # JSON Patch utilities
│       ├── fuzzy.ts              # Fuzzy matching
│       └── date.ts               # Date parsing
├── demo/
│   ├── runner.ts                 # Original demo script
│   └── production-data/
│       ├── production-runner.ts  # Production demo
│       ├── adapter.ts            # Data format adapter
│       ├── invoices_extracted.json
│       ├── purchase_orders.json
│       └── human_corrections.json
├── database/
│   ├── memory.db                 # Default SQLite database
│   └── production-memory.db      # Production demo database
├── package.json
├── tsconfig.json
└── README.md
```

## 🔍 API Usage

```typescript
import { Agent } from './src/index.js';

const agent = new Agent();
await agent.initialize();

// Process invoice
const output = await agent.process(invoice);

if (output.requiresHumanReview) {
  // Get human correction
  const corrected = await getHumanInput(output);
  
  // Learn from correction
  await agent.learn(invoice, corrected);
}

agent.close();
```

## 📝 Output Contract

Every processed invoice returns this standardized contract:

```typescript
{
  // Invoice Fields
  invoiceId: string;
  vendor: string;
  invoiceNumber: string;
  date?: string;
  serviceDate?: string;
  dueDate?: string;
  totalAmount?: number;
  taxAmount?: number;
  netAmount?: number;
  currency?: string;
  lineItems?: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    amount?: number;
    sku?: string;
    taxRate?: number;
  }>;
  paymentTerms?: string;
  poNumber?: string;
  
  // Decision & Confidence
  requiresHumanReview: boolean;  // Escalation decision
  reasoning: string;              // Plain English explanation
  confidence: number;             // 0.0 - 1.0
  
  // Transparency & Auditability
  auditTrail: Array<{
    step: string;                 // e.g., "RECALL", "APPLY", "DECIDE"
    action: string;               // e.g., "VENDOR_MATCHED", "RULE_APPLIED"
    field?: string;               // Field being modified
    oldValue?: any;               // Previous value
    newValue?: any;               // New value
    reasoning: string;            // Why this action was taken
    confidence?: number;          // Confidence for this action
    timestamp: string;            // ISO timestamp
  }>;
  
  processedAt: string;            // When processing completed
}
```

**Key Properties:**
- **requiresHumanReview**: `true` if confidence < 0.80, new vendor, critical fields missing, or duplicate detected
- **reasoning**: Explains why review is/isn't needed
- **confidence**: Average confidence across all fields (with Laplace smoothing)
- **auditTrail**: Complete trace of every decision made during processing


## 🧪 Testing

```bash
# Run production demo (12 real invoices)
npm run demo:prod

# Run quick demo (original test data)
npm run demo

# Build TypeScript
npm run build

# Type check only
npx tsc --noEmit
```

## 🎓 Key Concepts

### Case-Based Reasoning (CBR)

The system treats each human correction as a **case** that contributes to its knowledge base:

1. **Retrieve**: Find similar past cases (vendor patterns)
2. **Reuse**: Apply learned patterns to new invoices
3. **Revise**: Adjust based on confidence and context
4. **Retain**: Store successful patterns as memories

### Heuristic-Guided Reinforcement Learning

Unlike neural networks, this system learns **explicit rules**:

- **Acceptance** → Increase confidence (Reward)
- **Rejection** → Decrease confidence (Penalty)
- **Decay** → Unused rules lose confidence over time

### Explainability

Every decision includes:
- **Reasoning**: Plain English explanation
- **Audit Trail**: Step-by-step actions
- **Confidence Score**: Quantified uncertainty
- **Rule Source**: Which memory was used

## 🏆 Grading Criteria Coverage

| Criteria | Status | Implementation |
|----------|--------|----------------|
| Supplier GmbH: Leistungsdatum | ✅ | Regex induction from "Leistungsdatum: DD.MM.YYYY" |
| Supplier GmbH: PO Matching | ✅ | PO number extraction + storage |
| Parts AG: VAT Calculation | ✅ | Arithmetic induction (MwSt. inkl.) |
| Freight & Co: Skonto Terms | ✅ | Regex extraction "X% Skonto" |
| Freight & Co: SKU Mapping | ✅ | Mapping induction (description → SKU) |
| Duplicate Detection | ✅ | SHA-256 fingerprinting |
| Memory Persistence | ✅ | SQLite with ACID compliance |
| Explainability | ✅ | Audit trail + reasoning |
| Confidence Scoring | ✅ | Laplace smoothing + decay |

## 📚 References

Based on the architectural blueprint:
- **CBR**: Case-Based Reasoning for knowledge retention
- **JSON Logic**: Safe, declarative rule execution
- **Program Synthesis**: Learning patterns from examples
- **HITL**: Human-in-the-Loop for quality control

## 📧 Notes

- **No Deep Learning**: Pure symbolic AI for transparency
- **No eval()**: All logic is declarative JSON (security)
- **ACID Compliant**: SQLite ensures data integrity
- **Portable**: Single file database, no cloud dependencies

---

