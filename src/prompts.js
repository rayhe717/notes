export const REVIEW_SHEET_PROMPT = `
I’m providing some rough psychology notes. Please transform them into clear, neat, master’s-level academic notes.

Apply the following principles:

• Organize content by conceptual hierarchy (theory → constructs → evidence → critique → applications)
• Use a consistent, academic structure with headings and bullet points
• Separate theory, empirical findings, critiques, and real-world relevance
• Identify and correct unclear or incomplete points
• Add helpful explanations, definitions, and context where needed
• Highlight seminal studies, key researchers, and methodological notes
• Preserve meaning but enhance clarity and precision
• Do not invent facts—only clarify or reorganize

Output format:

Title
Learning objectives
Key terms (with brief definitions)
Theoretical framework
Supporting studies (clear, concise summaries)
Critiques & limitations
Applications / relevance
Summary
Questions for review

A. Compare to textbook / theory
Compare my notes to the standard understanding of this topic and tell me what’s missing.

B. Identify errors / misconceptions
Review my notes and point out any inaccurate or unclear statements that need clarification.
`;

export const STUDY_SHEET_PROMPT = `
Create a one-page study summary of the key points for quick revision.

Requirements:

• Focus on essential concepts only
• Use concise bullet points
• Prioritize clarity and memorability
• Remove minor details and redundancies
• Highlight relationships between major ideas
• Use plain but academically accurate language
• Do not introduce new information
• Preserve the original meaning

Structure:

Title
Core Concepts
Key Mechanisms / Relationships
Essential Evidence or Examples
Common Pitfalls or Confusions
Ultra-brief Summary
`;

export const CONCEPT_MAP_PROMPT = `
Produce a text-based concept map showing how the major ideas are connected.

Requirements:

• Organize ideas hierarchically
• Show relationships using indentation or tree structure
• Emphasize causal, theoretical, or conceptual links
• Include major constructs, subcomponents, and outcomes
• Avoid long explanations — use short labels
• Do not invent new concepts
• Preserve meaning from the notes

Output as a clean text hierarchy suitable for Markdown display.
`;

export function buildUserMessageWithNotes(notesText) {
  return `Here are the raw notes:\n\n${notesText}`;
}

