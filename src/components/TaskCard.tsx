import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { format } from 'date-fns';
import { GripVertical, Trash2, Pencil, Archive, Calendar, CheckSquare, Clock } from 'lucide-react';
import { Button } from '@/src/components/ui/button';

interface TaskCardProps {
  key?: React.Key;
  task: Task;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onArchive: (id: string) => void;
  onMoveToHistory?: (id: string) => void;
}

export function TaskCard({ task, onDelete, onEdit, onArchive, onMoveToHistory }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  const isCompleted = task.status === 'done';
  const isOngoing = task.status === 'in-progress';

  const priorityColors = {
    low: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    medium: 'bg-amber-50 text-amber-700 border-amber-100',
    high: 'bg-rose-50 text-rose-700 border-rose-100'
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-30 bg-slate-200 h-[84px] min-h-[84px] items-center flex border-2 border-dashed border-indigo-400 rounded-lg p-2 my-1"
      />
    );
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onEdit(task.id)}
      className={`group relative my-1.5 bg-white border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-indigo-200 h-[84px] flex flex-col justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none ${
        isOngoing ? 'ring-1 ring-indigo-50 border-indigo-100' : ''
      }`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
        task.priority === 'high' ? 'bg-rose-500' : 
        task.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
      }`} />
      
      <CardHeader className="p-3 flex flex-col space-y-1">
        {task.category && (
          <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-tighter">
            {task.category}
          </span>
        )}
        <div className="flex items-start justify-between gap-1">
          <CardTitle className="text-sm font-bold leading-tight text-slate-900 font-sans line-clamp-2">
            {task.title}
          </CardTitle>
        </div>
      </CardHeader>
    </Card>
  );
}
