/** One exchange in the chat. The thread keeps every exchange, not only the latest. */

export type ChatExchange = {
  user: string;
  note: string;
  answer: string;
  toolResults?: { name: string; result?: Record<string, unknown>; run_id?: string | null }[];
};

export function archiveChatTurn(
  past: ChatExchange[],
  current: ChatExchange | null
): ChatExchange[] {
  if (!current || !current.user.trim()) return past;
  return [...past, current];
}
