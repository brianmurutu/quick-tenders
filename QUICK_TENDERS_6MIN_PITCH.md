# Quick Tenders — 6-Minute Presentation Cue Sheet

**Total Time:** 6:00 | **Goal:** Clear, high-impact product & tech walkthrough

---

## ⏱️ Timeline Summary

| Time | Phase | Focus |
| :--- | :--- | :--- |
| **0:00 – 0:45** | The Problem | High-friction procurement & missed deadlines for SMEs |
| **0:45 – 1:45** | The Solution | Quick Tenders: AI agent for discovery + matching + drafting |
| **1:45 – 3:15** | Product Walkthrough | Feed ingestion $\rightarrow$ AI scoring $\rightarrow$ editable DOCX bid |
| **3:15 – 4:15** | Tech Architecture | Next.js, Supabase RLS, Groq/Grok fallback, zero-dep DOCX |
| **4:15 – 5:15** | Market & Business | Paystack billing, regional SME fit, 16h $\rightarrow$ 15min ROI |
| **5:15 – 6:00** | Roadmap & Close | Auto-submit integrations, pricing intelligence, Q&A |

---

## 🎤 Minute-by-Minute Talking Points & Script

### 1. The Problem (0:00 – 0:45)
* **Context:** Billions in public/private tenders are published annually (PPIP, County portals).
* **Pain Points:**
  * **Fragmented feeds:** Manual searching across dozens of websites daily.
  * **Hard deadlines:** Missed opportunities because tenders close without notice.
  * **Heavy overhead:** Drafting 20+ page compliance proposals takes 2–3 days per bid.
* **Speaker Script:**
  > *"Every week, thousands of high-value tenders are posted across disjointed portals. For growing businesses, finding them in time and drafting compliance bids takes days of tedious paperwork. Most SMEs simply lack the staff to keep up."*

---

### 2. The Solution: Quick Tenders (0:45 – 1:45)
* **What it is:** An autonomous AI agent that discovers, scores, and drafts full tender proposals.
* **Core Value:** Reduces tender preparation time from **16+ hours to 15 minutes** of human review.
* **Key Distinction:** Not just an alert newsletter—it produces actionable, ready-to-submit bids.
* **Speaker Script:**
  > *"Quick Tenders solves this end-to-end. Our AI agent continuously monitors procurement feeds, matches opportunities against your company profile, and drafts the actual submission documents. You just review, sign, and send."*

---

### 3. Product Walkthrough & Workflow (1:45 – 3:15)
* **Step 1: Intelligent Discovery & Match Scoring**
  * Evaluates tenders based on company industry, sector, county proximity, and scale.
  * Generates an objective fit score (e.g., 85/100) and an executive summary.
* **Step 2: Instant DOCX Bid Drafting**
  * Produces editable Microsoft Word (`.docx`) files: **Cover Letter** and **Technical Proposal Skeleton**.
  * Editable format allows teams to insert custom pricing and signatures immediately.
* **Step 3: Multi-Channel Alerts & Status Pipeline**
  * Instant SMS (TextSMS) and Email (Resend) alerts with secure signed links.
  * Built-in CRM tracking (*New* $\rightarrow$ *Reviewed* $\rightarrow$ *Submitted*).
* **Speaker Script:**
  > *"Here's the workflow in action: When a relevant tender appears, Quick Tenders scores the match and drafts a custom Cover Letter and Technical Proposal. The user downloads the editable Word file, adds their pricing, and marks it submitted. One rep can now run a 20-tender pipeline without any admin overhead."*

---

### 4. Technical Architecture (3:15 – 4:15)
* **Frontend/Backend:** Next.js 14 App Router, TypeScript, Tailwind CSS.
* **Database & Security:** Supabase PostgreSQL with strict **Row Level Security (RLS)** for multi-tenant data isolation.
* **Dual-LLM Engine:** Fast inference via **Groq (Llama 3.3 70B)** with zero-downtime fallback to **xAI Grok**.
* **Zero-Dependency DOCX Engine:** Pure Node.js streaming XML/ZIP generator (`zlib`)—no bulky external dependencies.
* **Speaker Script:**
  > *"We built Quick Tenders for speed, security, and enterprise reliability. Company data is protected via Supabase RLS. We use a dual-LLM setup with Groq and xAI Grok for ultra-fast matching, and an in-house zero-dependency DOCX writer that generates proposals instantly."*

---

### 5. Business Model & Market Fit (4:15 – 5:15)
* **Monetization:** Subscription tiers powered by **Paystack** for seamless local and regional payments.
* **Target Audience:** Contractors, suppliers, IT firms, healthcare distributors, and consultants.
* **ROI:** Winning just one additional contract or saving 40+ staff hours/month delivers immediate 10x ROI.
* **Speaker Script:**
  > *"Our focus is on regional contractors and suppliers where procurement makes up a large share of business revenue. We monetize through simple subscription tiers via Paystack. The return on investment is immediate—saving dozens of staff hours on every single tender."*

---

### 6. Roadmap & Closing (5:15 – 6:00)
* **Next Steps:**
  * Direct e-procurement auto-submission.
  * Historical tender pricing intelligence and win-rate analysis.
  * Automated compliance document vault (tax compliance, business permits).
* **Speaker Script:**
  > *"Our mission is to level the playing field so every business can compete and win tenders. Thank you, and I’m ready for your questions!"*

---

## 💡 Quick Q&A Cheat Sheet

* **Q: How do you prevent AI hallucinations in bids?**
  * *A: The prompts strictly bind the LLM to tender requirements and company profile data, generating structured, editable Word docs so humans remain firmly in the loop.*
* **Q: Why DOCX instead of PDF?**
  * *A: Real tender submissions require customized item pricing, schedules, and authorized signatures. Word documents are practical and ready to edit.*
