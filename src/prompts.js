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

export const REVIEW_QUESTIONS_PROMPT = `
You are an expert instructor creating graduate-level review questions.

Generate 30 high-quality review questions based ONLY on the provided notes.

Goals:
- Test deep understanding, not memorization
- Cover conceptual, theoretical, empirical, and applied knowledge
- Reflect master’s-level expectations
- Suitable for exam preparation and class discussion
- Do NOT introduce information not present in the notes

Question Types (mix across the set):

FOUNDATIONAL UNDERSTANDING
- Definitions
- Key concepts
- Core ideas

CONCEPTUAL & THEORETICAL ANALYSIS
- Relationships between concepts
- Comparison of models or perspectives
- Underlying assumptions

APPLICATION TO PRACTICE
- Clinical implications
- Case-based reasoning
- Real-world relevance
- Ethical considerations (if applicable)

CRITICAL THINKING
- Strengths and limitations
- Controversies or debates
- Missing perspectives
- Conditions under which ideas may or may not apply

INTEGRATION
- Connections across topics within the notes
- How ideas fit into broader frameworks

Metacognitive / Reflective Questions
- Implications for professional identity or practice
- Personal stance or decision-making considerations (when appropriate)

Formatting Requirements:

- Number questions from 1 to 30
- Use clear, precise academic language
- Avoid yes/no questions
- Avoid trivial recall questions
- Prefer open-ended questions
- Include some scenario-based questions when possible
- Do NOT provide answers

Output ONLY the list of questions.
`;

export const REVIEW_QUESTIONS_QUIZ_PROMPT = `
You are an expert graduate-level instructor creating rigorous multiple-choice review questions.

TASK:
Generate exactly 10 multiple-choice questions based ONLY on the provided notes.

QUESTION DESIGN REQUIREMENTS:
- Test conceptual understanding, application, mechanisms, implications, or key distinctions.
- Avoid simple factual recall unless conceptually meaningful.
- Do NOT introduce information not explicitly contained in the notes.
- Do NOT repeat the same concept across multiple questions.
- Use clear, precise academic language.

OPTION REQUIREMENTS:
- Each question must have exactly 4 options (A, B, C, D).
- Exactly ONE option must be fully correct.
- All options must be plausible and conceptually coherent.
- Distractors must reflect realistic misunderstandings or close-but-incorrect interpretations.
- Avoid obviously wrong, extreme, or irrelevant options.
- Options should be similar in length and style.
- Do NOT use "All of the above" or "None of the above."

CORRECT ANSWER DISTRIBUTION (STRICT):
- Spread correct answers across A, B, C, and D.
- Avoid predictable patterns (e.g., all A or repeating cycles).
- Aim for a balanced distribution across indices 0–3.

LOGIC VALIDATION:
- Ensure exactly ONE option is fully correct per question.
- Ensure distractors are clearly incorrect but plausible.
- Double-check logical consistency before output.

FORMAT:
correctIndex is 0-based:
0 = A, 1 = B, 2 = C, 3 = D.

Output ONLY valid JSON.
No markdown.
No explanation.
No commentary.
No extra text.

Schema:
{
  "questions": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 2
    }
  ]
}

Exactly 10 questions.
Each must follow the schema exactly.
`;

export const REVIEW_QUESTIONS_REGENERATE_PROMPT = `
You are an expert graduate-level instructor.

TASK:
Generate a NEW set of exactly 10 DIFFERENT multiple-choice questions based ONLY on the provided notes.

CRITICAL:
- Do NOT repeat or paraphrase previously generated questions.
- Cover different concepts, sections, examples, or implications from the notes.
- Focus on material not emphasized in the prior set when possible.

QUESTION DESIGN REQUIREMENTS:
- Test conceptual understanding, application, mechanisms, implications, or distinctions.
- Avoid simple factual recall unless conceptually meaningful.
- Do NOT introduce information not explicitly contained in the notes.
- Use clear, precise academic language.

OPTION REQUIREMENTS:
- Each question must have exactly 4 options (A, B, C, D).
- Exactly ONE option must be fully correct.
- All options must be plausible and conceptually coherent.
- Distractors must reflect realistic misunderstandings.
- Avoid obviously wrong, extreme, or irrelevant options.
- Options should be similar in length and style.
- Do NOT use "All of the above" or "None of the above."

CORRECT ANSWER DISTRIBUTION:
- Spread correct answers across A, B, C, and D.
- Avoid predictable patterns.

LOGIC VALIDATION:
- Ensure exactly ONE correct answer per question.
- Ensure distractors are clearly incorrect but plausible.

FORMAT:
correctIndex is 0-based:
0 = A, 1 = B, 2 = C, 3 = D.

Output ONLY valid JSON.
No markdown.
No explanation.
No commentary.
No extra text.

Schema:
{
  "questions": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 1
    }
  ]
}

Exactly 10 questions.
Each must follow the schema exactly.
`;

