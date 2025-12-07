export type SheetStatus = 'active' | 'archived';

export interface Sheet {
  sheetId: string;
  projectId: string;
  name: string;
  currentVersion: number;
  status: SheetStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ColumnSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  nullable: boolean;
}

export interface ColumnStats {
  min?: number;
  max?: number;
  mean?: number;
  stdDev?: number;
  nullCount: number;
  uniqueCount?: number;
  sampleValues?: any[];
}

export interface SheetMetadata {
  sheetId: string;
  version: number;
  schema: ColumnSchema[];
  columnStats: Record<string, ColumnStats>;
  sampleRows?: Record<string, any>[];
  updatedAt: string;
}

export type SheetOp =
  | {
      kind: 'update_cell';
      row: number;
      column: string;
      oldValue: any;
      newValue: any;
      actor: string;
      timestamp: string;
    }
  | {
      kind: 'append_rows';
      rows: Record<string, any>[];
      actor: string;
      timestamp: string;
    }
  | {
      kind: 'delete_row';
      row: number;
      actor: string;
      timestamp: string;
    }
  | {
      kind: 'insert_row';
      index: number;
      row: Record<string, any>;
      actor: string;
      timestamp: string;
    }
  | {
      kind: 'rename_column';
      oldName: string;
      newName: string;
      actor: string;
      timestamp: string;
    }
  | {
      kind: 'add_column';
      name: string;
      type: string;
      defaultValue?: any;
      actor: string;
      timestamp: string;
    };

export interface SheetState {
  sheetId: string;
  version: number;
  schema: ColumnSchema[];
  data: Record<string, any>[];
  columns: string[];
  metadata: SheetMetadata;
}

export type ClientMessage =
  | {
      type: 'subscribe';
      sheetId: string;
    }
  | {
      type: 'op';
      sheetId: string;
      baseVersion: number;
      op: SheetOp;
    }
  | {
      type: 'request_ai';
      sheetId: string;
      version: number;
      channelId: string;
      prompt: string;
    }
  | {
      type: 'ping';
    };

export type ServerMessage =
  | {
      type: 'initial_state';
      sheetId: string;
      version: number;
      schema: ColumnSchema[];
      metadata: SheetMetadata;
      initialRows?: Record<string, any>[];
    }
  | {
      type: 'op_applied';
      sheetId: string;
      version: number;
      op: SheetOp;
    }
  | {
      type: 'op_rejected';
      sheetId: string;
      reason: string;
      baseVersion: number;
    }
  | {
      type: 'snapshot_saved';
      sheetId: string;
      version: number;
      parquetPath: string;
    }
  | {
      type: 'ai_stream';
      channelId: string;
      delta: string;
      done?: boolean;
    }
  | {
      type: 'ai_tool_call';
      channelId: string;
      toolName: string;
      arguments: any;
    }
  | {
      type: 'ai_tool_result';
      channelId: string;
      toolName: string;
      result: any;
    }
  | {
      type: 'error';
      code: string;
      message: string;
    }
  | {
      type: 'pong';
    };
