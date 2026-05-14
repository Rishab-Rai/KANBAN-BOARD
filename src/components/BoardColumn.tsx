import React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Column, Task } from '@/src/types';
import { TaskCard } from './TaskCard';
import { ScrollArea } from '@/src/components/ui/scroll-area';
import { motion, AnimatePresence } from 'motion/react';

interface BoardColumnProps {
  key?: React.Key;
  column: Column;
  tasks: Task[];
  onDeleteTask: (id: string) => void;
  onEditTask: (id: string) => void;
  onArchiveTask: (id: string) => void;
  onMoveToHistory?: (id: string) => void;
}

export function BoardColumn({ column, tasks, onDeleteTask, onEditTask, onArchiveTask, onMoveToHistory }: BoardColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    },
  });

  const taskIds = tasks.map((task) => task.id);

  const getStatusStyles = (id: string) => {
    switch (id) {
      case 'todo':
        return {
          dot: 'bg-slate-400',
          bg: 'bg-slate-100/50',
          badgeBg: 'bg-slate-200',
          badgeText: 'text-slate-600',
        };
      case 'in-progress':
        return {
          dot: 'bg-indigo-500',
          bg: 'bg-indigo-50/30',
          badgeBg: 'bg-indigo-100',
          badgeText: 'text-indigo-600',
        };
      case 'done':
        return {
          dot: 'bg-emerald-500',
          bg: 'bg-emerald-50/20',
          badgeBg: 'bg-emerald-100',
          badgeText: 'text-emerald-600',
        };
      default:
        return {
          dot: 'bg-slate-400',
          bg: 'bg-slate-100/50',
          badgeBg: 'bg-slate-200',
          badgeText: 'text-slate-600',
        };
    }
  };

  const styles = getStatusStyles(column.id);

  return (
    <div className={`flex flex-col flex-1 min-w-[300px] h-full ${styles.bg} rounded-xl p-3 border border-slate-200/50`}>
      <div className="flex items-center justify-between mb-4 px-2 pt-1">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${styles.dot}`}></span>
          {column.title}
          <span className={`${styles.badgeBg} ${styles.badgeText} px-2 py-0.5 rounded text-[10px] font-bold`}>
            {tasks.length}
          </span>
        </h2>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 min-h-[200px]"
      >
        <ScrollArea className="h-full pr-1">
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <AnimatePresence mode="popLayout" initial={false}>
              {tasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <TaskCard 
                    task={task} 
                    onDelete={onDeleteTask} 
                    onEdit={onEditTask} 
                    onArchive={onArchiveTask} 
                    onMoveToHistory={onMoveToHistory} 
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </SortableContext>
        </ScrollArea>
      </div>
    </div>
  );
}
