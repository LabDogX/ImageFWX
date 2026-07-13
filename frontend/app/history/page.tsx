'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Trash2, 
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FileDown,
  Crop,
  Wand2,
  Eraser,
  RotateCw,
  Palette,
  Type,
  Sliders,
  Sparkles,
  ImageIcon
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { queueApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Locale, useLocale } from '@/components/providers/locale-provider';

interface Job {
  id: number;
  job_id: string;
  operation: string;
  status: string;
  progress: number;
  error_message: string | null;
  input_files: number[];
  output_files: string[];
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  parameters: Record<string, any>;
}

type Translate = (message: string, values?: Record<string, string | number>) => string;

function formatDate(dateStr: string, locale: Locale) {
  const date = new Date(dateStr);
  return date.toLocaleString(locale === 'zh-CN' ? 'zh-CN' : 'en-US');
}

// Parse operation details from job
function getOperationDetails(job: Job, t: Translate): { name: string; icon: React.ReactNode; description: string } {
  const params = job.parameters || {};
  const operations = params.operations || [];
  
  // Check for specific operation types
  if (job.operation === 'remove_background' || job.job_id?.startsWith('bg_removal')) {
    return {
      name: t('Remove Background'),
      icon: <Eraser className="h-4 w-4 text-purple-500" />,
      description: t('AI background removal')
    };
  }
  
  // Parse operations array
  if (operations.length > 0) {
    const opTypes = operations.map((op: any) => op.operation || op.type).filter(Boolean);
    
    if (opTypes.includes('crop')) {
      const cropOp = operations.find((op: any) => op.operation === 'crop');
      const cropParams = cropOp?.params || {};
      return {
        name: t('Crop'),
        icon: <Crop className="h-4 w-4 text-blue-500" />,
        description: cropParams.width && cropParams.height 
          ? `${cropParams.width}×${cropParams.height}px` 
          : t('Image cropped')
      };
    }
    
    if (opTypes.includes('resize')) {
      const resizeOp = operations.find((op: any) => op.operation === 'resize');
      const p = resizeOp?.params || {};
      return {
        name: t('Resize'),
        icon: <ImageIcon className="h-4 w-4 text-green-500" />,
        description: p.width && p.height ? `${p.width}×${p.height}px` : t('Image resized')
      };
    }
    
    if (opTypes.includes('rotate')) {
      const rotateOp = operations.find((op: any) => op.operation === 'rotate');
      return {
        name: t('Rotate'),
        icon: <RotateCw className="h-4 w-4 text-orange-500" />,
        description: `${rotateOp?.params?.angle || 0}°`
      };
    }
    
    if (opTypes.includes('watermark')) {
      const wmOp = operations.find((op: any) => op.operation === 'watermark');
      return {
        name: t('Watermark'),
        icon: <Type className="h-4 w-4 text-pink-500" />,
        description: wmOp?.params?.text ? `"${wmOp.params.text}"` : t('Text added')
      };
    }
    
    if (opTypes.includes('blur') || opTypes.includes('sharpen')) {
      return {
        name: t('Filter'),
        icon: <Wand2 className="h-4 w-4 text-indigo-500" />,
        description: t('Filters applied')
      };
    }
    
    if (opTypes.includes('brightness-contrast') || opTypes.includes('modulate')) {
      return {
        name: t('Adjustments'),
        icon: <Sliders className="h-4 w-4 text-cyan-500" />,
        description: t('Brightness/contrast/saturation')
      };
    }
    
    if (opTypes.includes('auto-orient') || opTypes.includes('enhance') || opTypes.includes('auto-level')) {
      return {
        name: t('Auto Enhance'),
        icon: <Sparkles className="h-4 w-4 text-yellow-500" />,
        description: t('Auto enhancement applied')
      };
    }
    
    if (opTypes.includes('convert') || opTypes.includes('quality')) {
      const fmt = params.output_format || 'image';
      return {
        name: t('Convert'),
        icon: <Palette className="h-4 w-4 text-teal-500" />,
        description: t('Format: {format}', { format: fmt.toUpperCase() })
      };
    }
    
    // Multiple operations
    if (opTypes.length > 1) {
      return {
        name: t('Multiple Edits'),
        icon: <Sliders className="h-4 w-4 text-blue-500" />,
        description: t('{count} edits', { count: opTypes.length })
      };
    }
    
    // Single unknown operation
    if (opTypes.length === 1) {
      return {
        name: t('Image Processing'),
        icon: <Wand2 className="h-4 w-4 text-gray-500" />,
        description: ''
      };
    }
  }
  
  // Default fallback
  return {
    name: t('Image Processing'),
    icon: <ImageIcon className="h-4 w-4 text-gray-500" />,
    description: ''
  };
}

