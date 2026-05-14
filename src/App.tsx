/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, ChangeEvent } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { arrayMove, SortableContext } from '@dnd-kit/sortable';
import { createPortal } from 'react-dom';
import { nanoid } from 'nanoid';
import { Task, TaskStatus, Column } from './types';
import { BoardColumn } from './components/BoardColumn';
import { TaskCard } from './components/TaskCard';
import { Button } from './components/ui/button';
import { Plus, LayoutGrid, Search, Trash2, Settings2, Pencil, Calendar, AlertTriangle, X, ArrowLeft, RotateCcw, History, Archive, Clock, BarChart3, Copy } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from './components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './components/ui/tabs';
const COLUMNS: Column[] = [
  { id: 'todo', title: 'Not Started' },
  { id: 'in-progress', title: 'Ongoing' },
  { id: 'done', title: 'Completed' },
];

const STORAGE_KEY = 'flowstate_tasks_v1';
const CATEGORIES_KEY = 'flowstate_categories_v1';

const PRIORITY_WEIGHTS = {
  high: 3,
  medium: 2,
  low: 1
};

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState('board');
  const [newTask, setNewTask] = useState<{
    title: string;
    description: string;
    category: string;
    clientName: string;
    priority: 'low' | 'medium' | 'high';
    submissionDate: string;
  }>({ 
    title: '', 
    description: '', 
    category: '', 
    clientName: '',
    priority: 'medium',
    submissionDate: '',
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [permDeleteId, setPermDeleteId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem(CATEGORIES_KEY);
    return saved ? JSON.parse(saved) : ['Design', 'Development', 'Marketing', 'Research'];
  });
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  }, [categories]);

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const completedTasksList = tasks.filter(t => t.status === 'done' && t.completedAt);
  
  const avgCompletionTime = useMemo(() => {
    if (completedTasksList.length === 0) return 0;
    const totalTime = completedTasksList.reduce((acc, t) => {
      const duration = (t.completedAt! - t.createdAt);
      return acc + duration;
    }, 0);
    return Math.round(totalTime / completedTasksList.length / (1000 * 60 * 60)); // in hours
  }, [completedTasksList]);

  const completionSpeedData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return {
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        timestamp: date.setHours(0, 0, 0, 0)
      };
    });

    return days.map(day => {
      const nextDay = day.timestamp + 24 * 60 * 60 * 1000;
      const tasksFinishedThisDay = completedTasksList.filter(t => 
        t.completedAt! >= day.timestamp && t.completedAt! < nextDay
      );
      
      const avgHours = tasksFinishedThisDay.length > 0 
        ? tasksFinishedThisDay.reduce((acc, t) => acc + (t.completedAt! - t.createdAt), 0) / tasksFinishedThisDay.length / (1000 * 60 * 60)
        : 0;

      return {
        name: day.label,
        avgHours: Math.round(avgHours * 10) / 10
      };
    });
  }, [completedTasksList]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(
        (task) =>
          (task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.description?.toLowerCase().includes(searchQuery.toLowerCase()))
      );
  }, [tasks, searchQuery]);

  const boardTasks = useMemo(() => {
    return filteredTasks.filter(t => {
      if (t.deleted) return false;
      if (t.archived) return false;
      if (t.movedToHistory) return false;
      if (t.status === 'done') {
        const completedTime = t.completedAt || t.createdAt;
        return completedTime >= weekAgo;
      }
      return true;
    });
  }, [filteredTasks, weekAgo]);

  const archivedTasks = useMemo(() => {
    return filteredTasks.filter(t => t.archived && !t.deleted);
  }, [filteredTasks]);

  const deletedTasks = useMemo(() => {
    return filteredTasks.filter(t => t.deleted);
  }, [filteredTasks]);

  const historyTasks = useMemo(() => {
    return filteredTasks.filter(t => {
      if (t.deleted) return false;
      if (t.archived) return false;
      if (t.status !== 'done') return false;
      if (t.movedToHistory) return true;
      const completedTime = t.completedAt || t.createdAt;
      return completedTime < weekAgo;
    });
  }, [filteredTasks, weekAgo]);

  function addTask() {
    if (!newTask.title.trim()) return;
    const task: Task = {
      id: nanoid(),
      ...newTask,
      status: 'todo',
      createdAt: Date.now(),
    };
    setTasks([...tasks, task]);
    setNewTask({ 
      title: '', 
      description: '', 
      category: '', 
      clientName: '',
      priority: 'medium',
      submissionDate: '',
    });
    setIsAddingTask(false);
  }

  function updateTask() {
    if (!editingTask || !editingTask.title.trim()) return;
    setTasks(tasks.map(t => t.id === editingTask.id ? editingTask : t));
    setEditingTask(null);
  }

  function deleteTask(id: string) {
    setDeleteId(id);
  }

  function archiveTask(id: string) {
    const task = tasks.find(t => t.id === id);
    if (task && !task.archived) {
      setArchiveId(id);
    } else {
      // Toggle back from archive directly
      setTasks(tasks.map(t => t.id === id ? { ...t, archived: !t.archived } : t));
    }
  }

  function handleConfirmArchive() {
    if (archiveId) {
      setTasks(tasks.map(t => t.id === archiveId ? { ...t, archived: true } : t));
      setArchiveId(null);
      setEditingTask(null);
    }
  }

  function handleMoveToHistory(id: string) {
    setHistoryId(id);
  }

  function handleConfirmHistory() {
    if (historyId) {
      setTasks(tasks.map(t => t.id === historyId ? { ...t, movedToHistory: true } : t));
      setHistoryId(null);
      setEditingTask(null);
    }
  }

  function startEdit(id: string) {
    const task = tasks.find(t => t.id === id);
    if (task) setEditingTask({ ...task });
  }

  function handleConfirmDelete() {
    if (deleteId) {
      setTasks(tasks.map((t) => t.id === deleteId ? { ...t, deleted: true, deletedAt: Date.now() } : t));
      setDeleteId(null);
      setEditingTask(null);
    }
  }

  function restoreTask(id: string) {
    setTasks(tasks.map(t => t.id === id ? { ...t, deleted: false, deletedAt: undefined } : t));
  }

  function permanentlyDeleteTask(id: string) {
    setPermDeleteId(id);
  }

  function handleConfirmPermDelete() {
    if (permDeleteId) {
      setTasks(tasks.filter(t => t.id !== permDeleteId));
      setPermDeleteId(null);
    }
  }

  function restoreToBoard(id: string) {
    setRestoreId(id);
  }

  function duplicateTask(id: string) {
    setDuplicateId(id);
  }

  function handleConfirmDuplicate() {
    if (duplicateId) {
      const taskToDuplicate = tasks.find(t => t.id === duplicateId);
      if (taskToDuplicate) {
        const newTask: Task = {
          ...taskToDuplicate,
          id: nanoid(),
          title: `${taskToDuplicate.title} (Copy)`,
          status: 'todo',
          createdAt: Date.now(),
          completedAt: undefined,
          archived: false,
          deleted: false,
          deletedAt: undefined,
          movedToHistory: false
        };

        setTasks([newTask, ...tasks]);
      }
      setDuplicateId(null);
      setEditingTask(null);
    }
  }

  function handleConfirmRestore() {
    if (restoreId) {
      setTasks(tasks.map(t => t.id === restoreId ? { 
        ...t, 
        archived: false, 
        movedToHistory: false, 
        status: 'todo',
        completedAt: undefined,
        deleted: false,
        deletedAt: undefined
      } : t));
      setRestoreId(null);
      setEditingTask(null);
    }
  }

  function addCategory() {
    if (!newCategoryName.trim()) return;
    if (categories.includes(newCategoryName.trim())) {
      alert('Category already exists');
      return;
    }
    setCategories([...categories, newCategoryName.trim()]);
    setNewCategoryName('');
  }

  function removeCategory(cat: string) {
    if (categories.length <= 1) {
      alert('You must have at least one category.');
      return;
    }
    setCategories(categories.filter(c => c !== cat));
  }

  function onDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === 'Task') {
      setActiveTask(event.active.data.current.task);
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveATask = active.data.current?.type === 'Task';
    const isOverATask = over.data.current?.type === 'Task';

    // Dropping a task over another task
    if (isActiveATask && isOverATask) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const overIndex = tasks.findIndex((t) => t.id === overId);

        if (tasks[activeIndex].status !== tasks[overIndex].status) {
          const newStatus = tasks[overIndex].status;
          const updatedTask = { ...tasks[activeIndex], status: newStatus };
          
          if (newStatus === 'done' && tasks[activeIndex].status !== 'done') {
            updatedTask.completedAt = Date.now();
          } else if (newStatus !== 'done') {
            updatedTask.completedAt = undefined;
          }

          const newTasks = [...tasks];
          newTasks[activeIndex] = updatedTask;
          return arrayMove(newTasks, activeIndex, overIndex - 1);
        }

        return arrayMove(tasks, activeIndex, overIndex);
      });
    }

    // Dropping a task over a column
    const isOverAColumn = over.data.current?.type === 'Column';
    if (isActiveATask && isOverAColumn) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const newStatus = overId as TaskStatus;
        const updatedTask = { ...tasks[activeIndex], status: newStatus };

        if (newStatus === 'done' && tasks[activeIndex].status !== 'done') {
            updatedTask.completedAt = Date.now();
        } else if (newStatus !== 'done') {
            updatedTask.completedAt = undefined;
        }

        const newTasks = [...tasks];
        newTasks[activeIndex] = updatedTask;
        return arrayMove(newTasks, activeIndex, activeIndex);
      });
    }
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveTask(null);
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-30">
        <div 
          className="flex items-center gap-3 cursor-pointer select-none"
          onClick={() => setActiveTab('board')}
        >
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-indigo-200 shadow-lg hover:bg-indigo-700 transition-colors">
            <LayoutGrid className="text-white" size={18} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 italic">
            Rishab's <span className="text-indigo-600 not-italic">kanban board</span>
          </h1>
        </div>

        <div className="flex items-center gap-4 flex-1 max-w-md mx-8">
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant={activeTab === 'settings' ? 'secondary' : 'ghost'} 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setActiveTab('settings')}
            title="Settings"
          >
            <Settings2 size={16} />
          </Button>
          
          <div className="w-px h-4 bg-slate-200 mx-1" />

          <Dialog open={isAddingTask} onOpenChange={setIsAddingTask}>
            <DialogTrigger
              render={
                <Button className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 shadow-sm transition-all h-9">
                  <Plus size={16} className="mr-2" />
                  New Task
                </Button>
              }
            />
            <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden">
              <div className="p-6 pb-2">
                <DialogHeader>
                  <div className="flex flex-col">
                    <DialogTitle>Create New Task</DialogTitle>
                    <div className="flex items-center text-[10px] text-slate-400 mt-1">
                      <Calendar size={12} className="mr-1 opacity-70" />
                      {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} (Today)
                    </div>
                  </div>
                </DialogHeader>
              </div>
              <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] px-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Title</label>
                  <Input
                    placeholder="E.g., Design landing page..."
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Description</label>
                  <textarea
                    className="flex min-h-[160px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="E.g., Research competitor sites..."
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Category</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={newTask.category}
                      onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                    >
                      <option value="" disabled>Select Category</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Client/Project</label>
                    <Input
                      placeholder="Client Name..."
                      value={newTask.clientName}
                      onChange={(e) => setNewTask({ ...newTask, clientName: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Priority</label>
                    <div className="flex gap-1">
                      {(['low', 'medium', 'high'] as const).map((p) => (
                        <Button
                          key={p}
                          variant={newTask.priority === p ? 'secondary' : 'outline'}
                          size="sm"
                          className="flex-1 capitalize text-[10px] h-8"
                          onClick={() => setNewTask({ ...newTask, priority: p })}
                        >
                          {p}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Submission Date</label>
                    <Input
                      type="date"
                      value={newTask.submissionDate}
                      onChange={(e) => setNewTask({ ...newTask, submissionDate: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="bg-slate-50 border-t border-slate-100 p-6 flex gap-2 sm:gap-0 justify-end mt-0">
                <Button variant="ghost" onClick={() => setIsAddingTask(false)}>Cancel</Button>
                <Button onClick={addTask}>Create Task</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Header End */}

      {/* Board Content */}
      <Tabs value={activeTab} className="flex-1 overflow-hidden">
        <TabsContent value="board" className="h-full mt-0 focus-visible:ring-0">
          <main className="h-full overflow-x-auto bg-slate-50/50">
            <DndContext
              sensors={sensors}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
            >
              <div className="flex gap-6 h-full min-w-full p-6">
                {COLUMNS.map((col) => (
                  <BoardColumn
                    key={col.id}
                    column={col}
                    tasks={boardTasks.filter((t) => t.status === col.id)}
                    onDeleteTask={deleteTask}
                    onEditTask={startEdit}
                    onArchiveTask={archiveTask}
                  />
                ))}
              </div>

              {createPortal(
                <DragOverlay
                  dropAnimation={{
                    sideEffects: defaultDropAnimationSideEffects({
                      styles: {
                        active: {
                          opacity: '0.5',
                        },
                      },
                    }),
                  }}
                >
                  {activeTask && (
                    <div className="w-[300px]">
                      <TaskCard 
                        task={activeTask} 
                        onDelete={() => {}} 
                        onEdit={() => {}} 
                        onArchive={() => {}} 
                      />
                    </div>
                  )}
                </DragOverlay>,
                document.body
              )}
            </DndContext>
          </main>
        </TabsContent>

        <TabsContent value="settings" className="h-full mt-0 focus-visible:ring-0 overflow-y-auto bg-slate-50/50 p-6">
          <div className="max-w-4xl mx-auto">
            <Button 
              variant="ghost" 
              size="sm" 
              className="mb-6 -ml-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50 gap-2"
              onClick={() => setActiveTab('board')}
            >
              <ArrowLeft size={16} />
              Back to Board
            </Button>
            
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                <Settings2 className="text-indigo-600" size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">App Settings</h2>
                <p className="text-sm text-slate-500 font-sans">Manage categories, archive, analytics and history.</p>
              </div>
            </div>

            <Tabs defaultValue="analytics" className="space-y-6">
              <TabsList className="bg-white border border-slate-200 p-1 h-11">
                <TabsTrigger value="analytics" className="h-9 px-6 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">Analytics</TabsTrigger>
                <TabsTrigger value="categories" className="h-9 px-6 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">Categories</TabsTrigger>
                <TabsTrigger value="archive" className="h-9 px-6 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                  Archive
                </TabsTrigger>
                <TabsTrigger value="history" className="h-9 px-6 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">History</TabsTrigger>
                <TabsTrigger value="deleted" className="h-9 px-6 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                  Deleted
                </TabsTrigger>
              </TabsList>

              <TabsContent value="analytics" className="mt-0 focus-visible:ring-0">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <Card className="bg-white border-slate-200 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Tasks</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-slate-800">{tasks.length}</div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center">
                          <LayoutGrid size={10} className="mr-1" />
                          All filtered tasks
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white border-slate-200 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Completed</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">
                          {tasks.filter(t => t.status === 'done').length}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center">
                          <Clock size={10} className="mr-1" />
                          {progress}% completion rate
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white border-slate-200 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">In Progress</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-indigo-600">
                          {tasks.filter(t => t.status === 'in-progress').length}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center">
                          <RotateCcw size={10} className="mr-1" />
                          Ongoing work
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white border-slate-200 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">To Do</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-amber-600">
                          {tasks.filter(t => t.status === 'todo').length}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center">
                          <Plus size={10} className="mr-1" />
                          Tasks awaiting start
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white border-slate-200 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Avg. Resolution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-indigo-500">
                          {avgCompletionTime} <span className="text-sm font-medium text-slate-400">hrs</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center">
                          <Clock size={10} className="mr-1" />
                          Lead time to done
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-white border-slate-200 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold text-slate-800 text-center">Status Mix</CardTitle>
                      </CardHeader>
                      <div className="h-[280px] pb-6">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'To Do', value: tasks.filter(t => t.status === 'todo').length, color: '#f59e0b' },
                                { name: 'Doing', value: tasks.filter(t => t.status === 'in-progress').length, color: '#4f46e5' },
                                { name: 'Done', value: tasks.filter(t => t.status === 'done').length, color: '#10b981' },
                              ]}
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {[
                                { name: 'To Do', value: tasks.filter(t => t.status === 'todo').length, color: '#f59e0b' },
                                { name: 'Doing', value: tasks.filter(t => t.status === 'in-progress').length, color: '#4f46e5' },
                                { name: 'Done', value: tasks.filter(t => t.status === 'done').length, color: '#10b981' },
                              ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36}/>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card className="bg-white border-slate-200 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold text-slate-800">Priority Breakdown</CardTitle>
                      </CardHeader>
                      <div className="h-[280px] px-2 pb-6">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              { name: 'Low', count: tasks.filter(t => t.priority === 'low').length, fill: '#94a3b8' },
                              { name: 'Medium', count: tasks.filter(t => t.priority === 'medium').length, fill: '#f59e0b' },
                              { name: 'High', count: tasks.filter(t => t.priority === 'high').length, fill: '#ef4444' },
                            ]}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                            <Tooltip 
                              cursor={{ fill: '#f8fafc' }}
                              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card className="bg-white border-slate-200 shadow-sm col-span-1 md:col-span-2">
                        <CardHeader>
                          <CardTitle className="text-sm font-semibold text-slate-800">Recent Activity Volume</CardTitle>
                        </CardHeader>
                        <div className="h-[300px] px-2 pb-6">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={(() => {
                                const days = Array.from({ length: 7 }, (_, i) => {
                                  const date = new Date();
                                  date.setDate(date.getDate() - (6 - i));
                                  return date.toLocaleDateString(undefined, { weekday: 'short' });
                                });
                                
                                return days.map((day, i) => {
                                  const date = new Date();
                                  date.setDate(date.getDate() - (6 - i));
                                  date.setHours(0, 0, 0, 0);
                                  const nextDate = new Date(date);
                                  nextDate.setDate(nextDate.getDate() + 1);

                                  return {
                                    name: day,
                                    created: tasks.filter(t => t.createdAt >= date.getTime() && t.createdAt < nextDate.getTime()).length,
                                    completed: tasks.filter(t => t.completedAt && t.completedAt >= date.getTime() && t.completedAt < nextDate.getTime()).length,
                                  };
                                });
                              })()}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                              <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              />
                              <Legend verticalAlign="top" align="right" height={36}/>
                              <Line type="monotone" dataKey="created" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                              <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>

                      <Card className="bg-white border-slate-200 shadow-sm col-span-1 md:col-span-2">
                        <CardHeader>
                          <CardTitle className="text-sm font-semibold text-slate-800">Completion Speed (Resolution Time)</CardTitle>
                        </CardHeader>
                        <div className="h-[300px] px-2 pb-6">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={completionSpeedData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: '10px', fill: '#94a3b8' } }} />
                              <Tooltip 
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number) => [`${value} hours`, 'Avg. Time']}
                              />
                              <Bar dataKey="avgHours" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="categories" className="mt-0 focus-visible:ring-0">
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Task Categories</h3>
                    <p className="text-sm text-slate-500 mt-1">Define categories to organize your workflow.</p>
                  </div>
                  
                  <div className="flex gap-2 max-w-md">
                    <Input 
                      placeholder="New category name..."
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addCategory()}
                      className="bg-slate-50 border-slate-200 focus:bg-white"
                    />
                    <Button onClick={addCategory} className="bg-indigo-600 hover:bg-indigo-700 shrink-0">
                      <Plus size={16} className="mr-2" />
                      Add Category
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {categories.map(cat => (
                      <Badge 
                        key={cat} 
                        variant="secondary" 
                        className="px-4 py-1.5 flex items-center gap-3 bg-slate-50 text-slate-700 border border-slate-200 rounded-full hover:border-slate-300 transition-colors"
                      >
                        <span className="font-medium">{cat}</span>
                        <button 
                          onClick={() => removeCategory(cat)}
                          className="text-slate-400 hover:text-destructive transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="archive" className="mt-0 focus-visible:ring-0">
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">Archive Explorer</h3>
                      <p className="text-sm text-slate-500 mt-1">Review and restore your manually archived tasks.</p>
                    </div>
                    <div className="relative w-64 group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
                      <Input
                        placeholder="Filter archive..."
                        className="pl-9 h-10 bg-white border-slate-200 rounded-lg text-sm transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  {archivedTasks.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-slate-300">
                      <Archive className="mx-auto text-slate-200 mb-4" size={48} />
                      <p className="text-slate-400 font-medium">Your archive is empty</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {archivedTasks.map(task => (
                        <TaskCard 
                          key={task.id} 
                          task={task} 
                          onDelete={deleteTask} 
                          onEdit={startEdit} 
                          onArchive={archiveTask} 
                        />
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-0 focus-visible:ring-0">
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-800">Completed History</h3>
                      <p className="text-sm text-slate-500 mt-1">Tasks finished more than 7 days ago.</p>
                    </div>
                    <div className="relative w-64 group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
                      <Input
                        placeholder="Search history..."
                        className="pl-9 h-10 bg-white border-slate-200 rounded-lg text-sm transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  {historyTasks.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-slate-300">
                      <History className="mx-auto text-slate-200 mb-4" size={48} />
                      <p className="text-slate-400 font-medium">No historical data available</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {historyTasks.map(task => (
                        <TaskCard 
                          key={task.id} 
                          task={task} 
                          onDelete={deleteTask} 
                          onEdit={startEdit} 
                          onArchive={archiveTask} 
                        />
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="deleted" className="mt-0 focus-visible:ring-0">
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 text-rose-600">Deleted Repository</h3>
                      <p className="text-sm text-slate-500 mt-1">Manage recently deleted tasks or restore them to your board.</p>
                    </div>
                  </div>

                  {deletedTasks.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-slate-300">
                      <Trash2 className="mx-auto text-slate-200 mb-4" size={48} />
                      <p className="text-slate-400 font-medium">No deleted tasks found</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {deletedTasks.map(task => (
                        <div key={task.id} className="relative group">
                          <TaskCard 
                            task={task} 
                            onDelete={() => {}} 
                            onEdit={() => {}} 
                            onArchive={() => {}} 
                          />
                          <div className="absolute inset-0 bg-slate-50/60 backdrop-blur-[1px] rounded-lg flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              size="sm" 
                              variant="secondary" 
                              className="h-8 bg-white border border-slate-200 shadow-sm hover:bg-indigo-50 hover:text-indigo-600 h-8 text-[11px]"
                              onClick={() => restoreToBoard(task.id)}
                            >
                              Restore
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              className="h-8 text-[11px]"
                              onClick={() => permanentlyDeleteTask(task.id)}
                            >
                              Permanent Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
      </Tabs>

          {/* Edit Task Dialog */}
          <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
            <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden">
              <div className="p-6 pb-2">
                <DialogHeader>
                  <div className="flex flex-col">
                    <DialogTitle>Edit Task</DialogTitle>
                    {editingTask && (
                      <div className="flex items-center text-[10px] text-slate-400 mt-1">
                        <Calendar size={12} className="mr-1 opacity-70" />
                        Created on {new Date(editingTask.createdAt).toLocaleDateString(undefined, { 
                          month: 'long', 
                          day: 'numeric', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
                  </div>
                </DialogHeader>
              </div>
              {editingTask && (
                <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] px-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Title</label>
                    <Input
                      placeholder="Task title..."
                      value={editingTask.title}
                      onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Description</label>
                    <textarea
                      className="flex min-h-[240px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Task description..."
                      value={editingTask.description || ''}
                      onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Category</label>
                      <select
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={editingTask.category || ''}
                        onChange={(e) => setEditingTask({ ...editingTask, category: e.target.value })}
                      >
                        <option value="" disabled>Select Category</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Client/Project</label>
                      <Input
                        placeholder="Client..."
                        value={editingTask.clientName || ''}
                        onChange={(e) => setEditingTask({ ...editingTask, clientName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Priority</label>
                      <div className="flex gap-1">
                        {(['low', 'medium', 'high'] as const).map((p) => (
                          <Button
                            key={p}
                            variant={editingTask.priority === p ? 'secondary' : 'outline'}
                            size="sm"
                            className="flex-1 capitalize text-[10px] h-8"
                            onClick={() => setEditingTask({ ...editingTask, priority: p })}
                          >
                            {p}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Submission Date</label>
                      <Input
                        type="date"
                        value={editingTask.submissionDate || ''}
                        onChange={(e) => setEditingTask({ ...editingTask, submissionDate: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter className="bg-slate-50 border-t border-slate-100 p-6 flex flex-row justify-between items-center w-full mt-0">
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-9 w-9 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-colors"
                    onClick={() => {
                        if (editingTask) {
                          deleteTask(editingTask.id);
                        }
                    }}
                    title="Move to Trash"
                  >
                    <Trash2 size={16} />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="h-9 w-9 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200"
                    onClick={() => {
                        if (editingTask) {
                          duplicateTask(editingTask.id);
                        }
                    }}
                    title="Duplicate Task"
                  >
                    <Copy size={16} />
                  </Button>
                  {editingTask?.archived || editingTask?.movedToHistory ? (
                    <Button 
                      variant="outline" 
                      size="icon"
                      className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200 h-9 w-9"
                      onClick={() => {
                        if (editingTask) {
                          restoreToBoard(editingTask.id);
                        }
                      }}
                      title="Restore to Board"
                    >
                      <RotateCcw size={16} />
                    </Button>
                  ) : editingTask?.status === 'done' ? (
                    <Button 
                      variant="outline" 
                      size="icon"
                      className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 h-9 w-9"
                      onClick={() => {
                        if (editingTask) {
                          handleMoveToHistory(editingTask.id);
                        }
                      }}
                      title="Move to History"
                    >
                      <History size={16} />
                    </Button>
                  ) : editingTask && (
                    <Button 
                      variant="outline" 
                      size="icon"
                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200 h-9 w-9"
                      onClick={() => {
                        if (editingTask) {
                          archiveTask(editingTask.id);
                        }
                      }}
                      title="Move to Archive"
                    >
                      <Archive size={16} />
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" className="h-9" onClick={() => setEditingTask(null)}>Cancel</Button>
                  <Button onClick={updateTask} className="h-9">Save Changes</Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Task Confirmation Dialog */}
          <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
            <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden">
              <div className="p-6 pb-2">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-destructive">
                    <Trash2 size={18} />
                    Confirm Deletion
                  </DialogTitle>
                </DialogHeader>
              </div>
              <div className="px-6 py-2">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Are you sure you want to delete this task? This action cannot be undone.
                </p>
              </div>
              <DialogFooter className="bg-slate-50 border-t border-slate-100 p-6 flex gap-2 sm:gap-0 justify-end mt-4">
                <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
                <Button variant="destructive" onClick={handleConfirmDelete}>Delete Task</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Archive Task Confirmation Dialog */}
          <Dialog open={!!archiveId} onOpenChange={(open) => !open && setArchiveId(null)}>
            <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden">
              <div className="p-6 pb-2">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-amber-600">
                    <Archive size={18} />
                    Confirm Archival
                  </DialogTitle>
                </DialogHeader>
              </div>
              <div className="px-6 py-2">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Are you sure you want to archive this task? It will be moved to the Archive tab and hidden from the board.
                </p>
              </div>
              <DialogFooter className="bg-slate-50 border-t border-slate-100 p-6 flex gap-2 sm:gap-0 justify-end mt-4">
                <Button variant="ghost" onClick={() => setArchiveId(null)}>Cancel</Button>
                <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleConfirmArchive}>Archive Task</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Move to History Confirmation Dialog */}
          <Dialog open={!!historyId} onOpenChange={(open) => !open && setHistoryId(null)}>
            <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden">
              <div className="p-6 pb-2">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-emerald-600">
                    <Clock size={18} />
                    Move to History
                  </DialogTitle>
                </DialogHeader>
              </div>
              <div className="px-6 py-2">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Are you sure you want to move this completed task to history? It will be removed from the board.
                </p>
              </div>
              <DialogFooter className="bg-slate-50 border-t border-slate-100 p-6 flex gap-2 sm:gap-0 justify-end mt-4">
                <Button variant="ghost" onClick={() => setHistoryId(null)}>Cancel</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleConfirmHistory}>Move to History</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Restore Task Confirmation Dialog */}
          <Dialog open={!!restoreId} onOpenChange={(open) => !open && setRestoreId(null)}>
            <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden">
              <div className="p-6 pb-2">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-indigo-600">
                    <RotateCcw size={18} />
                    Restore to Board
                  </DialogTitle>
                </DialogHeader>
              </div>
              <div className="px-6 py-2">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Are you sure you want to restore this task to the board? It will be moved to the 'Not Started' column.
                </p>
              </div>
              <DialogFooter className="bg-slate-50 border-t border-slate-100 p-6 flex gap-2 sm:gap-0 justify-end mt-4">
                <Button variant="ghost" onClick={() => setRestoreId(null)}>Cancel</Button>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleConfirmRestore}>Restore Task</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Permanent Delete Task Confirmation Dialog */}
          <Dialog open={!!permDeleteId} onOpenChange={(open) => !open && setPermDeleteId(null)}>
            <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden">
              <div className="p-6 pb-2">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle size={18} />
                    Permanent Deletion
                  </DialogTitle>
                </DialogHeader>
              </div>
              <div className="px-6 py-2">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Are you sure you want to <strong>permanently</strong> delete this task? This action is truly irreversible.
                </p>
              </div>
              <DialogFooter className="bg-slate-50 border-t border-slate-100 p-6 flex gap-2 sm:gap-0 justify-end mt-4">
                <Button variant="ghost" onClick={() => setPermDeleteId(null)}>Cancel</Button>
                <Button variant="destructive" onClick={handleConfirmPermDelete}>Delete Forever</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Duplicate Task Confirmation Dialog */}
          <Dialog open={!!duplicateId} onOpenChange={(open) => !open && setDuplicateId(null)}>
            <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden">
              <div className="p-6 pb-2">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-indigo-600">
                    <Copy size={18} />
                    Duplicate Task
                  </DialogTitle>
                </DialogHeader>
              </div>
              <div className="px-6 py-2">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Are you sure you want to duplicate this task? A copy will be added to the 'Not Started' column.
                </p>
              </div>
              <DialogFooter className="bg-slate-50 border-t border-slate-100 p-6 flex gap-2 sm:gap-0 justify-end mt-4">
                <Button variant="ghost" onClick={() => setDuplicateId(null)}>Cancel</Button>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleConfirmDuplicate}>Duplicate</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

      {/* Footer */}
      <footer className="h-10 bg-white border-t border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex gap-6">
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            Total Progress: {progress}%
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
             <LayoutGrid className="w-3 h-3 text-slate-400" />
             Tasks: {totalTasks}
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-400 uppercase tracking-widest font-semibold">
          <span>Project: <span className="text-slate-600">Enterprise 2024</span></span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            All Systems Nominal
          </span>
        </div>
      </footer>

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none mt-16 pb-10">
          <div className="text-center space-y-4 max-w-xs px-6">
             <div className="w-16 h-16 bg-slate-200/50 rounded-2xl mx-auto flex items-center justify-center text-slate-400 opacity-50">
                <LayoutGrid size={32} />
             </div>
             <div>
                <h3 className="text-lg font-semibold text-slate-800">No tasks yet</h3>
                <p className="text-sm text-slate-500 mt-1">Start by creating your first task to see the Kanban board in action.</p>
             </div>
             <Button
               variant="outline"
               className="pointer-events-auto border-slate-300 hover:bg-white"
               onClick={() => setIsAddingTask(true)}
             >
               Add First Task
             </Button>
          </div>
        </div>
      )}
    </div>
  );
}
