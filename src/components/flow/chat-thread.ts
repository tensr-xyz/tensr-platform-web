/** One exchange in the chat. The thread keeps every exchange, not only the latest. */

export type ChatExchange = {
  user: string;
  note: string;
  answer: string;
  /** Full tool rows — keep slim lineage fields for the change list (TEN-136). */
  toolResults?: Array<{
    name: string;
    args?: Record<string, unknown>;
    result?: Record<string, unknown>;
    run_id?: string | null;
    procedure?: string;
    derived_dataset_id?: string;
    parent_dataset_id?: string;
    answer_markdown?: string;
    original_filename?: string;
    producing_operation?: string;
    active_weight_label?: string;
    summary?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
};

export function archiveChatTurn(
  past: ChatExchange[],
  current: ChatExchange | null
): ChatExchange[] {
  if (!current || !current.user.trim()) return past;
  return [...past, current];
}
