export type ReportAnnotation = {
  id: string;
  text: string;
  target?: string;
  createdAt: string;
  authorName?: string;
  parentId?: string;
  resolved?: boolean;
};
