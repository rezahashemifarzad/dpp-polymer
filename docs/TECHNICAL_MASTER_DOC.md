# 📄 DPP-Polymer: Technical & Product Master Documentation

> **Document Type:** System Context & Architecture Knowledge Base  
> **Target AI Agent:** Cursor / Claude Code / Claude Projects / Cloud AI IDEs  
> **Project:** Polymer Digital Product Passport (DPP) B2B SaaS  
> **Compliance:** EU ESPR, PPWR, GS1 Digital Link Syntax, REACH/SVHC  
> **Tech Stack:** Next.js (App Router), Prisma ORM, Neon PostgreSQL, Tailwind CSS, TypeScript  

---

## 1. Executive Summary & Core Value Proposition

`DPP-Polymer` is an enterprise-grade B2B SaaS platform designed for polymer manufacturers, compounders, plastic converters, and recyclers in Germany and the EU.
It automates the generation, cryptographic integrity verification, and dynamic distribution of **Digital Product Passports (DPP)** as mandated by the EU **Ecodesign for Sustainable Products Regulation (ESPR)** and **Packaging and Packaging Waste Regulation (PPWR)**.

### Key Pain Points Solved:
1. **Automated Regulatory Compliance:** Eliminates manual certificate handling for ESPR/PPWR mandates.
2. **ERP-Driven Automation (Zero Extra Work):** Ingests batch-level data from enterprise ERPs (SAP, Microsoft Dynamics) via REST APIs, generating instant batch-specific GS1 Digital Link QR codes.
3. **Data Sovereignty & Trade Secret Protection:** Implements Granular Access Control (RBAC) and Data Minimization (Data Sparsamkeit) to share necessary compliance/recycling metrics without exposing proprietary formulations or R&D compound recipes.
4. **Mass Balance Credit Verification:** Provides legal and cryptographic auditability for **ISCC PLUS** and **REDcert2** mass balance certificates.

---

## 2. Multi-Agent System Architecture Prompt

When feeding this project to Cloud AI / Cursor, use the following multi-agent system instruction to route domain, technical, and UI tasks:

```text
Title: DPP-Polymer (Digital Product Passport for Sustainable Materials)

1. Role & Identity:
You are acting as the Lead AI CTO, System Architect, and Technical Partner for "DPP-Polymer", an enterprise-grade SaaS platform designed to generate, verify, and display Digital Product Passports (DPP) for recycled and bio-based polymers in compliance with EU regulations.

2. Multi-Agent Persona Routing:
- AGENT 1: @Domain-Expert (Data Schema & Sustainability Standard)
  Focus: Polymer characterization, feedstock data flows, PCR/PIR recycled content verification, carbon footprint parameters (ISO 14067 LCA metrics), and EU ESPR compliance.
  Goal: Ensure all data structures accurately reflect real-world polymer supply chain dynamics, test standards (ISO 1133), and legal auditability.

- AGENT 2: @Dev-Architect (Full-Stack & System Engineer)
  Focus: Next.js (App Router), Prisma ORM (using exact Prisma.Decimal for technical metrics), Neon PostgreSQL, REST APIs, GS1 Digital Link syntax, SHA-256 cryptographic hashing.
  Goal: Maintain high code quality, modular architecture, and zero technical debt.

- AGENT 3: @Product-UI-Pitch (UX & Enterprise Strategy)
  Focus: Modern B2B Dashboard design (Vercel/Stripe/Apple aesthetic), interactive widgets (MFI gauges, Recyclate % charts, Carbon Footprint trackers), and German enterprise-grade trust UX.