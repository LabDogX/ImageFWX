'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Terminal,
  Loader2,
  Link2,
  Link2Off,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { operationsApi, imagesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import Editor from '@monaco-editor/react';
import { useLocale } from '@/components/providers/locale-provider';

export function OperationsPanel() {
  const { t } = useLocale();
  const { 
    activeCategory, 
    setActiveCategory,
    outputFormat,
    setOutputFormat,
    quality,
    setQuality,
    selectedImageIds,
    images,
  } = useStore();

  // Helper to get current valid selected IDs
  const getValidSelectedIds = () => {
    const state = useStore.getState();
    return state.selectedImageIds.filter(id => 
      state.images.some(img => img.id === id)
    );
  };

  const displaySelectedCount = selectedImageIds.filter(id => 
    images.some(img => img.id === id)
  ).length;

  // Resize state
  const [resizeMode, setResizeMode] = useState<'dimensions' | 'percent'>('dimensions');
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [percent, setPercent] = useState(50);
  const [preserveAspect, setPreserveAspect] = useState(true);
  const [resizeFit, setResizeFit] = useState('fit');
  const [aspectRatio, setAspectRatio] = useState(1.333); // Default 4:3

  // Rotate state
  const [rotation, setRotation] = useState(0);

  // Watermark state
  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkPosition, setWatermarkPosition] = useState('southeast');
  const [watermarkFontSize, setWatermarkFontSize] = useState(24);

  // Terminal state
  const [rawCommand, setRawCommand] = useState('');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [commandPreview, setCommandPreview] = useState('');

  // Sync category to valid ones for dashboard
  useEffect(() => {
    const validCategories = ['resize', 'rotate', 'watermark', 'advanced'];
    if (!validCategories.includes(activeCategory)) {
      setActiveCategory('resize');
    }
  }, [activeCategory, setActiveCategory]);

  // Update aspect ratio when selection changes
  useEffect(() => {
    const firstSelectedId = getValidSelectedIds()[0];
    const img = firstSelectedId ? images.find(image => image.id === firstSelectedId) : null;
    if (img && img.width && img.height) {
      const ratio = img.width / img.height;
      setAspectRatio(ratio);
      setWidth(img.width);
      setHeight(img.height);
    }
  }, [selectedImageIds, images]);

  // Handle width change with aspect ratio
  const handleWidthChange = useCallback((newWidth: number) => {
    setWidth(newWidth);
    if (preserveAspect && aspectRatio > 0) {
      setHeight(Math.round(newWidth / aspectRatio));
    }
  }, [preserveAspect, aspectRatio]);

  // Handle height change with aspect ratio
  const handleHeightChange = useCallback((newHeight: number) => {
    setHeight(newHeight);
    if (preserveAspect && aspectRatio > 0) {
      setWidth(Math.round(newHeight * aspectRatio));
    }
  }, [preserveAspect, aspectRatio]);

  // Build command preview
  useEffect(() => {
    const buildPreview = async () => {
      const ops: any[] = [];

      if (activeCategory === 'resize') {
        if (resizeMode === 'dimensions') {
          ops.push({
            operation: 'resize',
            params: { width, height, mode: resizeFit }
          });
        } else {
          ops.push({
            operation: 'resize',
            params: { percent }
          });
        }
      }

      if (activeCategory === 'rotate') {
        if (rotation !== 0) {
          ops.push({ operation: 'rotate', params: { angle: rotation } });
        }
      }

      if (activeCategory === 'watermark') {
        if (watermarkText) {
          ops.push({
            operation: 'watermark',
            params: {
              text: watermarkText,
              position: watermarkPosition,
              font_size: watermarkFontSize,
              opacity: 0.7
            }
          });
        }
      }

      if (activeCategory === 'advanced') {
        setCommandPreview(rawCommand || 'magick input.jpg [your options] output.jpg');
        return;
      }

      if (ops.length > 0) {
        try {
          const preview = await operationsApi.previewCommand(ops, outputFormat, quality);
          setCommandPreview(preview.command);
        } catch (error: any) {
          setCommandPreview(error.response?.data?.detail || t('Error building command'));
        }
      } else {
        setCommandPreview(t('Select operations to see command preview'));
      }
    };

    buildPreview();
  }, [activeCategory, width, height, percent, resizeMode, resizeFit, rotation, rawCommand, outputFormat, quality, watermarkText, watermarkPosition, watermarkFontSize, t]);

  // Refresh images helper
  const refreshImages = async () => {
    try {
      const imagesData = await imagesApi.list();
      const imagesList = Array.isArray(imagesData) ? imagesData : (imagesData.images || []);
      useStore.getState().setImages(imagesList.map((img: any) => ({
        id: img.id,
        originalFilename: img.original_filename,
        storedFilename: img.stored_filename,
        thumbnailUrl: img.thumbnail_url,
        mimeType: img.mime_type,
        fileSize: img.file_size,
        width: img.width,
        height: img.height,
        format: img.format,
        createdAt: img.created_at,
        projectId: img.project_id,
      })));
    } catch (e) {
      console.error('Failed to refresh images:', e);
    }
  };

  // Apply operations using SYNC endpoint for instant results
  const handleApply = async () => {
    const validIds = getValidSelectedIds();
    if (validIds.length === 0) {
      toast.error(t('No images selected'));
      return;
    }

    setIsProcessing(true);

    try {
      const ops: any[] = [];

      if (activeCategory === 'resize') {
        if (resizeMode === 'dimensions') {
          ops.push({
            operation: 'resize',
            params: { width, height, mode: resizeFit }
          });
        } else {
          ops.push({
            operation: 'resize',
            params: { percent }
          });
        }
      }

      if (activeCategory === 'rotate') {
        if (rotation !== 0) {
          ops.push({ operation: 'rotate', params: { angle: rotation } });
        }
      }

      if (activeCategory === 'watermark') {
        if (watermarkText) {
          ops.push({
            operation: 'watermark',
            params: {
              text: watermarkText,
              position: watermarkPosition,
              font_size: watermarkFontSize,
              opacity: 0.7
            }
          });
        }
      }

      if (activeCategory === 'advanced') {
        if (!rawCommand.trim()) {
          toast.error(t('Enter a command first'));
          setIsProcessing(false);
          return;
        }

        // For terminal mode, use async queue
        const result = await operationsApi.processRaw(validIds, rawCommand, outputFormat);
        toast.success(t('Job queued'), { description: t('Job ID: {id}', { id: result.job_id }) });
        setTimeout(refreshImages, 2000);
        setIsProcessing(false);
        return;
      }

      if (ops.length === 0) {
        toast.error(t('No operations to apply'));
        setIsProcessing(false);
        return;
      }

      // Process each image synchronously for instant feedback
      let successCount = 0;
      let errorCount = 0;

      for (const imageId of validIds) {
        try {
          await operationsApi.processSync(imageId, ops, outputFormat);
          successCount++;
        } catch (error: any) {
          console.error(`Failed to process image ${imageId}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(t('Processed {count} image(s)', { count: successCount }), {
          description: errorCount > 0 ? t('{count} failed', { count: errorCount }) : undefined
        });
      } else {
        toast.error(t('All operations failed'));
      }

      // Refresh gallery
      await refreshImages();

    } catch (error: any) {
      toast.error(t('Processing failed'), { description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick rotate buttons
  const handleQuickRotate = async (angle: number) => {
    const validIds = getValidSelectedIds();
    if (validIds.length === 0) {
      toast.error(t('No images selected'));
      return;
    }

    setIsProcessing(true);
    try {
      const ops = [{ operation: 'rotate', params: { angle } }];
      
      let successCount = 0;
      for (const imageId of validIds) {
        try {
          await operationsApi.processSync(imageId, ops, outputFormat);
          successCount++;
        } catch (e) {
          console.error(`Rotate failed for image ${imageId}:`, e);
        }
      }
      
      if (successCount > 0) {
        toast.success(t('Rotated {count} image(s) by {angle}°', { count: successCount, angle }));
        await refreshImages();
      } else {
        toast.error(t('Rotation failed'));
      }
    } catch (error: any) {
      toast.error(t('Rotation failed'), { description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick flip
  const handleFlip = async (direction: 'horizontal' | 'vertical') => {
    const validIds = getValidSelectedIds();
    if (validIds.length === 0) {
      toast.error(t('No images selected'));
      return;
    }

    setIsProcessing(true);
    try {
      const ops = [{ operation: direction === 'horizontal' ? 'flop' : 'flip', params: {} }];
      
      let successCount = 0;
      for (const imageId of validIds) {
        try {
          await operationsApi.processSync(imageId, ops, outputFormat);
          successCount++;
        } catch (e) {
          console.error(`Flip failed for image ${imageId}:`, e);
        }
      }
      
      if (successCount > 0) {
        toast.success(t('Flipped {count} image(s) {direction}', { count: successCount, direction: t(direction) }));
        await refreshImages();
      } else {
        toast.error(t('Flip failed'));
      }
    } catch (error: any) {
      toast.error(t('Flip failed'), { description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div 
      className="h-full flex flex-col bg-card rounded-2xl shadow-sm border border-border"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">{t('Quick Operations')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {displaySelectedCount > 0 
            ? t('{count} image(s) selected', { count: displaySelectedCount })
            : t('Select images to process')}
        </p>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="grid grid-cols-4 w-full mb-4">
            <TabsTrigger value="resize">{t('Resize')}</TabsTrigger>
            <TabsTrigger value="rotate">{t('Rotate')}</TabsTrigger>
            <TabsTrigger value="watermark">{t('Text')}</TabsTrigger>
            <TabsTrigger value="advanced">{t('Terminal')}</TabsTrigger>
          </TabsList>

          {/* Resize Tab */}
          <TabsContent value="resize" className="space-y-4 mt-4">
            <Tabs value={resizeMode} onValueChange={(v) => setResizeMode(v as any)}>
              <TabsList className="w-full">
                <TabsTrigger value="dimensions" className="flex-1">{t('Dimensions')}</TabsTrigger>
                <TabsTrigger value="percent" className="flex-1">{t('Percentage')}</TabsTrigger>
              </TabsList>

              <TabsContent value="dimensions" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('Width')}</Label>
                    <Input
                      type="number"
                      value={width}
                      onChange={(e) => handleWidthChange(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('Height')}</Label>
                    <Input
                      type="number"
                      value={height}
                      onChange={(e) => handleHeightChange(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreserveAspect(!preserveAspect)}
                  className="w-full flex items-center justify-center gap-2"
                >
                  {preserveAspect ? (
                    <>
                      <Link2 className="h-4 w-4" />
                      {t('Aspect Ratio Locked')}
                    </>
                  ) : (
                    <>
                      <Link2Off className="h-4 w-4" />
                      {t('Aspect Ratio Unlocked')}
                    </>
                  )}
                </Button>

                <div>
                  <Label className="text-xs text-muted-foreground">{t('Fit Mode')}</Label>
                  <Select value={resizeFit} onValueChange={setResizeFit}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fit">{t('Fit (within bounds)')}</SelectItem>
                      <SelectItem value="fill">{t('Fill (cover bounds)')}</SelectItem>
                      <SelectItem value="force">{t('Force (exact size)')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Quick presets */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">{t('Quick Presets')}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'HD', w: 1280, h: 720 },
                      { label: 'Full HD', w: 1920, h: 1080 },
                      { label: '4K', w: 3840, h: 2160 },
                      { label: 'Square', w: 1080, h: 1080 },
                    ].map((preset) => (
                      <Button
                        key={preset.label}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPreserveAspect(false);
                          setWidth(preset.w);
                          setHeight(preset.h);
                          setAspectRatio(preset.w / preset.h);
                        }}
                      >
                        {t(preset.label)}
                      </Button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="percent" className="space-y-4 mt-4">
                <div>
                  <Label className="text-xs text-muted-foreground">{t('Scale: {count}%', { count: percent })}</Label>
                  <Slider
                    value={[percent]}
                    onValueChange={([v]) => setPercent(v)}
                    min={10}
                    max={200}
                    step={5}
                    className="mt-2"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[25, 50, 75, 100, 150, 200].map((p) => (
                    <Button
                      key={p}
                      variant={percent === p ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPercent(p)}
                    >
                      {p}%
                    </Button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Rotate Tab */}
          <TabsContent value="rotate" className="space-y-4 mt-4">
            <div>
              <Label className="text-xs text-muted-foreground">{t('Rotation: {count}°', { count: rotation })}</Label>
              <Slider
                value={[rotation]}
                onValueChange={([v]) => setRotation(v)}
                min={-180}
                max={180}
                step={1}
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Button variant="outline" size="sm" onClick={() => handleQuickRotate(-90)} disabled={isProcessing}>
                <RotateCcw className="h-4 w-4 mr-1" /> -90°
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickRotate(90)} disabled={isProcessing}>
                <RotateCw className="h-4 w-4 mr-1" /> +90°
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickRotate(180)} disabled={isProcessing}>
                180°
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRotation(0)}>
                {t('Reset')}
              </Button>
            </div>

            <div className="pt-2 border-t">
              <Label className="text-xs text-muted-foreground mb-2 block">{t('Flip')}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => handleFlip('horizontal')} disabled={isProcessing}>
                  <FlipHorizontal className="h-4 w-4 mr-1" /> {t('Horizontal')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleFlip('vertical')} disabled={isProcessing}>
                  <FlipVertical className="h-4 w-4 mr-1" /> {t('Vertical')}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Watermark/Text Tab */}
          <TabsContent value="watermark" className="space-y-4 mt-4">
            <div>
              <Label className="text-xs text-muted-foreground">{t('Text')}</Label>
              <Input
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder={t('Enter watermark text...')}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">{t('Position')}</Label>
              <div className="grid grid-cols-3 gap-1 mt-2 p-2 bg-secondary rounded-lg">
                {['northwest', 'north', 'northeast', 'west', 'center', 'east', 'southwest', 'south', 'southeast'].map((pos) => (
                  <Button
                    key={pos}
                    variant={watermarkPosition === pos ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setWatermarkPosition(pos)}
                  >
                    {pos.replace('north', '↑').replace('south', '↓').replace('east', '→').replace('west', '←').replace('center', '•')}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">{t('Font Size: {count}pt', { count: watermarkFontSize })}</Label>
              <Slider
                value={[watermarkFontSize]}
                onValueChange={([v]) => setWatermarkFontSize(v)}
                min={8}
                max={72}
                step={2}
                className="mt-2"
              />
              <div className="flex gap-1 mt-2">
                {[12, 18, 24, 36, 48].map((size) => (
                  <Button
                    key={size}
                    variant={watermarkFontSize === size ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setWatermarkFontSize(size)}
                  >
                    {size}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Terminal Tab */}
          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="rounded-lg overflow-hidden border border-border">
              <div className="bg-gray-900 text-white px-3 py-2 text-xs flex items-center gap-2">
                <Terminal className="h-3 w-3" />
                <span>{t('ImageMagick Terminal')}</span>
              </div>
              <Editor
                height="200px"
                defaultLanguage="shell"
                theme="vs-dark"
                value={rawCommand}
                onChange={(v) => setRawCommand(v || '')}
                options={{
                  minimap: { enabled: false },
                  lineNumbers: 'off',
                  fontSize: 13,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                }}
              />
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>{t('Use %input% for input file')}</p>
              <p>{t('Use %output% for output file')}</p>
              <p className="text-amber-600">⚠️ {t('Some commands are blocked for security')}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t('Quick Commands')}</Label>
              <div className="grid grid-cols-1 gap-1">
                {[
                  { label: 'Grayscale', cmd: '-colorspace Gray' },
                  { label: 'Sepia', cmd: '-sepia-tone 80%' },
                  { label: 'Negate', cmd: '-negate' },
                  { label: 'Auto-enhance', cmd: '-enhance -normalize' },
                ].map((item) => (
                  <Button
                    key={item.label}
                    variant="outline"
                    size="sm"
                    className="justify-start text-xs"
                    onClick={() => setRawCommand(item.cmd)}
                  >
                    {t(item.label)}: <code className="ml-1 text-muted-foreground">{item.cmd}</code>
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Output Format */}
          <div className="mt-6 pt-4 border-t border-border space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">{t('Output Format')}</Label>
              <Select value={outputFormat} onValueChange={setOutputFormat}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="webp">{t('WebP (recommended)')}</SelectItem>
                  <SelectItem value="jpg">JPEG</SelectItem>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="avif">AVIF</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {outputFormat !== 'png' && (
              <div>
                <Label className="text-xs text-muted-foreground">{t('Quality: {count}%', { count: quality })}</Label>
                <Slider
                  value={[quality]}
                  onValueChange={([v]) => setQuality(v)}
                  min={1}
                  max={100}
                  step={1}
                  className="mt-2"
                />
              </div>
            )}
          </div>

          {/* Command Preview */}
          <div className="mt-4 p-3 bg-secondary rounded-lg">
            <Label className="text-xs text-muted-foreground mb-1 block">{t('Command Preview')}</Label>
            <code className="text-xs text-foreground break-all block">{commandPreview}</code>
          </div>
        </Tabs>
      </ScrollArea>

      {/* Actions - only Apply button, no duplicate Download/Delete */}
      <div className="p-4 border-t border-border">
        <Button 
          className="w-full" 
          onClick={handleApply}
          disabled={isProcessing || displaySelectedCount === 0}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('Processing...')}
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              {t('Apply to {count} image(s)', { count: displaySelectedCount })}
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
