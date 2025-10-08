import { CategoricalStats, DescriptiveStats } from '@/types/file';

// Legacy interface for backward compatibility - will be removed
export interface LegacyProject {
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

export interface AddRecentProjectRequest {
  path: string;
  title: string;
  current_file: string | null;
  entry_type: string;
}

export interface ProjectFile {
  path: string;
  type: string;
  size: number;
  convertedToParquet?: boolean;
  originalPath?: string;
}

export type ProjectStatus = 'pending_upload' | 'processing' | 'ready' | 'error' | 'deleted';

export interface Project {
  projectId: string;
  userId: string;
  projectName: string;
  description: string;
  originalName: string;
  sourceType: 'zip' | 'git' | 'folder';
  zipPath?: string;
  extractedPath?: string;
  size: number;
  status: ProjectStatus;
  statusDetails?: string;
  files: ProjectFile[];
  createdAt: string;
  updatedAt: string;
  uploadCompletedAt?: string;
  processingCompletedAt?: string;
  deletedAt?: string;
  processingExecutionArn?: string;
  metadata?: ProjectMetadata;
}

export interface ProjectMetadata {
  analysisTypes?: string[];
  variables?: ProjectVariable[];
  [key: string]: any; // Allow for additional metadata properties
}

export interface ProjectVariable {
  name: string;
  type: 'numeric' | 'categorical' | 'binary' | 'date' | 'text';
  description?: string;
}

export interface ProjectUpload {
  projectId: string;
  uploadUrl: string;
  expiresAt: string;
}

// Adapted from your Rust types
export interface ProjectResponse {
  id: string;
  path: string;
  title: string;
  entry_type: string;
}

export interface ProjectConfig {
  name: string;
  created_at: string;
  version: string;
}

export interface FileMetaInfo {
  file_name: string;
  last_accessed: number;
  opened_at: number;
  file_type: string;
  size: number;
  entry_type: string; // "file" or "directory"
  children?: string[]; // For directories
}

export interface ProjectMetaInfo {
  title: string;
  last_accessed: number;
  opened_at: number;
  current_file?: string;
  color_index: number;
  recent_files: string[];
  entry_type: string; // "file" or "directory"
  children?: string[]; // For directories
}

export interface ProjectHistory {
  projects: Record<string, ProjectMetaInfo>;
  files: Record<string, FileMetaInfo>;
  last_opened_project?: string;
  last_opened_file?: string;
  max_entries: number;
}

export interface RecentFileInfo {
  path: string;
  file_name: string;
  last_accessed: number;
  file_type: string;
  size: number;
  entry_type: string;
  children?: string[];
}

export interface RecentProject {
  path: string;
  title: string;
  last_accessed: number;
  color_index: number;
  current_file?: string;
  recent_files: string[];
  entry_type: string;
  children?: string[];
}

export interface AddProjectRequest {
  path: string;
  title: string;
  current_file?: string;
  entry_type: string;
}
