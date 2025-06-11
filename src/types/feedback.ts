export enum FeedbackTopic {
  GENERAL = 'GENERAL',
  BUG = 'BUG',
  FEATURE = 'FEATURE',
  UI = 'UI',
  UX = 'UX',
  PERFORMANCE = 'PERFORMANCE',
  OTHER = 'OTHER',
}

export enum FeedbackStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export interface Feedback {
  id: string;
  userId: string;
  topic: FeedbackTopic;
  rating: number;
  text?: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeedbackInput {
  userId: string;
  topic: FeedbackTopic;
  rating: number;
  text?: string;
  status?: FeedbackStatus;
}

export interface UpdateFeedbackInput {
  topic?: FeedbackTopic;
  rating?: number;
  text?: string;
  status?: FeedbackStatus;
}

export interface FeedbackQueryParams {
  userId?: string;
  topic?: FeedbackTopic;
  status?: FeedbackStatus;
  limit?: number;
  lastKey?: string;
}

export interface FeedbackListResult {
  items: Feedback[];
  lastKey?: string;
}