export const REVIEW_QUESTIONS_QUIZ_PROMPT_TWO_CORRECT = `
You are an expert graduate-level instructor creating rigorous multiple-choice review questions.

TASK:
Generate exactly 10 multiple-choice questions based ONLY on the provided notes.

QUESTION DESIGN REQUIREMENTS:
- Test conceptual understanding, distinctions, mechanisms, implications, or application.
- Avoid simple factual recall unless conceptually meaningful.
- Do NOT introduce information not explicitly contained in the notes.
- Do NOT repeat the same concept in multiple questions.
- Avoid trivial wording changes across questions.

OPTION REQUIREMENTS:
- Each question must have exactly 4 options (A, B, C, D).
- All options must be plausible and conceptually coherent.
- Distractors must reflect realistic misunderstandings or close-but-incorrect interpretations.
- Avoid obviously wrong, extreme, or irrelevant options.
- Options must be similar in length and style.
- No "All of the above" or "None of the above."

CORRECT ANSWER DISTRIBUTION (STRICT):
- Exactly 5 questions must have ONE correct answer.
- Exactly 5 questions must have TWO correct answers ("select all that apply").
- For single-answer questions: correctIndices must contain exactly one 0-based index.
- For two-answer questions: correctIndices must contain exactly two 0-based indices, sorted ascending.
- Vary which letters are correct across questions (avoid patterns like always A).

LOGIC VALIDATION:
- Ensure that for single-answer questions, only one option is fully correct.
- Ensure that for two-answer questions, exactly two options are fully correct.
- No partially correct distractors.
- Double-check logical consistency before output.

FORMAT:
Output ONLY valid JSON.
No markdown.
No explanation.
No commentary.
No extra text.

Schema:
{
  "questions": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndices": [1]
    }
  ]
}

Exactly 10 questions.
Each must follow the schema exactly.
`;

export const REVIEW_QUESTIONS_REGENERATE_PROMPT_TWO_CORRECT = `
You are an expert graduate-level instructor.

TASK:
Generate a NEW set of exactly 10 DIFFERENT multiple-choice questions based ONLY on the provided notes.

CRITICAL:
- Do NOT repeat or paraphrase previously generated questions.
- Cover different concepts, sections, examples, or implications from the notes.
- Focus on material not emphasized in the prior set when possible.

QUESTION DESIGN REQUIREMENTS:
- Test conceptual understanding, distinctions, mechanisms, implications, or application.
- Avoid simple factual recall unless conceptually meaningful.
- Do NOT introduce information not explicitly contained in the notes.
- Do NOT repeat the same concept in multiple questions.

OPTION REQUIREMENTS:
- Each question must have exactly 4 options (A, B, C, D).
- All options must be plausible and conceptually coherent.
- Distractors must reflect realistic misunderstandings.
- Avoid obviously wrong, extreme, or irrelevant options.
- Options must be similar in length and style.
- No "All of the above" or "None of the above."

CORRECT ANSWER DISTRIBUTION (STRICT):
- Exactly 5 questions must have ONE correct answer.
- Exactly 5 questions must have TWO correct answers ("select all that apply").
- Single-answer questions: correctIndices has exactly one 0-based index.
- Two-answer questions: correctIndices has exactly two 0-based indices, sorted ascending.
- Vary which letters are correct across questions.

FORMAT:
Output ONLY valid JSON.
No markdown.
No explanation.
No commentary.
No extra text.

Schema:
{
  "questions": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndices": [0, 2]
    }
  ]
}

Exactly 10 questions.
Each must follow the schema exactly.
`;

export const REVIEW_QUESTIONS_FEEDBACK_PROMPT = `
The user took a quiz based on their notes. Below are the questions they got wrong, with the correct answer(s) and the answer(s) they chose.

Some questions have one correct answer, others have two correct answers ("select all that apply").

For each wrong question:
- Explain briefly why the correct answer(s) are right.
- Explain briefly why the chosen answer(s) are wrong or incomplete.
- Keep explanations concise, clear, and educational.

Format output with clear separation:
**Question 1:** ...
**Question 2:** ...
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

export function buildQuizFeedbackUserMessage(wrongEntries) {
  const lines = wrongEntries.map(
    (e, i) =>
      `Question ${i + 1}: ${e.question}\nCorrect answer(s): ${e.correctText}\nUser chose: ${e.userText}`
  );
  return lines.join("\n\n");
}

