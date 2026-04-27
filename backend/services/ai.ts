import { GoogleGenAI } from "@google/genai";
import { Question, createQuestionsInBatch } from "../repositories/curriculumRepo";

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
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
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
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
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
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
