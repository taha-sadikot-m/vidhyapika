/** Parse stored quiz answer into image data URLs (JSON array or single data URL). */
export function parseAnswerImageUrls(answer: string): string[] {
  if (!answer?.trim()) return [];
  try {
    const parsed = JSON.parse(answer);
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    /* single string */
  }
  if (answer.startsWith('data:image')) return [answer];
  return [];
}
