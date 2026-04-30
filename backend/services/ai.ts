import { GoogleGenAI } from "@google/genai";
import { Question, createQuestionsInBatch } from "../repositories/curriculumRepo";

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

function cleanLikelyJson(raw: string): string {
  return (raw ?? "")
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
}

async function generateText(prompt: string): Promise<string> {
  const ai = getGenAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });
  return response.text ?? "";
}

// ─── Lesson Cards ─────────────────────────────────────────────────────────────

export type LessonCard = {
  title: string;
  content: string;
  latex?: string;
};

// ─── Mistake Diagnosis + Mini Drills ──────────────────────────────────────────

export type MistakeInsight = {
  questionId: string;
  mistakeTitle: string;
  whatWentWrong: string;
  likelyMisconception: string;
  fix: string;
  example: string;
};

export type MiniDrill = {
  prompt: string;
  hint: string;
  checkYourself: string;
  solution: string;
};

export type MistakePackage = {
  mistakes: MistakeInsight[];
  drills: MiniDrill[];
};

export async function generateMistakePackage(params: {
  topicName: string;
  subTopicName?: string;
  failedQuestions: { questionId?: string; text: string; studentAnswer?: string; correctAnswer?: string; aiReasoning?: string }[];
  contextType: "prereq" | "subtopic" | "finaltest";
}): Promise<MistakePackage> {
  const { topicName, subTopicName, failedQuestions, contextType } = params;
  const context = subTopicName ? `${topicName} > ${subTopicName}` : topicName;

  const failedList = failedQuestions
    .slice(0, 12)
    .map((q, i) => {
      const qid = q.questionId ? ` (id: ${q.questionId})` : "";
      return `${i + 1}. Question${qid}: ${q.text}` +
        (q.studentAnswer ? `\n   Student answered: ${q.studentAnswer}` : "") +
        (q.correctAnswer ? `\n   Correct answer: ${q.correctAnswer}` : "") +
        (q.aiReasoning ? `\n   Prior grading feedback: ${q.aiReasoning}` : "");
    })
    .join("\n\n");

  const prompt = `You are an expert math tutor for school students. A student failed a ${contextType} quiz on "${context}".

You will diagnose the student's mistakes and create mini-practice drills to fix them.

Failed questions:
${failedList}

Rules:
- Be concise, clear, and step-by-step.
- Use LaTeX for math where helpful ($...$ inline, $$...$$ block).
- Return STRICT JSON only. No markdown. No extra keys.
- Keep text short: each field <= 400 characters.
- drills: produce 4 to 8 drills total. Each drill must be directly related to the mistakes.

Respond in this exact JSON format:
{
  "mistakes": [
    {
      "questionId": "string (must match a provided question id when available; else use the question number like \\"q1\\")",
      "mistakeTitle": "short title",
      "whatWentWrong": "what the student did wrong",
      "likelyMisconception": "likely misconception",
      "fix": "how to fix it / correct approach",
      "example": "a tiny worked example (may use $...$)"
    }
  ],
  "drills": [
    {
      "prompt": "micro practice question",
      "hint": "one hint",
      "checkYourself": "final answer only",
      "solution": "brief worked steps"
    }
  ]
}`;

  try {
    const raw = await generateText(prompt);
    const cleaned = cleanLikelyJson(raw);
    const parsed = JSON.parse(cleaned);
    const mistakes = Array.isArray(parsed.mistakes) ? parsed.mistakes : [];
    const drills = Array.isArray(parsed.drills) ? parsed.drills : [];
    return {
      mistakes: mistakes as MistakeInsight[],
      drills: drills as MiniDrill[],
    };
  } catch {
    const fallbackMistakes: MistakeInsight[] = failedQuestions.slice(0, 8).map((q, idx) => ({
      questionId: q.questionId ?? `q${idx + 1}`,
      mistakeTitle: "Concept gap detected",
      whatWentWrong: "This answer did not match the expected method or result.",
      likelyMisconception: "A step, rule, or definition may be misapplied.",
      fix: "Review the key rule, then solve slowly step-by-step and re-check the final answer.",
      example: "Example: If $2(x+3)=14$, then $x+3=7$ so $x=4$.",
    }));

    const fallbackDrills: MiniDrill[] = [
      {
        prompt: `Warm-up: simplify $3(2x-1)$.`,
        hint: "Distribute 3 into both terms.",
        checkYourself: "$6x-3$",
        solution: "Distribute: $3\\cdot 2x=6x$ and $3\\cdot(-1)=-3$ so $6x-3$.",
      },
      {
        prompt: `Quick check: solve $x/5=7$.`,
        hint: "Multiply both sides by 5.",
        checkYourself: "$x=35$",
        solution: "Multiply both sides by 5: $x=7\\cdot 5=35$.",
      },
    ];

    return { mistakes: fallbackMistakes, drills: fallbackDrills };
  }
}

