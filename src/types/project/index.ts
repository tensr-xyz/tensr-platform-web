import { CategoricalStats, DescriptiveStats } from '@/types/file';

export interface Project {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  lastOpened?: Date;
  initialFile?: {
    path: string;
    metadata?: FileMetadata;
  };
}

export interface FileEntry {
  name: string;
  path: string;
  entry_type: string;
  children?: FileEntry[];
  metadata?: FileMetadata;
}

export interface FileMetadata {
  rows: number;
  columns: number;
  preview: string[][];
  column_names: string[];
  detected_delimiter?: string;
  columnSummaries?: Record<string, ColumnSummary>;
}

export interface FileResponse {
  metadata: FileMetadata;
}

export interface ColumnSummary {
  name: string;
  data_type: string;
  numeric_stats: DescriptiveStats | null;
  categorical_stats: CategoricalStats | null;
}

export interface PageResponse {
  data: Array<Array<string>>;
  has_more: boolean;
}

export interface RecentProject {
  path: string;
  title: string;
  last_accessed: number;
  color_index: number;
  current_file: string | null;
  recent_files: string[];
  entry_type: string;
  children: string[] | null;
}

export interface AddRecentProjectRequest {
  path: string;
  title: string;
  current_file: string | null;
  entry_type: string;
}

export interface RecentFileInfo {
  path: string;
  file_name: string;
  last_accessed: number;
  file_type: string;
  size: number;
  entry_type: string;
  children: string[] | null;
}
