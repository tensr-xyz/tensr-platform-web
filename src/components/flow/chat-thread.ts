/** One exchange in the chat. The thread keeps every exchange, not only the latest. */

export type ChatExchange = {
  user: string;
  note: string;
  answer: string;
};

export function archiveChatTurn(
  past: ChatExchange[],
  current: ChatExchange | null
): ChatExchange[] {
  if (!current || !current.user.trim()) return past;
  return [...past, current];
}
