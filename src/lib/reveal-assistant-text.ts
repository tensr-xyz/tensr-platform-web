/** Typewriter reveal when the API only returns a complete body. */

export async function revealAssistantText(
  fullText: string,
  onUpdate: (partial: string) => void,
  options?: { charsPerTick?: number; msPerTick?: number; signal?: AbortSignal }
): Promise<void> {
  const step = options?.charsPerTick ?? 4;
  const delay = options?.msPerTick ?? 12;
  let i = 0;
  while (i < fullText.length) {
    if (options?.signal?.aborted) {
      onUpdate(fullText);
      return;
    }
    i = Math.min(fullText.length, i + step);
    onUpdate(fullText.slice(0, i));
    await new Promise<void>(resolve => {
      window.setTimeout(resolve, delay);
    });
  }
  onUpdate(fullText);
}
