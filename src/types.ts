export type TaskStatus = 'todo' | 'in-progress' | 'done';

export interface Task {
  id: string;
  title: string;
  description?: string;
  category?: string;
  clientName?: string;
  status: TaskStatus;
  createdAt: number;
  completedAt?: number;
  archived?: boolean;
  deleted?: boolean;
  deletedAt?: number;
  movedToHistory?: boolean;
  priority: 'low' | 'medium' | 'high';
  submissionDate?: string;
}

export interface Column {
  id: TaskStatus;
  title: string;
}