export async function generateLessonCards(params: {
  topicName: string;
  subTopicName?: string;
  failedQuestions: { text: string; studentAnswer?: string; correctAnswer?: string }[];
  contextType: "prereq" | "subtopic" | "finaltest";
}): Promise<LessonCard[]> {
  const { topicName, subTopicName, failedQuestions, contextType } = params;

  const context = subTopicName ? `${topicName} > ${subTopicName}` : topicName;
  const failedList = failedQuestions
    .map(
      (q, i) =>
        `${i + 1}. Question: ${q.text}${q.studentAnswer ? `\n   Student answered: ${q.studentAnswer}` : ""}${q.correctAnswer ? `\n   Correct answer: ${q.correctAnswer}` : ""}`
    )
    .join("\n\n");

  const prompt = `You are an expert math tutor for school students. A student failed a ${contextType} quiz on "${context}".

Failed questions:
${failedList}

Create 3-5 focused lesson cards to teach the student the concepts they missed. Each card should:
- Have a clear title
- Explain the concept simply and step-by-step
- Use LaTeX notation for math (enclosed in $...$ for inline, $$...$$ for block)
- Be encouraging and student-friendly

Respond in this exact JSON format (no markdown, just JSON):
{
  "cards": [
    {
      "title": "Card title",
      "content": "Explanation with $inline math$ and $$block math$$",
      "latex": "optional standalone formula if applicable"
    }
  ]
}`;

  try {
    const raw = await generateText(prompt);
    const cleaned = cleanLikelyJson(raw);
    const parsed = JSON.parse(cleaned);
    return parsed.cards as LessonCard[];
  } catch {
    return [
      {
        title: `Review: ${context}`,
        content: `Let's revisit the key concepts in ${context}. Focus on understanding each step carefully before attempting the quiz again.`,
      },
    ];
  }
}

// ─── Retake Quiz Generation ───────────────────────────────────────────────────

export async function generateRetakeQuestions(params: {
  topicName: string;
  subTopicName?: string;
  failedQuestions: { text: string; studentAnswer?: string; correctAnswer?: string }[];
  count?: number;
  contextType: "prereq" | "subtopic" | "finaltest";
  contextId: string;
}): Promise<string[]> {
  const { topicName, subTopicName, failedQuestions, count = 5, contextType, contextId } = params;

  const context = subTopicName ? `${topicName} > ${subTopicName}` : topicName;
  const failedList = failedQuestions
    .map((q, i) => `${i + 1}. ${q.text}`)
    .join("\n");

  const prompt = `You are an expert math teacher. A student struggled with these questions on "${context}":

${failedList}

Generate ${count} NEW multiple-choice questions that test the same concepts but with different numbers/scenarios. Questions must:
- Be at the same difficulty level
- Test the exact concepts the student got wrong
- Have clear, unambiguous correct answers
- Use LaTeX for any math notation ($...$ for inline)
- Include exactly 4 options (A, B, C, D)

Respond in this exact JSON format (no markdown, just JSON):
{
  "questions": [
    {
      "text": "Question text with $math$ if needed",
      "type": "mcq",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A"
    }
  ]
}`;

  try {
    const raw = await generateText(prompt);
    const cleaned = cleanLikelyJson(raw);
    const parsed = JSON.parse(cleaned);

    const questions: Omit<Question, "id" | "createdAt">[] = parsed.questions.map(
      (q: any, i: number) => ({
        contextType,
        contextId,
        text: q.text,
        type: "mcq" as const,
        options: q.options,
        correctAnswer: q.correctAnswer,
        order: i,
        isAIGenerated: true,
      })
    );

    return createQuestionsInBatch(questions);
  } catch {
    return [];
  }
}

