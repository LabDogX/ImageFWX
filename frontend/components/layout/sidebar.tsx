'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ChevronLeft,
  ChevronRight,
  History,
  Settings,
  FolderPlus,
  Folder,
  MoreHorizontal,
  Pencil,
  Trash2,
  Images,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { projectsApi } from '@/lib/api';
import { useLocale } from '@/components/providers/locale-provider';

const PROJECT_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#0ea5e9', // sky
];

export function Sidebar() {
  const { t } = useLocale();
  const { 
    sidebarOpen, 
    setSidebarOpen, 
    token, 
    projects,
    setProjects,
    addProject,
    updateProject,
    removeProject,
    activeProjectId, 
    setActiveProjectId 
  } = useStore();
  
  const [loading, setLoading] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await projectsApi.list();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  }, [setProjects]);

  // Load projects when token changes
  useEffect(() => {
    if (token) {
      loadProjects();
    } else {
      setProjects([]);
    }
  }, [token, loadProjects, setProjects]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error(t('Please enter a project name'));
      return;
    }

    try {
      const project = await projectsApi.create(newProjectName, undefined, newProjectColor);
      addProject(project);
      setShowNewDialog(false);
      setNewProjectName('');
      toast.success(t('Project created!'));
    } catch (error) {
      toast.error(t('Failed to create project'));
    }
  };

  const handleUpdateProject = async () => {
    if (!editingProjectId || !newProjectName.trim()) return;

    try {
      const updated = await projectsApi.update(editingProjectId, {
        name: newProjectName,
        color: newProjectColor
      });
      updateProject(editingProjectId, updated);
      setShowEditDialog(false);
      setEditingProjectId(null);
      toast.success(t('Project updated!'));
    } catch (error) {
      toast.error(t('Failed to update project'));
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    if (!confirm(t('Delete this project? Images will not be deleted.'))) return;

    try {
      await projectsApi.delete(projectId);
      removeProject(projectId);
      toast.success(t('Project deleted'));
    } catch (error) {
      toast.error(t('Failed to delete project'));
    }
  };

  const openEditDialog = (project: { id: number; name: string; color: string }) => {
    setEditingProjectId(project.id);
    setNewProjectName(project.name);
    setNewProjectColor(project.color);
    setShowEditDialog(true);
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 0 }}
        className={cn(
          'fixed left-0 top-0 z-30 h-full bg-background border-r border-border',
          'lg:relative lg:z-0',
          !sidebarOpen && 'overflow-hidden'
        )}
      >
        <div className="flex h-full w-[280px] flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-border">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden">
                <Image
                  src="/logo.png"
                  alt="ImageMagick WebGUI"
                  width={36}
                  height={36}
                  className="object-contain"
                  priority
                />
              </div>
              <div>
                <h1 className="font-semibold text-sm">ImageMagick</h1>
                <p className="text-xs text-muted-foreground">WebGUI</p>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* Projects section */}
          <ScrollArea className="flex-1 px-3 py-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('Projects')}
                </p>
                {token && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setNewProjectName('');
                      setNewProjectColor(PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]);
                      setShowNewDialog(true);
                    }}
                  >
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* All Images */}
              <button
                onClick={() => setActiveProjectId(null)}
                className={cn(
                  'sidebar-item w-full text-left',
                  activeProjectId === null && 'active'
                )}
              >
                <Images className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="truncate">{t('All Images')}</p>
                  <p className="text-xs text-muted-foreground">{t('View all uploaded images')}</p>
                </div>
              </button>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !token ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t('Log in to create projects and organize your images')}
                  </p>
                </div>
              ) : projects.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <Folder className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t('No projects yet')}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setNewProjectName('');
                      setNewProjectColor(PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]);
                      setShowNewDialog(true);
                    }}
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    {t('Create Project')}
                  </Button>
                </div>
              ) : (
                projects.map((project) => (
                  <div
                    key={project.id}
                    className={cn(
                      'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
                      activeProjectId === project.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    )}
                    onClick={() => setActiveProjectId(project.id)}
                  >
                    <div
                      className="h-4 w-4 rounded shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t(project.image_count === 1 ? '{count} image' : '{count} images', { count: project.image_count })}
                      </p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(project);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Bottom items */}
          <div className="border-t border-border px-3 py-3 space-y-1">
            {[
              { id: 'history', label: t('History'), icon: History, href: '/history' },
              { id: 'settings', label: t('Settings'), icon: Settings, href: '/settings' },
            ].map((item) => (
              <Link
                key={item.id}
                href={item.href!}
                className="sidebar-item w-full text-left"
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </motion.aside>

      {/* Toggle button (desktop) */}
      {!sidebarOpen && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          className="fixed left-4 top-4 z-30 lg:relative lg:left-0 lg:top-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* New Project Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Create New Project')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('Project Name')}</Label>
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder={t('My Project')}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateProject();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('Color')}</Label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "h-8 w-8 rounded-lg transition-all",
                      newProjectColor === color && "ring-2 ring-primary ring-offset-2"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewProjectColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleCreateProject}>
              {t('Create Project')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Edit Project')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('Project Name')}</Label>
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder={t('My Project')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUpdateProject();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('Color')}</Label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "h-8 w-8 rounded-lg transition-all",
                      newProjectColor === color && "ring-2 ring-primary ring-offset-2"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewProjectColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleUpdateProject}>
              {t('Save Changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