function JobCard({ job, onDelete }: { job: Job; onDelete: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const { locale, t } = useLocale();
  const opDetails = getOperationDetails(job, t);

  const handleDownload = async () => {
    if (job.status !== 'completed' || job.output_files.length === 0) return;
    
    setDownloading(true);
    try {
      const blob = await queueApi.downloadResults(job.job_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `processed_${job.job_id.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('Download started!'));
    } catch (error) {
      toast.error(t('Download failed'));
    } finally {
      setDownloading(false);
    }
  };

  const statusIcon = {
    pending: <Clock className="h-4 w-4 text-yellow-500" />,
    processing: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
    completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
    cancelled: <XCircle className="h-4 w-4 text-muted-foreground" />,
  }[job.status] || <Clock className="h-4 w-4" />;

  const statusLabel = {
    pending: t('Pending'),
    processing: t('Processing'),
    completed: t('Completed'),
    failed: t('Failed'),
    cancelled: t('Cancelled'),
  }[job.status] || job.status;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl border border-border bg-card"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-secondary">
            {opDetails.icon}
          </div>
          <div>
            <p className="font-medium">{opDetails.name}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {formatDate(job.created_at, locale)}
              </p>
              {opDetails.description && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <p className="text-xs text-muted-foreground">{opDetails.description}</p>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-xs px-2 py-1 rounded-full',
            job.status === 'completed' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            job.status === 'failed' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            job.status === 'processing' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            job.status === 'pending' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
          )}>
            {statusLabel}
          </span>
        </div>
      </div>

      {job.status === 'processing' && (
        <div className="mt-3">
          <Progress value={job.progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">{t('{count}% complete', { count: job.progress })}</p>
        </div>
      )}

      {job.error_message && (
        <p className="mt-2 text-xs text-red-500">{job.error_message}</p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t('{count} input file(s)', { count: job.input_files.length })}
          {job.status === 'completed' && ` → ${t('{count} output file(s)', { count: job.output_files.length })}`}
        </p>
        
        <div className="flex gap-2">
          {job.status === 'completed' && job.output_files.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <FileDown className="h-4 w-4 mr-1" />
                  {t('Download')}
                </>
              )}
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function HistoryPage() {
  const { t } = useLocale();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await queueApi.listJobs(filter || undefined, 100);
      setJobs(data);
    } catch (error) {
      toast.error(t('Failed to load history'));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    const hasActiveJobs = jobs.some(j => j.status === 'pending' || j.status === 'processing');
    if (!hasActiveJobs) return;

    const interval = setInterval(loadJobs, 2000);
    return () => clearInterval(interval);
  }, [jobs, loadJobs]);

  const handleDelete = async (jobId: string) => {
    try {
      await queueApi.deleteJob(jobId);
      setJobs(jobs.filter(j => j.job_id !== jobId));
      toast.success(t('Job deleted'));
    } catch (error) {
      toast.error(t('Failed to delete job'));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-semibold">{t('Processing History')}</h1>
          </div>
          
          <Button variant="outline" size="sm" onClick={loadJobs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('Refresh')}
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex gap-2">
          {[
            { value: null, label: t('All') },
            { value: 'completed', label: t('Completed') },
            { value: 'processing', label: t('Processing') },
            { value: 'failed', label: t('Failed') },
          ].map(({ value, label }) => (
            <Button
              key={label}
              variant={filter === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 pb-8">
        {loading && jobs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium">{t('No processing history')}</h2>
            <p className="text-muted-foreground mt-1">
              {t('Process some images to see them here')}
            </p>
            <Link href="/">
              <Button className="mt-4">{t('Go to Editor')}</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobCard
                key={job.job_id}
                job={job}
                onDelete={() => handleDelete(job.job_id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