// ─── Chat Response ────────────────────────────────────────────────────────────

export type ChatMessage = { role: "tutor" | "student"; content: string };

export async function generateChatResponse(params: {
  topicName: string;
  subTopicName?: string;
  history: ChatMessage[];
  studentMessage: string;
}): Promise<string> {
  const { topicName, subTopicName, history, studentMessage } = params;

  const context = subTopicName ? `${topicName} > ${subTopicName}` : topicName;

  const historyText = history
    .map((m) => `${m.role === "tutor" ? "Tutor" : "Student"}: ${m.content}`)
    .join("\n");

  const prompt = `You are a friendly, expert math tutor helping a school student understand "${context}".

Conversation so far:
${historyText || "(no previous messages)"}

Student: ${studentMessage}

Respond as a helpful tutor. Be concise, encouraging, and use LaTeX for math ($...$ inline, $$...$$ block). Explain step by step if needed.

Tutor:`;

  try {
    return await generateText(prompt);
  } catch {
    return "I'm having trouble connecting right now. Please try again in a moment.";
  }
}

// ─── AI Answer Evaluation ─────────────────────────────────────────────────────

export async function evaluateSubjectiveAnswer(params: {
  questionText: string;
  correctAnswerText: string;
  studentAnswer: string;
  type: "text" | "image_upload";
}): Promise<{ correct: boolean; reasoning: string }> {
  const ai = getGenAI();
  const { questionText, correctAnswerText, studentAnswer, type } = params;

  let parts: any[] = [];

  if (type === "image_upload") {
    // Answer may be a JSON array of base64 data URLs (multi-image) or a single data URL
    let imageUrls: string[] = [];
    try {
      const parsed = JSON.parse(studentAnswer);
      imageUrls = Array.isArray(parsed) ? parsed : [studentAnswer];
    } catch {
      imageUrls = [studentAnswer];
    }

    const imageParts: any[] = [];
    for (const url of imageUrls) {
      const match = url.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
      if (match) {
        imageParts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }

    if (imageParts.length === 0) {
      return { correct: false, reasoning: "No valid image data provided." };
    }

    parts = [
      {
        text: `Question: ${questionText}\nExpected criteria/answer: ${correctAnswerText}\n\n` +
          `The student has submitted ${imageParts.length} image(s) of their handwritten/drawn solution. ` +
          `Evaluate all images together as one complete answer. Does it correctly solve the question? ` +
          `Respond in exact JSON: {"correct": true/false, "reasoning": "short explanation"}`
      },
      ...imageParts,
    ];
  } else {
    parts = [
      {
        text: `Question: ${questionText}\nExpected answer: ${correctAnswerText}\nStudent answer: ${studentAnswer}\n\n` +
          `Evaluate if the student answer is correct based on the expected answer. ` +
          `Be reasonably lenient with phrasing but strict on the core concept. ` +
          `Respond in exact JSON: {"correct": true/false, "reasoning": "short explanation"}`
      }
    ];
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: parts,
    });
    const raw = response.text ?? "";
    const cleaned = cleanLikelyJson(raw);
    const parsed = JSON.parse(cleaned);
    return { correct: !!parsed.correct, reasoning: parsed.reasoning || "" };
  } catch (e) {
    console.error("AI Evaluation error:", e);
    return { correct: false, reasoning: "Failed to evaluate answer." };
  }
}
