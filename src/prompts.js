export const REVIEW_SHEET_PROMPT = `
Transform the following rough notes into master’s-level academic notes for a course on Spirituality in Psychotherapy.

Use a CLINICAL INTEGRATION format optimized for therapists, not a strict hierarchy.

GENERAL PRINCIPLES
• Preserve original meaning — do not invent information
• Improve clarity, precision, and academic tone
• Integrate conceptual, clinical, ethical, and experiential elements
• Highlight key models, tools, and distinctions
• Organize for real-world clinical application and exam preparation

OUTPUT IN MARKDOWN WITH THE FOLLOWING STRUCTURE:

## Core Focus / Essential Questions
Identify the central clinical or conceptual issues addressed by this material.

## Key Concepts & Definitions
Clarify major terms (e.g., spirituality, transcendence, meaning, spiritual health, etc.).

## Clinical Significance
Explain why this material matters in psychotherapy:
• Impact on assessment
• Treatment outcomes
• Client well-being
• Diagnostic considerations

## Theoretical & Conceptual Frameworks
Organize major models, domains, or perspectives described in the notes.

## Assessment & Clinical Tools
Summarize any structured approaches, frameworks, or instruments 
(e.g., spiritual history taking, FICA, HOPE model).

## Therapeutic Applications
Describe how spirituality is integrated into practice:
• Intervention approaches
• Communication strategies
• Cultural considerations
• Collaboration with spiritual resources

## Ethical & Professional Issues
Include boundaries, risks, and ethical principles relevant to practice.

## Risks, Challenges, or Misuse
Identify potential harms, misinterpretations, or clinical pitfalls.

## Experiential & Person-of-Therapist Factors
Explain the role of therapist self-awareness, personal beliefs, and presence.

## Connections & Integration
Explain how biological, psychological, social, and spiritual dimensions interact.

## Cue Questions (Active Recall)
Generate concise exam-style questions covering key ideas.

## Summary
Provide a concise synthesis of the big picture and clinical implications.

Here are the raw notes:
`;

export const STUDY_SHEET_PROMPT = `
Create a one-page graduate-level study sheet for a course on Spirituality in Psychotherapy.

The summary must be clinically relevant, conceptually integrative, and suitable for exam revision or professional practice.

Organize the sheet into the following sections:

1) CORE THEMES & BIG IDEAS
Summarize the major overarching ideas (not just topics). Highlight tensions, debates, and integrative perspectives in the field.

2) KEY CONCEPTS & DEFINITIONS
List essential concepts with precise, graduate-level definitions. Include distinctions between related terms when important (e.g., spirituality vs religion, ethical vs harmful spirituality).

3) CLINICAL APPLICATIONS
Explain how the material applies to psychotherapy practice:
- Assessment considerations
- Intervention approaches
- Therapist stance and competencies
- Cultural/spiritual sensitivity
- Risk management

4) ETHICAL & PROFESSIONAL ISSUES
Summarize ethical boundaries, potential harms, dual-role risks, and guidelines for responsible integration of spirituality.

5) CASE-RELEVANT INSIGHTS
Extract ideas that would help analyze or respond to clinical vignettes.

6) KEY AUTHORS / MODELS / FRAMEWORKS (if present)
List major theorists, models, or therapeutic approaches mentioned.

7) CRITICAL REFLECTION POINTS
Include controversies, limitations, or areas requiring nuanced judgment.

Formatting requirements:
- Use concise bullet points
- Avoid unnecessary filler
- Prioritize conceptual clarity over detail overload
- Suitable for quick revision before an exam or supervision
- Maintain professional graduate-level language
`;

export const CONCEPT_MAP_PROMPT = `
Produce a text-based concept map for graduate-level material on Spirituality in Psychotherapy.

Focus on conceptual relationships rather than hierarchical outlines.

Requirements:

1) Identify the major concepts and themes.

2) Show how ideas relate using labeled connections such as:
   - influences
   - contrasts with
   - leads to
   - risks
   - supports
   - requires
   - part of
   - example of
   - ethical tension with

3) Highlight clinically meaningful relationships, not just theoretical ones.

4) Include cross-links between themes where relevant.

5) Use a readable text format such as:

MAIN IDEA
 ├─ relates to → Concept A
 │    ├─ requires → Condition B
 │    └─ may lead to → Outcome C
 ├─ contrasts with → Concept D
 └─ applied in → Clinical Practice E

6) If applicable, include sections for:
   - Therapist factors
   - Client factors
   - Contextual factors (culture, religion, power)
   - Risks vs benefits

Goal:
Provide a conceptual network that helps understand how major ideas interact in real psychotherapy settings.
`;

export const MULTI_NOTE_OUTLINE_PROMPT = `
You are an expert academic synthesizer.

Analyze ALL provided notes as a single body of material and produce a comprehensive outline that integrates the content across documents.

IMPORTANT:
- Do not summarize each note separately
- Merge overlapping ideas
- Resolve inconsistencies when possible
- Highlight relationships across sources
- Preserve important nuances

STEP 1 — Identify Major Themes
Detect the central topics that recur across the notes.

STEP 2 — Choose an Organizational Structure
If the material is structured and systematic → produce a HIERARCHICAL OUTLINE.
If the material is conceptual, interdisciplinary, or reflective → produce an INTEGRATIVE OUTLINE organized by themes and relationships.

STEP 3 — Generate the Outline

A) HIERARCHICAL OUTLINE (if appropriate)
Use a structured academic format:

I. Main Topic
   A. Subtopic
      1. Key point
      2. Supporting idea
   B. Subtopic

B) INTEGRATIVE OUTLINE (if more appropriate)
Organize by major themes and show connections:

THEME 1: [Name]
- Core ideas
- Contributions from different notes
- Tensions or differing perspectives
- Clinical or practical implications

THEME 2: [Name]
- Key insights
- Cross-links to other themes
- Conditions or contexts

STEP 4 — Cross-Cutting Insights
Add a section summarizing:

- Overarching principles
- Recurring patterns
- Contradictions or debates
- Gaps in the material
- Implications for practice or study

Formatting Requirements:
- Clear headings
- Concise bullet points
- No redundancy
- Graduate-level language
- Suitable for exam preparation or comprehensive review

Output ONLY the final integrated outline.
`;

export function buildUserMessageWithNotes(notesText) {
  return `Here are the raw notes:\n\n${notesText}`;
}

export function buildUserMessageWithMultipleNotes(entries) {
  const parts = entries.map(
    (e) => `--- Note: ${e.name} ---\n\n${e.text}`
  );
  return `The following are ${entries.length} separate notes. Please create one unified multi-note outline from them.\n\n${parts.join("\n\n")}`;
}

