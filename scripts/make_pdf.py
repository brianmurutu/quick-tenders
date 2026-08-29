import os
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

def build_pdf(filename="QUICK_TENDERS_6MIN_PITCH.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a')
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569')
    )

    badge_style = ParagraphStyle(
        'TimeBadge',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#1d4ed8'),
        alignment=TA_RIGHT
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=colors.HexColor('#1e293b')
    )

    section_badge_style = ParagraphStyle(
        'SecBadge',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#0369a1'),
        alignment=TA_RIGHT
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor('#334155')
    )

    bullet_style = ParagraphStyle(
        'BulletText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
        leftIndent=12
    )

    script_style = ParagraphStyle(
        'ScriptText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#1e3a8a')
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1e293b')
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#334155')
    )

    qa_q_style = ParagraphStyle(
        'QAQ',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#0f172a')
    )

    qa_a_style = ParagraphStyle(
        'QAA',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#475569')
    )

    story = []

    # Header section
    header_table_data = [
        [
            Paragraph("Quick Tenders — 6-Minute Pitch Guide", title_style),
            Paragraph("<b>⏱️ 6:00 TARGET</b>", badge_style)
        ],
        [
            Paragraph("Autonomous AI Agent for Tender Discovery, Relevance Matching & Bid Proposal Drafting", subtitle_style),
            ""
        ]
    ]
    header_table = Table(header_table_data, colWidths=[420, 120])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('SPAN', (0,1), (1,1)),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2563eb'), spaceBefore=0, spaceAfter=10))

    # Timeline Table
    timeline_data = [
        [Paragraph("Time", table_header_style), Paragraph("Phase", table_header_style), Paragraph("Focus & Core Deliverable", table_header_style)],
        [Paragraph("<b>0:00 – 0:45</b>", table_cell_style), Paragraph("<b>1. The Problem</b>", table_cell_style), Paragraph("Fragmented portals (PPIP/County), missed deadlines, 16+ hrs bid drafting friction", table_cell_style)],
        [Paragraph("<b>0:45 – 1:45</b>", table_cell_style), Paragraph("<b>2. The Solution</b>", table_cell_style), Paragraph("Quick Tenders overview: Continuous discovery + AI scoring + automated bid drafting", table_cell_style)],
        [Paragraph("<b>1:45 – 3:15</b>", table_cell_style), Paragraph("<b>3. Live Workflow</b>", table_cell_style), Paragraph("Feed Ingestion &rarr; LLM Fit Score &rarr; Zero-Touch Editable DOCX &rarr; SMS/Email alerts", table_cell_style)],
        [Paragraph("<b>3:15 – 4:15</b>", table_cell_style), Paragraph("<b>4. Architecture</b>", table_cell_style), Paragraph("Next.js 14, Supabase RLS multi-tenancy, Groq/Llama 3.3 + xAI Grok, zero-dep DOCX writer", table_cell_style)],
        [Paragraph("<b>4:15 – 5:15</b>", table_cell_style), Paragraph("<b>5. Market & ROI</b>", table_cell_style), Paragraph("Paystack billing, regional SME contract focus, time saved from 16 hrs to 15 mins", table_cell_style)],
        [Paragraph("<b>5:15 – 6:00</b>", table_cell_style), Paragraph("<b>6. Roadmap & Close</b>", table_cell_style), Paragraph("Portal auto-submissions, win-rate analytics, compliance document vault, open for Q&A", table_cell_style)],
    ]
    t_table = Table(timeline_data, colWidths=[80, 110, 350])
    t_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')])
    ]))
    story.append(t_table)
    story.append(Spacer(1, 10))

    def make_section(title, time_badge, bullets, script):
        sec_header_data = [
            [Paragraph(f"<b>{title}</b>", h2_style), Paragraph(f"<b>{time_badge}</b>", section_badge_style)]
        ]
        sec_header = Table(sec_header_data, colWidths=[400, 140])
        sec_header.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE')
        ]))

        content = [sec_header, Spacer(1, 4)]
        for b in bullets:
            content.append(Paragraph(f"• {b}", bullet_style))
            content.append(Spacer(1, 2))

        script_table = Table([[Paragraph(f"<b>Script:</b> \"{script}\"", script_style)]], colWidths=[540])
        script_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#eff6ff')),
            ('LINELEFT', (0,0), (0,0), 3, colors.HexColor('#2563eb')),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))
        content.append(Spacer(1, 3))
        content.append(script_table)
        content.append(Spacer(1, 8))
        return KeepTogether(content)

    # Section 1
    story.append(make_section(
        "1. The Hook & The Problem",
        "0:00 – 0:45 (45s)",
        [
            "<b>Scale:</b> Billions in public & private tenders are published annually (PPIP, County portals).",
            "<b>Friction:</b> Fragmented feeds require manual daily checks; tight deadlines close without warning.",
            "<b>Overhead:</b> Drafting compliance proposals & technical skeletons takes 2–3 days per bid."
        ],
        "Every week, thousands of high-value tenders are posted across disjointed portals. For growing businesses, finding them in time and drafting compliance bids takes days of tedious paperwork. Most SMEs simply lack the staff to keep up."
    ))

    # Section 2
    story.append(make_section(
        "2. The Solution — Quick Tenders",
        "0:45 – 1:45 (60s)",
        [
            "<b>Core Concept:</b> Autonomous AI agent handling discovery, precision scoring, and proposal drafting.",
            "<b>Key Difference:</b> Not just an alert list—it writes the actual submission documents ready to submit.",
            "<b>Efficiency Gain:</b> Shrinks tender preparation time from <b>16+ hours down to 15 minutes</b>."
        ],
        "Quick Tenders solves this end-to-end. Our AI agent continuously monitors procurement feeds, matches opportunities against your company profile, and drafts the actual submission documents. You just review, sign, and send."
    ))

    # Section 3
    story.append(make_section(
        "3. Product Walkthrough & Workflow",
        "1:45 – 3:15 (90s)",
        [
            "<b>Smart Scoring:</b> Evaluates sector, industry, county proximity, and scale with fit scores (e.g. 85/100).",
            "<b>Instant DOCX Drafting:</b> Generates editable Word files (Cover Letter & Technical Proposal Skeleton).",
            "<b>Multi-Channel Alerts:</b> SMS (TextSMS) & Email (Resend) notifications with instant signed download links.",
            "<b>Pipeline CRM:</b> Tracks lifecycle states (New &rarr; Reviewed &rarr; Submitted) with deadline urgency flags."
        ],
        "Here's the workflow: When a relevant tender appears, Quick Tenders scores the match and drafts a custom Cover Letter and Technical Proposal. The user downloads the editable Word file, adds their pricing, and marks it submitted. One rep can now run a 20-tender pipeline without admin overhead."
    ))

    story.append(PageBreak())

    # Section 4
    story.append(make_section(
        "4. Technical Architecture & Engineering Highlights",
        "3:15 – 4:15 (60s)",
        [
            "<b>Stack:</b> Next.js 14 App Router, TypeScript, Tailwind CSS.",
            "<b>Multi-Tenant Security:</b> Supabase PostgreSQL with strict Row Level Security (RLS).",
            "<b>Dual-LLM Engine:</b> Groq (Llama 3.3 70B) for ultra-fast matching with automated fallback to xAI Grok.",
            "<b>Zero-Dependency DOCX Engine:</b> Native streaming XML/ZIP generator via Node zlib—no bulky libraries."
        ],
        "We built Quick Tenders for speed, security, and enterprise reliability. Company data is protected via Supabase RLS. We use a dual-LLM setup with Groq and xAI Grok for ultra-fast matching, and an in-house zero-dependency DOCX writer that generates proposals instantly."
    ))

    # Section 5
    story.append(make_section(
        "5. Business Model & Market Fit",
        "4:15 – 5:15 (60s)",
        [
            "<b>Monetization:</b> Subscription tiers powered by <b>Paystack</b> for seamless local & regional payments.",
            "<b>Target Audience:</b> SME contractors, suppliers, IT firms, healthcare distributors, and consultants.",
            "<b>Clear ROI:</b> Winning just one additional contract or saving 40+ staff hours/month delivers immediate 10x ROI."
        ],
        "Our focus is on regional contractors and suppliers where procurement makes up a large share of business revenue. We monetize through simple subscription tiers via Paystack. The return on investment is immediate—saving dozens of staff hours on every single tender."
    ))

    # Section 6
    story.append(make_section(
        "6. Roadmap & Closing",
        "5:15 – 6:00 (45s)",
        [
            "<b>Roadmap:</b> Direct e-procurement auto-submission, tender win-probability analytics, compliance document vault.",
            "<b>Vision:</b> Leveling the playing field so any ambitious business can compete and win public tenders."
        ],
        "Our mission is to level the playing field so every business can compete and win tenders. Thank you, and I’m ready for your questions!"
    ))

    # Q&A Box
    qa_header_data = [[Paragraph("<b>💡 Anticipated Q&A Cheat Sheet</b>", h2_style), Paragraph("<b>Presenter Reference</b>", section_badge_style)]]
    qa_header = Table(qa_header_data, colWidths=[400, 140])
    qa_header.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE')
    ]))

    qa_table_data = [
        [
            Paragraph("<b>Q: How are AI hallucinations prevented?</b><br/>Prompts strictly constrain the model to explicit tender requirements and verified profile data, generating editable Word drafts that keep humans firmly in the loop.", qa_q_style),
            Paragraph("<b>Q: Why editable DOCX instead of PDF?</b><br/>Real tender submissions require customized item pricing, schedules, and authorized signatures. Word documents provide an actionable working draft.", qa_q_style)
        ]
    ]
    qa_grid_table = Table(qa_table_data, colWidths=[265, 265])
    qa_grid_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))

    story.append(KeepTogether([qa_header, Spacer(1, 4), qa_grid_table]))

    doc.build(story)
    print(f"Successfully generated {filename}")

if __name__ == "__main__":
    build_pdf()
