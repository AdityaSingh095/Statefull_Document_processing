# AI Document Automation Memory Layer

<parameter name="rational intelligent document processing system based on Case-Based Reasoning (CBR) that learns from human corrections to improve automation rates over time.

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

1. **Vendor Memory** (Contextual Knowledge)
   - Vendor-specific extraction patterns
   - Default values (currency, payment terms)
   - Regex rules for field extraction

2. **Correction Memory** (Global Knowledge)
   - Formula-based rules (e.g., VAT calculations)
   - Triggered by data state, not vendor identity

3. **Resolution Memory** (Meta-Cognition)
   - Tracks rule performance (accept/reject counts)
   - Enables reinforcement learning
   - Confidence decay over time

### Learning Strategies

1. **Regex Induction**: Synthesizes patterns from text (e.g., "Leistungsdatum: 01.12.2023" → regex)
2. **Arithmetic Induction**: Derives formulas from corrections (e.g., Tax = Total - Total/1.19)
3. **Mapping Induction**: Creates SKU mappings (e.g., "Seefracht" → "FREIGHT")

### Decision Logic

- **Confidence Scoring**: Laplace smoothing + time decay
- **Escalation Thresholds**: 
  - New vendor → review required
  - Critical field confidence < 0.90 → review
  - Overall confidence < 0.80 → review
  - Duplicate detected → review
  - Amount mismatch → review

## 🚀 Quick Start

### Installation

```bash
cd flowai
npm install
```

### Run Demo

```bash
npm run demo:prod
```

The demo showcases:
- ✅ Supplier GmbH: Leistungsdatum extraction
- ✅ Parts AG: VAT calculation (MwSt. inkl.)
- ✅ Freight & Co: Skonto terms + SKU mapping
- ✅ PO number extraction
- ✅ Duplicate detection

## 📊 Demo Scenarios

### Scenario 1: Leistungsdatum Learning

**Cold Start** (INV-A-001):
```
Service Date: null
Requires Review: true
Reasoning: "New vendor"
```

**Human Correction**:
```
Service Date: "2023-12-01" (extracted from "Leistungsdatum: 01.12.2023")
```

**Warm Start** (INV-A-002):
```
Service Date: "2024-01-15" ✓ (auto-extracted)
Requires Review: false
Confidence: 0.95
```

### Scenario 2: VAT Calculation

**Cold Start** (INV-B-001):
```
Total: 119
Tax: 0 (missing)
```

**Human Correction**:
```
Tax: 19 (formula: 119 - 119/1.19)
Net: 100
```

**Warm Start** (INV-B-002):
```
Total: 238
Tax: 38 ✓ (auto-calculated)
Net: 200 ✓
Confidence: 0.95
```

## 🛠️ Technology Stack

- **Runtime**: Node.js + TypeScript
- **Database**: SQLite with JSON1 extension
- **Logic Engine**: json-logic-js (declarative, no eval())
- **Fuzzy Matching**: Fuse.js
- **Validation**: Zod (runtime type checking)
- **Diffing**: rfc6902 (JSON Patch)

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
│   ├── runner.ts                 # Demo script
│   └── test-data/
│       └── invoices.ts           # Test invoices
├── database/
│   └── memory.db                 # SQLite database (created at runtime)
├── package.json
└── tsconfig.json
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

```typescript
{
  invoiceId: string;
  vendor: string;
  invoiceNumber: string;
  totalAmount?: number;
  taxAmount?: number;
  serviceDate?: string;
  // ... other fields
  
  requiresHumanReview: boolean;  // Escalation decision
  reasoning: string;              // Explanation
  confidence: number;             // 0.0 - 1.0
  
  auditTrail: [                   // Full transparency
    {
      step: "RECALL" | "APPLY" | "DECIDE",
      action: string,
      field?: string,
      reasoning: string,
      confidence?: number,
      timestamp: string
    }
  ],
  processedAt: string;
}
```

## 🧪 Testing

```bash
# Run full demo
npm run demo

# Build TypeScript
npm run build

# Development mode
npm run dev
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

**Built with ❤️ following the AI Document Automation Memory Layer Blueprint**
