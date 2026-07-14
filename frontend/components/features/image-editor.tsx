"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { 
  X, ZoomIn, ZoomOut, RotateCcw, RotateCw, FlipHorizontal, FlipVertical,
  Type, Sliders, Wand2, Download, Loader2, Undo2, Crop as CropIcon,
  Sun, Contrast, Droplets, Sparkles, Eraser, Square, Check, Save, FileImage,
  Maximize2, Link2, Link2Off
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { BorderPanel } from "@/components/features/border-panel";
import { BorderSettings, defaultBorderSettings } from "@/lib/border-presets";
import { useLocale } from '@/components/providers/locale-provider';

// Import proper API URL function
import { getApiUrl } from '@/lib/api';

// Helper to get auth headers
const getAuthHeaders = (): HeadersInit => {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return headers;
};

interface ImageEditorProps {
  image: {
    id: number;
    originalFilename: string;
    mimeType?: string;
  };
  onClose: () => void;
  onSave: () => void;
}

type WatermarkFont =
  | 'sans' | 'sans-bold' | 'sans-condensed'
  | 'serif' | 'serif-bold' | 'serif-italic'
  | 'mono' | 'mono-bold'
  | 'source-han-sans' | 'source-han-serif'
  | 'noto-sans-sc' | 'noto-sans-sc-bold' | 'noto-serif-sc' | 'noto-serif-sc-bold'
  | 'noto-sans-tc' | 'noto-serif-tc'
  | 'noto-sans-jp' | 'noto-serif-jp'
  | 'noto-sans-kr' | 'noto-serif-kr';

interface EditorState {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  hue: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  watermarkText: string;
  watermarkKind: 'text' | 'image';
  watermarkPosition: string;
  watermarkFontSize: number;
  watermarkOpacity: number;
  watermarkColor: string;
  watermarkShadowColor: string;
  watermarkFont: WatermarkFont;
  watermarkImageId: number | null;
  watermarkImageScale: number;
  watermarkOffsetX: number;
  watermarkOffsetY: number;
  // Resize
  resizeWidth: number;
  resizeHeight: number;
  resizePercent: number;
  resizeMode: 'dimensions' | 'percent';
  resizeFit: string;
  keepAspectRatio: boolean;
  border: BorderSettings;
}

const defaultState: EditorState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  hue: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  watermarkText: "",
  watermarkKind: 'text',
  watermarkPosition: "southeast",
  watermarkFontSize: 24,
  watermarkOpacity: 70,
  watermarkColor: '#FFFFFF',
  watermarkShadowColor: '#000000',
  // Noto CJK is installed in the production image and renders both Chinese
  // and Latin watermark text consistently with the browser preview.
  watermarkFont: 'noto-sans-sc',
  watermarkImageId: null,
  watermarkImageScale: 20,
  watermarkOffsetX: 0,
  watermarkOffsetY: 0,
  // Resize
  resizeWidth: 800,
  resizeHeight: 600,
  resizePercent: 100,
  resizeMode: 'dimensions',
  resizeFit: 'contain',
  keepAspectRatio: true,
  border: defaultBorderSettings,
};

const watermarkPreviewFonts: Record<WatermarkFont, string> = {
  sans: 'Arial, Helvetica, sans-serif',
  'sans-bold': 'Arial Black, Arial, Helvetica, sans-serif',
  'sans-condensed': 'Arial Narrow, Arial, Helvetica, sans-serif',
  serif: 'Georgia, serif',
  'serif-bold': 'Georgia, serif',
  'serif-italic': 'Georgia, serif',
  mono: 'ui-monospace, monospace',
  'mono-bold': 'ui-monospace, monospace',
  'source-han-sans': '"Noto Sans CJK SC", "Source Han Sans CN", sans-serif',
  'source-han-serif': '"Noto Serif CJK SC", "Source Han Serif CN", serif',
  'noto-sans-sc': '"Noto Sans CJK SC", "Source Han Sans CN", sans-serif',
  'noto-sans-sc-bold': '"Noto Sans CJK SC", "Source Han Sans CN", sans-serif',
  'noto-serif-sc': '"Noto Serif CJK SC", "Source Han Serif CN", serif',
  'noto-serif-sc-bold': '"Noto Serif CJK SC", "Source Han Serif CN", serif',
  'noto-sans-tc': '"Noto Sans CJK TC", "Source Han Sans TC", sans-serif',
  'noto-serif-tc': '"Noto Serif CJK TC", "Source Han Serif TC", serif',
  'noto-sans-jp': '"Noto Sans CJK JP", "Source Han Sans JP", sans-serif',
  'noto-serif-jp': '"Noto Serif CJK JP", "Source Han Serif JP", serif',
  'noto-sans-kr': '"Noto Sans CJK KR", "Source Han Sans KR", sans-serif',
  'noto-serif-kr': '"Noto Serif CJK KR", "Source Han Serif KR", serif',
};

const watermarkFontOptions: ReadonlyArray<{ value: WatermarkFont; label: string }> = [
  { value: 'sans', label: 'Sans' },
  { value: 'sans-bold', label: 'Sans Bold' },
  { value: 'sans-condensed', label: 'Sans Condensed' },
  { value: 'serif', label: 'Serif' },
  { value: 'serif-bold', label: 'Serif Bold' },
  { value: 'serif-italic', label: 'Serif Italic' },
  { value: 'mono', label: 'Mono' },
  { value: 'mono-bold', label: 'Mono Bold' },
  { value: 'source-han-sans', label: 'Source Han Sans / 思源黑体' },
  { value: 'source-han-serif', label: 'Source Han Serif / 思源宋体' },
  { value: 'noto-sans-sc', label: 'Noto Sans CJK SC / 简体黑体' },
  { value: 'noto-sans-sc-bold', label: 'Noto Sans CJK SC Bold / 简体粗黑' },
  { value: 'noto-serif-sc', label: 'Noto Serif CJK SC / 简体宋体' },
  { value: 'noto-serif-sc-bold', label: 'Noto Serif CJK SC Bold / 简体粗宋' },
  { value: 'noto-sans-tc', label: 'Noto Sans CJK TC / 繁體黑體' },
  { value: 'noto-serif-tc', label: 'Noto Serif CJK TC / 繁體明體' },
  { value: 'noto-sans-jp', label: 'Noto Sans CJK JP / 日本語ゴシック' },
  { value: 'noto-serif-jp', label: 'Noto Serif CJK JP / 日本語明朝' },
  { value: 'noto-sans-kr', label: 'Noto Sans CJK KR / 한국어 고딕' },
  { value: 'noto-serif-kr', label: 'Noto Serif CJK KR / 한국어 명조' },
];

export function ImageEditor({ image, onClose, onSave }: ImageEditorProps) {
  const { t } = useLocale();
  // PDF check
  const isPdf = image.mimeType?.includes('pdf') || image.originalFilename.toLowerCase().endsWith('.pdf');
  
  // Current image (may change after crop or AI)
  const [currentImageId, setCurrentImageId] = useState(image.id);
  // For PDF, use preview endpoint
  const [imageSrc, setImageSrc] = useState(
    isPdf 
      ? `${getApiUrl()}/api/images/${image.id}/preview?t=${Date.now()}`
      : `${getApiUrl()}/api/images/${image.id}?t=${Date.now()}`
  );
  
  // Filename editing
  const [displayFilename, setDisplayFilename] = useState(image.originalFilename);
  const [isEditingFilename, setIsEditingFilename] = useState(false);
  const [editingFilename, setEditingFilename] = useState(image.originalFilename);
  const filenameInputRef = useRef<HTMLInputElement>(null);
  
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Editor state
  const [state, setState] = useState<EditorState>({ ...defaultState });
  const [savedState, setSavedState] = useState<EditorState>({ ...defaultState });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Crop state
  const [cropMode, setCropMode] = useState(false);
  const [cropStart, setCropStart] = useState<{x: number, y: number} | null>(null);
  const [cropEnd, setCropEnd] = useState<{x: number, y: number} | null>(null);
  const [cropArea, setCropArea] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  
  // Image dimensions
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  
  // UI state
  const [zoom, setZoom] = useState(1);
  const [activeTab, setActiveTab] = useState("adjust");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const previewRequestRef = useRef(0);
  const [isBorderPreviewing, setIsBorderPreviewing] = useState(false);

  // A debounced backend preview uses the exact ImageMagick command builder used
  // by export.  Old responses are ignored so a fast slider cannot repaint stale data.
  useEffect(() => {
    if (!state.border.enabled) return;
    const requestId = ++previewRequestRef.current;
    const timer = window.setTimeout(async () => {
      setIsBorderPreviewing(true);
      try {
        const response = await fetch(`${getApiUrl()}/api/operations/live-preview`, {
          method: 'POST', headers: getAuthHeaders(),
          body: JSON.stringify({ image_id: currentImageId, operations: buildOperations(), max_size: 800 }),
        });
        const data = await response.json();
        if (response.ok && data.preview && requestId === previewRequestRef.current) setImageSrc(data.preview);
      } catch { /* keep the last valid preview */ }
      finally { if (requestId === previewRequestRef.current) setIsBorderPreviewing(false); }
    }, 350);
    return () => window.clearTimeout(timer);
  // The serialized settings avoid a new effect from unrelated editor state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentImageId, JSON.stringify(state.border)]);

  // A border preview is a temporary backend-rendered image.  Once the border
  // is turned off, restore the actual library image instead of leaving the
  // last preview (which made preset changes look as if they had no effect).
  useEffect(() => {
    if (state.border.enabled) return;
    previewRequestRef.current += 1;
    setIsBorderPreviewing(false);
    const source = isPdf
      ? `${getApiUrl()}/api/images/${currentImageId}/preview`
      : `${getApiUrl()}/api/images/${currentImageId}`;
    setImageSrc(`${source}?t=${Date.now()}`);
  }, [currentImageId, isPdf, state.border.enabled]);
  
  // Separate AI processing states
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  
  // Get format from store - always use current value
  const globalFormat = useStore((state) => state.outputFormat);
  const globalQuality = useStore((state) => state.quality);
  const libraryImages = useStore((state) => state.images);
  
  // Use store values directly, with local override capability
  const [outputFormat, setOutputFormat] = useState("webp");
  const [quality, setLocalQuality] = useState(85);
  
  // Sync with global settings whenever they change
  useEffect(() => {
    setOutputFormat(globalFormat || "webp");
    setLocalQuality(globalQuality || 85);
  }, [globalFormat, globalQuality]);
  
  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(state) !== JSON.stringify(savedState);
    setHasUnsavedChanges(changed);
  }, [state, savedState]);
  
  // Handle filename editing
  const startEditingFilename = useCallback(() => {
    setEditingFilename(displayFilename);
    setIsEditingFilename(true);
    setTimeout(() => filenameInputRef.current?.focus(), 50);
  }, [displayFilename]);
  
  const saveFilename = useCallback(async () => {
    const newName = editingFilename.trim();
    if (!newName || newName === displayFilename) {
      setIsEditingFilename(false);
      return;
    }
    
    try {
      const response = await fetch(`${getApiUrl()}/api/images/${currentImageId}/rename`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ new_name: newName }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to rename');
      }
      
      const data = await response.json();
      setDisplayFilename(data.original_filename);
      toast.success(t('Filename updated'));
    } catch (error) {
      toast.error(t('Failed to rename file'));
      setEditingFilename(displayFilename);
    } finally {
      setIsEditingFilename(false);
    }
  }, [editingFilename, displayFilename, currentImageId, t]);
  
  const handleFilenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveFilename();
    } else if (e.key === 'Escape') {
      setIsEditingFilename(false);
      setEditingFilename(displayFilename);
    }
  }, [saveFilename, displayFilename]);
  
  // Update image rect on load/resize
  const updateImageRect = useCallback(() => {
    if (imageRef.current) {
      const w = imageRef.current.naturalWidth;
      const h = imageRef.current.naturalHeight;
      setNaturalSize({ w, h });
      setImageDimensions({ width: w, height: h });
      // Set initial resize dimensions based on actual image
      if (w > 0 && h > 0) {
        setState(s => ({ 
          ...s, 
          resizeWidth: w, 
          resizeHeight: h 
        }));
        // Also update savedState so it doesn't show as "unsaved"
        setSavedState(s => ({
          ...s,
          resizeWidth: w,
          resizeHeight: h
        }));
      }
    }
  }, []);
  
  useEffect(() => {
    window.addEventListener('resize', updateImageRect);
    return () => window.removeEventListener('resize', updateImageRect);
  }, [updateImageRect]);
  
  // CSS filters for live preview
  const getCssFilters = useCallback(() => {
    const filters = [];
    if (state.brightness !== 100) filters.push(`brightness(${state.brightness}%)`);
    if (state.contrast !== 100) filters.push(`contrast(${state.contrast}%)`);
    if (state.saturation !== 100) filters.push(`saturate(${state.saturation}%)`);
    if (state.blur > 0) filters.push(`blur(${state.blur}px)`);
    if (state.hue !== 0) filters.push(`hue-rotate(${state.hue}deg)`);
    return filters.length > 0 ? filters.join(' ') : 'none';
  }, [state]);
  
  const getCssTransform = useCallback(() => {
    const transforms = [`scale(${zoom})`];
    if (state.rotation !== 0) transforms.push(`rotate(${state.rotation}deg)`);
    if (state.flipH) transforms.push('scaleX(-1)');
    if (state.flipV) transforms.push('scaleY(-1)');
    return transforms.join(' ');
  }, [state, zoom]);
  
  // Crop mouse handlers - relative to image
  const handleCropMouseDown = (e: React.MouseEvent) => {
    if (!cropMode || !imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Only start if inside image
    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      setCropStart({ x, y });
      setCropEnd({ x, y });
      setIsCropping(true);
      setCropArea(null);
    }
  };
  
  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isCropping || !imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    
    // Clamp to image bounds
    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));
    
    setCropEnd({ x, y });
  };
  
  const handleCropMouseUp = () => {
    if (!isCropping || !cropStart || !cropEnd) return;
    setIsCropping(false);
    
    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const w = Math.abs(cropEnd.x - cropStart.x);
    const h = Math.abs(cropEnd.y - cropStart.y);
    
    if (w > 20 && h > 20) {
      setCropArea({ x, y, w, h });
    }
    setCropStart(null);
    setCropEnd(null);
  };
  
  // Get current crop display style
  const getCropDisplayStyle = () => {
    if (cropStart && cropEnd) {
      return {
        left: Math.min(cropStart.x, cropEnd.x),
        top: Math.min(cropStart.y, cropEnd.y),
        width: Math.abs(cropEnd.x - cropStart.x),
        height: Math.abs(cropEnd.y - cropStart.y),
      };
    }
    if (cropArea) {
      return {
        left: cropArea.x,
        top: cropArea.y,
        width: cropArea.w,
        height: cropArea.h,
      };
    }
    return null;
  };
  
  // Apply crop immediately
  const applyCrop = async () => {
    if (!cropArea || !imageRef.current) return;
    
    setIsProcessing(true);
    setProcessingMessage(t('Applying crop...'));
    
    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = naturalSize.w / rect.width;
    const scaleY = naturalSize.h / rect.height;
    
    const cropParams = {
      x: Math.round(cropArea.x * scaleX),
      y: Math.round(cropArea.y * scaleY),
      width: Math.round(cropArea.w * scaleX),
      height: Math.round(cropArea.h * scaleY),
    };
    
    try {
      const res = await fetch(`${getApiUrl()}/api/operations/process-sync`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          image_id: currentImageId,
          operations: [{ operation: "crop", params: cropParams }],
          output_format: "jpg",
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setCurrentImageId(data.image_id);
        setImageSrc(`${getApiUrl()}${data.image_url}?t=${Date.now()}`);
        setCropArea(null);
        setCropMode(false);
        toast.success(t('Crop applied!'));
      } else {
        const err = await res.json();
        toast.error(t('Crop failed'), { description: err.detail });
      }
    } catch {
      toast.error(t('Crop failed'));
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  };
  
  // Save current filter/adjustment state
  const handleSave = async () => {
    // Apply filters to create a new saved version
    const ops = buildOperations();
    
    if (ops.length === 0) {
      setSavedState({ ...state });
      setHasUnsavedChanges(false);
      toast.success(t('Changes saved'));
      return;
    }
    
    setIsProcessing(true);
    setProcessingMessage(t('Saving changes...'));
    
    try {
      const res = await fetch(`${getApiUrl()}/api/operations/process-sync`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          image_id: currentImageId,
          operations: ops,
          output_format: "jpg",
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setCurrentImageId(data.image_id);
        setImageSrc(`${getApiUrl()}${data.image_url}?t=${Date.now()}`);
        // Reset state since changes are now baked in
        setState({ ...defaultState });
        setSavedState({ ...defaultState });
        setHasUnsavedChanges(false);
        toast.success(t('Changes saved!'));
      } else {
        const err = await res.json();
        toast.error(t('Save failed'), { description: err.detail });
      }
    } catch {
      toast.error(t('Save failed'));
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  };
  
  // Tab change with save check
  const handleTabChange = (newTab: string) => {
    // Allow switching tabs without save dialog - changes are preserved
    setActiveTab(newTab);
    // Enable crop mode when switching to crop tab
    if (newTab === "crop") {
      setCropMode(true);
    } else {
      setCropMode(false);
      setCropArea(null);
    }
  };
  
  const discardAndContinue = () => {
    setState({ ...savedState });
    setShowSaveDialog(false);
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
  };
  
  const saveAndContinue = async () => {
    setShowSaveDialog(false);
    await handleSave();
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
  };
  
  // Quick actions
  const rotateLeft = () => setState(s => ({ ...s, rotation: s.rotation - 90 }));
  const rotateRight = () => setState(s => ({ ...s, rotation: s.rotation + 90 }));
  
  const resetAll = () => {
    setState({ ...defaultState });
    setSavedState({ ...defaultState });
    setCropMode(false);
    setCropArea(null);
    toast.info(t('Reset to defaults'));
  };
  
  // Quick filters
  const applyGrayscale = () => setState(s => ({ ...s, saturation: 0 }));
  const applySepia = () => setState(s => ({ ...s, saturation: 50, hue: 30 }));
  const applyVintage = () => setState(s => ({ ...s, contrast: 120, saturation: 80, brightness: 95 }));
  const applyHighContrast = () => setState(s => ({ ...s, contrast: 150 }));
  const applyBright = () => setState(s => ({ ...s, brightness: 130, contrast: 90 }));
  const applyDark = () => setState(s => ({ ...s, brightness: 70, contrast: 110 }));
  
  // Build operations for processing
  const buildOperations = () => {
    const ops: any[] = [];
    
    // Resize first (if changed from original)
    if (state.resizeMode === 'dimensions') {
      const originalW = imageDimensions?.width || 800;
      const originalH = imageDimensions?.height || 600;
      if (state.resizeWidth !== originalW || state.resizeHeight !== originalH) {
        ops.push({ operation: "resize", params: { width: state.resizeWidth, height: state.resizeHeight, mode: state.resizeFit } });
      }
    } else if (state.resizeMode === 'percent' && state.resizePercent !== 100) {
      ops.push({ operation: "resize", params: { percent: state.resizePercent } });
    }
    
    if (state.rotation !== 0) ops.push({ operation: "rotate", params: { angle: state.rotation } });
    if (state.flipV) ops.push({ operation: "flip", params: {} });
    if (state.flipH) ops.push({ operation: "flop", params: {} });
    
    const br = state.brightness - 100;
    const co = state.contrast - 100;
    if (br !== 0 || co !== 0) {
      ops.push({ operation: "brightness-contrast", params: { brightness: br, contrast: co } });
    }
    
    if (state.saturation !== 100) {
      ops.push({ operation: "modulate", params: { brightness: 100, saturation: state.saturation, hue: 100 } });
    }
    
    if (state.blur > 0) ops.push({ operation: "blur", params: { radius: 0, sigma: state.blur } });
    
    if (state.hue !== 0) {
      const hueVal = 100 + (state.hue / 1.8);
      ops.push({ operation: "modulate", params: { brightness: 100, saturation: 100, hue: Math.round(hueVal) } });
    }
    if (state.border.enabled) {
      ops.push({ operation: "border", params: {
        mode: state.border.mode, unit: state.border.unit, top: state.border.top, right: state.border.right,
        bottom: state.border.bottom, left: state.border.left, color: state.border.color,
        inner_unit: state.border.innerUnit, inner_size: state.border.innerSize, inner_color: state.border.innerColor,
        target_ratio: state.border.targetRatio, horizontal_alignment: state.border.horizontalAlignment,
        vertical_alignment: state.border.verticalAlignment,
        shadow_enabled: state.border.shadowEnabled, shadow_color: state.border.shadowColor,
        shadow_opacity: state.border.shadowOpacity, shadow_blur: state.border.shadowBlur,
        shadow_offset_x: state.border.shadowOffsetX, shadow_offset_y: state.border.shadowOffsetY,
      }});
    }
    
    if (state.watermarkKind === 'text' && state.watermarkText.trim()) {
      ops.push({ operation: "watermark", params: { text: state.watermarkText, position: state.watermarkPosition, font_size: state.watermarkFontSize, opacity: state.watermarkOpacity / 100, color: state.watermarkColor, shadow_color: state.watermarkShadowColor, font: state.watermarkFont } });
    } else if (state.watermarkKind === 'image' && state.watermarkImageId) {
      ops.push({ operation: "image-watermark", params: { image_id: state.watermarkImageId, position: state.watermarkPosition, scale: state.watermarkImageScale, opacity: state.watermarkOpacity / 100, offset_x: state.watermarkOffsetX, offset_y: state.watermarkOffsetY } });
    }
    
    return ops;
  };
  
  // Download directly - process and download file immediately
  const handleDownload = async () => {
    const ops = buildOperations();
    ops.push({ operation: "quality", params: { value: quality } });
    
    setIsProcessing(true);
    setProcessingMessage(t('Processing and downloading...'));
    
    try {
      const res = await fetch(`${getApiUrl()}/api/operations/download-direct`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          image_id: currentImageId,
          operations: ops,
          output_format: outputFormat,
          quality
        })
      });
      
      if (res.ok) {
        // Get filename from header or generate
        const contentDisposition = res.headers.get('Content-Disposition');
        let filename = `edited_${image.originalFilename.split('.')[0]}.${outputFormat}`;
        if (contentDisposition) {
          const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (match) filename = match[1].replace(/['"]/g, '');
        }
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success(t('Downloaded!'));
      } else {
        const err = await res.json();
        toast.error(t('Download failed'), { description: err.detail });
      }
    } catch (e) {
      console.error(e);
      toast.error(t('Download failed'));
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  };
  
  // AI Remove Background - synchronous with blur overlay
  const handleRemoveBackground = async () => {
    setIsRemovingBg(true);
    setProcessingMessage(t('Removing background with AI... This may take 30-60 seconds'));
    
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min timeout
      
      // Use sync endpoint for immediate result
      const res = await fetch(`${getApiUrl()}/api/operations/remove-background-sync`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ image_id: currentImageId, alpha_matting: false }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.image_url) {
          setCurrentImageId(data.image_id);
          setImageSrc(`${getApiUrl()}${data.image_url}?t=${Date.now()}`);
          toast.success(t('Background removed!'));
        } else {
          toast.error(t('No result returned'));
        }
      } else {
        const err = await res.json().catch(() => ({ detail: t('Unknown error') }));
        toast.error(t('Failed'), { description: err.detail || t('AI service unavailable') });
      }
    } catch (e: any) {
      console.error("Remove background error:", e);
      if (e.name === 'AbortError') {
        toast.error(t('Operation timed out'), { description: t('Try with a smaller image') });
      } else {
        toast.error(t('Failed to remove background'), { description: e.message });
      }
    } finally {
      setIsRemovingBg(false);
      setProcessingMessage("");
    }
  };
  
  // Auto enhance
  const handleAutoEnhance = async () => {
    setIsEnhancing(true);
    setProcessingMessage(t('Enhancing...'));
    
    try {
      const res = await fetch(`${getApiUrl()}/api/operations/process-sync`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          image_id: currentImageId,
          operations: [
            { operation: "auto-orient", params: {} },
            { operation: "enhance", params: {} },
            { operation: "auto-level", params: {} },
          ],
          output_format: "png",  // Use PNG to preserve quality
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setCurrentImageId(data.image_id);
        setImageSrc(`${getApiUrl()}${data.image_url}?t=${Date.now()}`);
        toast.success(t('Image enhanced!'));
      } else {
        toast.error(t('Enhancement failed'));
      }
    } catch (e) {
      console.error("Enhance error:", e);
      toast.error(t('Failed'));
    } finally {
      setIsEnhancing(false);
      setProcessingMessage("");
    }
  };

  // AI Upscale
  const handleUpscale = async (scale: number) => {
    setIsUpscaling(true);
    setProcessingMessage(t('Upscaling {scale}x... This may take a moment', { scale }));
    
    try {
      const res = await fetch(`${getApiUrl()}/api/operations/upscale`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          image_id: currentImageId,
          scale: scale,
          method: "lanczos"
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.image_url) {
          setCurrentImageId(data.image_id);
          setImageSrc(`${getApiUrl()}${data.image_url}?t=${Date.now()}`);
          toast.success(t('Upscaled to {width}x{height}!', { width: data.new_size.width, height: data.new_size.height }));
        } else {
          toast.error(t('Upscale failed'), { description: data.detail || t('Unknown error') });
        }
      } else {
        const err = await res.json();
        toast.error(t('Upscale failed'), { description: err.detail || t('Server error') });
      }
    } catch (e) {
      console.error("Upscale error:", e);
      toast.error(t('Failed to upscale image'));
    } finally {
      setIsUpscaling(false);
      setProcessingMessage("");
    }
  };

  const positions = [
    { id: "northwest", label: "↖" }, { id: "north", label: "↑" }, { id: "northeast", label: "↗" },
    { id: "west", label: "←" }, { id: "center", label: "•" }, { id: "east", label: "→" },
    { id: "southwest", label: "↙" }, { id: "south", label: "↓" }, { id: "southeast", label: "↘" },
  ];

  const handleClose = () => {
    if (hasUnsavedChanges && !confirm(t('Unsaved changes will be lost. Close anyway?'))) return;
    onClose();
  };

  const cropDisplayStyle = getCropDisplayStyle();

  // Save button component to reuse in all tabs
  const SaveButton = () => (
    hasUnsavedChanges ? (
      <Button className="w-full mt-4" variant="outline" onClick={handleSave} disabled={isProcessing}>
        <Save className="h-4 w-4 mr-2" /> {t('Save Changes')}
      </Button>
    ) : null
  );

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
        <div className="bg-background rounded-2xl w-[95vw] max-w-7xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              {isEditingFilename ? (
                <input
                  ref={filenameInputRef}
                  type="text"
                  value={editingFilename}
                  onChange={(e) => setEditingFilename(e.target.value)}
                  onKeyDown={handleFilenameKeyDown}
                  onBlur={saveFilename}
                  className="text-lg font-semibold max-w-sm bg-transparent border-b-2 border-blue-500 outline-none px-1"
                  autoFocus
                />
              ) : (
                <h2 
                  className="text-lg font-semibold truncate max-w-sm cursor-pointer hover:text-blue-600 transition-colors group flex items-center gap-1"
                  onClick={startEditingFilename}
                  title={t('Click to rename')}
                >
                  {displayFilename}
                  <span className="text-gray-400 opacity-0 group-hover:opacity-100 text-xs transition-opacity">✎</span>
                </h2>
              )}
              {hasUnsavedChanges && (
                <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                  {t('Unsaved')}
                </span>
              )}
              {cropMode && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{t('Crop Mode')}</span>}
              {isPdf && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full flex items-center gap-1"><FileImage className="h-3 w-3" /> PDF</span>}
            </div>
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">{t('Unsaved')}</span>
              )}
              <Button variant="ghost" size="icon" onClick={resetAll} title={t('Reset')}><Undo2 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={handleClose}><X className="h-5 w-5" /></Button>
            </div>
          </div>
          
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Preview area */}
            <div 
              ref={imageContainerRef}
              className="flex-1 bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center p-8 overflow-hidden relative"
            >
              {/* Processing overlay */}
              {isProcessing && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-white" />
                  <p className="text-white text-lg font-medium text-center px-4">{processingMessage}</p>
                </div>
              )}
              
              {/* Image container */}
              <div 
                className="relative inline-block" style={{ backgroundImage: "linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)", backgroundSize: "20px 20px", backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px", backgroundColor: "#fff", borderRadius: "0.5rem" }}
                onMouseDown={handleCropMouseDown}
                onMouseMove={handleCropMouseMove}
                onMouseUp={handleCropMouseUp}
                onMouseLeave={() => isCropping && handleCropMouseUp()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt={image.originalFilename}
                  className={cn(
                    "max-w-full max-h-[65vh] object-contain rounded-lg shadow-lg transition-all duration-75",
                    cropMode && "cursor-crosshair select-none"
                  )}
                  style={{ filter: getCssFilters(), transform: getCssTransform() }}
                  draggable={false}
                  onLoad={updateImageRect}
                />
                
                {/* Crop overlay - positioned relative to image */}
                {cropMode && cropDisplayStyle && (
                  <div 
                    className="absolute border-2 border-dashed border-white bg-black/30 pointer-events-none"
                    style={{
                      left: cropDisplayStyle.left,
                      top: cropDisplayStyle.top,
                      width: cropDisplayStyle.width,
                      height: cropDisplayStyle.height,
                    }}
                  >
                    <div className="absolute -top-7 left-0 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      {Math.round(cropDisplayStyle.width)} × {Math.round(cropDisplayStyle.height)}
                    </div>
                  </div>
                )}
                
                {/* Dark overlay outside crop */}
                {cropMode && cropDisplayStyle && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Top */}
                    <div className="absolute bg-black/50" style={{ top: 0, left: 0, right: 0, height: cropDisplayStyle.top }} />
                    {/* Bottom */}
                    <div className="absolute bg-black/50" style={{ top: cropDisplayStyle.top + cropDisplayStyle.height, left: 0, right: 0, bottom: 0 }} />
                    {/* Left */}
                    <div className="absolute bg-black/50" style={{ top: cropDisplayStyle.top, left: 0, width: cropDisplayStyle.left, height: cropDisplayStyle.height }} />
                    {/* Right */}
                    <div className="absolute bg-black/50" style={{ top: cropDisplayStyle.top, left: cropDisplayStyle.left + cropDisplayStyle.width, right: 0, height: cropDisplayStyle.height }} />
                  </div>
                )}
                
                {/* Watermark preview */}
                {state.watermarkKind === 'text' && state.watermarkText && !cropMode && (
                  <div 
                    className={cn(
                      "absolute pointer-events-none",
                      state.watermarkPosition === "northwest" && "top-4 left-4",
                      state.watermarkPosition === "north" && "top-4 left-1/2 -translate-x-1/2",
                      state.watermarkPosition === "northeast" && "top-4 right-4",
                      state.watermarkPosition === "west" && "top-1/2 left-4 -translate-y-1/2",
                      state.watermarkPosition === "center" && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                      state.watermarkPosition === "east" && "top-1/2 right-4 -translate-y-1/2",
                      state.watermarkPosition === "southwest" && "bottom-4 left-4",
                      state.watermarkPosition === "south" && "bottom-4 left-1/2 -translate-x-1/2",
                      state.watermarkPosition === "southeast" && "bottom-4 right-4",
                    )}
                    style={{ 
                      fontSize: `${Math.max(10, state.watermarkFontSize * zoom)}px`,
                      fontFamily: watermarkPreviewFonts[state.watermarkFont],
                      fontWeight: 'normal',
                      color: state.watermarkColor,
                      opacity: state.watermarkOpacity / 100,
                      textShadow: `1px 1px 0 ${state.watermarkShadowColor}`,
                    }}
                  >
                    {state.watermarkText}
                  </div>
                )}
              </div>
              
              {/* Zoom */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/90 backdrop-blur rounded-full px-4 py-2 shadow-lg">
                <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
                <span className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(3, z + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
              </div>
            </div>
            
            {/* Controls panel */}
            <div className="w-80 min-h-0 border-l bg-background flex flex-col">
              {/* Quick actions */}
              <div className="flex items-center justify-around p-3 border-b">
                <Button variant="ghost" size="icon" onClick={rotateLeft} title={t('Rotate left')}><RotateCcw className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={rotateRight} title={t('Rotate right')}><RotateCw className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setState(s => ({ ...s, flipH: !s.flipH }))} title={t('Flip H')}><FlipHorizontal className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setState(s => ({ ...s, flipV: !s.flipV }))} title={t('Flip V')}><FlipVertical className="h-4 w-4" /></Button>
                <Button variant={cropMode ? "default" : "ghost"} size="icon" onClick={() => { 
                  if (!cropMode) {
                    setCropMode(true);
                    setActiveTab("crop");
                  } else {
                    setCropMode(false);
                    setCropArea(null);
                  }
                }} title={t('Crop')}>
                  <CropIcon className="h-4 w-4" />
                </Button>
              </div>
              
              <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 min-h-0 flex flex-col">
                <TabsList className="grid grid-cols-3 mx-3 mt-3 h-auto">
                  <TabsTrigger value="adjust" className="text-xs"><Sliders className="h-3.5 w-3.5 mr-1" />{t('Adjust')}</TabsTrigger>
                  <TabsTrigger value="resize" className="text-xs"><Maximize2 className="h-3.5 w-3.5 mr-1" />{t('Resize')}</TabsTrigger>
                  <TabsTrigger value="crop" className="text-xs"><Square className="h-3.5 w-3.5 mr-1" />{t('Crop')}</TabsTrigger>
                  <TabsTrigger value="text" className="text-xs"><Type className="h-3.5 w-3.5 mr-1" />{t('Text')}</TabsTrigger>
                  <TabsTrigger value="frame" className="text-xs"><Square className="h-3.5 w-3.5 mr-1" />{t('Frame')}</TabsTrigger>
                  <TabsTrigger value="ai" className="text-xs"><Wand2 className="h-3.5 w-3.5 mr-1" />{t('AI')}</TabsTrigger>
                </TabsList>
                
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4">
                  {/* Adjust tab */}
                  <TabsContent value="adjust" className="mt-0 space-y-4">
                    {[
                      { label: "Brightness", icon: Sun, key: "brightness", min: 0, max: 200, def: 100, unit: "%" },
                      { label: "Contrast", icon: Contrast, key: "contrast", min: 0, max: 200, def: 100, unit: "%" },
                      { label: "Saturation", icon: Droplets, key: "saturation", min: 0, max: 200, def: 100, unit: "%" },
                      { label: "Blur", icon: null, key: "blur", min: 0, max: 30, def: 0, unit: "px" },
                      { label: "Hue", icon: null, key: "hue", min: -180, max: 180, def: 0, unit: "°" },
                    ].map(({ label, icon: Icon, key, min, max, def, unit }) => (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs flex items-center gap-2">{Icon && <Icon className="h-3.5 w-3.5" />} {t(label)}</Label>
                          <span className="text-xs text-muted-foreground">
                            {state[key as keyof EditorState] as number}{unit}
                          </span>
                        </div>
                        <Slider 
                          value={[state[key as keyof EditorState] as number]} 
                          onValueChange={([v]) => setState(s => ({ ...s, [key]: v }))} 
                          min={min} max={max} step={1} 
                        />
                      </div>
                    ))}
                    
                    <div className="pt-4 border-t">
                      <Label className="text-xs mb-3 block">{t('Quick Filters')}</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { name: "Grayscale", fn: applyGrayscale },
                          { name: "Sepia", fn: applySepia },
                          { name: "Vintage", fn: applyVintage },
                          { name: "Hi-Contrast", fn: applyHighContrast },
                          { name: "Bright", fn: applyBright },
                          { name: "Dark Filter", fn: applyDark },
                        ].map(({ name, fn }) => (
                          <Button key={name} variant="outline" size="sm" className="text-xs" onClick={fn}>{t(name)}</Button>
                        ))}
                      </div>
                    </div>
                    
                    <SaveButton />
                  </TabsContent>
                  
                  {/* Resize tab */}
                  <TabsContent value="resize" className="mt-0 space-y-4">
                    <div className="rounded-xl border p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <Maximize2 className="h-5 w-5 text-primary" />
                        <div>
                          <h4 className="font-medium text-sm">{t('Resize Image')}</h4>
                          <p className="text-xs text-muted-foreground">{t('Change dimensions or scale')}</p>
                        </div>
                      </div>
                      
                      {/* Mode selection */}
                      <div className="flex gap-2">
                        <Button 
                          variant={state.resizeMode === 'dimensions' ? 'default' : 'outline'} 
                          size="sm"
                          className="flex-1"
                          onClick={() => setState(s => ({ ...s, resizeMode: 'dimensions' }))}
                        >
                          {t('Dimensions')}
                        </Button>
                        <Button 
                          variant={state.resizeMode === 'percent' ? 'default' : 'outline'} 
                          size="sm"
                          className="flex-1"
                          onClick={() => setState(s => ({ ...s, resizeMode: 'percent' }))}
                        >
                          {t('Percentage')}
                        </Button>
                      </div>
                      
                      {state.resizeMode === 'dimensions' && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">{t('Width (px)')}</Label>
                              <Input 
                                type="number" 
                                value={state.resizeWidth}
                                onChange={(e) => {
                                  const w = parseInt(e.target.value) || 0;
                                  if (state.keepAspectRatio && imageDimensions) {
                                    const ratio = imageDimensions.height / imageDimensions.width;
                                    setState(s => ({ ...s, resizeWidth: w, resizeHeight: Math.round(w * ratio) }));
                                  } else {
                                    setState(s => ({ ...s, resizeWidth: w }));
                                  }
                                }}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">{t('Height (px)')}</Label>
                              <Input 
                                type="number" 
                                value={state.resizeHeight}
                                onChange={(e) => {
                                  const h = parseInt(e.target.value) || 0;
                                  if (state.keepAspectRatio && imageDimensions) {
                                    const ratio = imageDimensions.width / imageDimensions.height;
                                    setState(s => ({ ...s, resizeHeight: h, resizeWidth: Math.round(h * ratio) }));
                                  } else {
                                    setState(s => ({ ...s, resizeHeight: h }));
                                  }
                                }}
                                className="mt-1"
                              />
                            </div>
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => setState(s => ({ ...s, keepAspectRatio: !s.keepAspectRatio }))}
                          >
                            {state.keepAspectRatio ? <Link2 className="h-4 w-4 mr-2" /> : <Link2Off className="h-4 w-4 mr-2" />}
                            {state.keepAspectRatio ? t('Aspect Ratio Locked') : t('Aspect Ratio Unlocked')}
                          </Button>
                          
                          {/* Quick sizes */}
                          <div>
                            <Label className="text-xs text-muted-foreground">{t('Quick Sizes')}</Label>
                            <div className="grid grid-cols-3 gap-2 mt-2">
                              {[
                                { w: 1920, h: 1080, label: 'Full HD' },
                                { w: 1200, h: 630, label: 'Social' },
                                { w: 1080, h: 1080, label: 'Square' },
                                { w: 800, h: 600, label: 'Web' },
                                { w: 512, h: 512, label: 'Avatar' },
                                { w: 150, h: 150, label: 'Thumb' },
                              ].map(({ w, h, label }) => (
                                <Button
                                  key={label}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => setState(s => ({ ...s, resizeWidth: w, resizeHeight: h }))}
                                >
                                  {t(label)}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                      
                      {state.resizeMode === 'percent' && (
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <Label className="text-xs">{t('Scale')}</Label>
                            <span className="text-xs text-muted-foreground">{state.resizePercent}%</span>
                          </div>
                          <Slider 
                            value={[state.resizePercent]} 
                            onValueChange={([v]) => setState(s => ({ ...s, resizePercent: v }))} 
                            min={10} max={200} step={5}
                          />
                          <div className="flex gap-2">
                            {[25, 50, 75, 100, 150, 200].map(p => (
                              <Button
                                key={p}
                                variant={state.resizePercent === p ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => setState(s => ({ ...s, resizePercent: p }))}
                              >
                                {p}%
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {imageDimensions && (
                      <div className="text-xs text-muted-foreground text-center">
                        {t('Original: {width} × {height} px', { width: imageDimensions.width, height: imageDimensions.height })}
                        {state.resizeMode === 'dimensions' && (
                          <> → {t('New: {width} × {height} px', { width: state.resizeWidth, height: state.resizeHeight })}</>
                        )}
                        {state.resizeMode === 'percent' && (
                          <> → {t('New: {width} × {height} px', { width: Math.round(imageDimensions.width * state.resizePercent / 100), height: Math.round(imageDimensions.height * state.resizePercent / 100) })}</>
                        )}
                      </div>
                    )}
                    
                    <SaveButton />
                  </TabsContent>
                  
                  <TabsContent value="frame" className="mt-0 p-4">
                    <BorderPanel value={state.border} onChange={(border) => { setState(s => ({ ...s, border })); setHasUnsavedChanges(true); }} />
                    {isBorderPreviewing && <p className="mt-2 text-xs text-muted-foreground">{t('Updating ImageMagick preview…')}</p>}
                    <SaveButton />
                  </TabsContent>

                  {/* Crop tab */}
                  <TabsContent value="crop" className="mt-0 space-y-4">
                    <div className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CropIcon className="h-5 w-5 text-primary" />
                        <div>
                          <h4 className="font-medium text-sm">{t('Crop Image')}</h4>
                          <p className="text-xs text-muted-foreground">{t('Draw on image to select area')}</p>
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full" 
                        variant={cropMode ? "default" : "outline"}
                        onClick={() => { setCropMode(!cropMode); if (cropMode) setCropArea(null); }}
                      >
                        {cropMode ? t('Exit Crop Mode') : t('Start Cropping')}
                      </Button>
                      
                      {cropArea && (
                        <div className="space-y-2">
                          <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                            <p className="text-sm text-green-700 dark:text-green-300">
                              ✓ {t('{width} × {height}px selected', { width: Math.round(cropArea.w), height: Math.round(cropArea.h) })}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button className="flex-1" onClick={applyCrop} disabled={isProcessing}>
                              <Check className="h-4 w-4 mr-2" /> {t('Apply Crop')}
                            </Button>
                            <Button variant="outline" onClick={() => setCropArea(null)}>{t('Clear')}</Button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        💡 {t('Click and drag on the image to select crop area, then click "Apply Crop"')}
                      </p>
                    </div>
                    
                    <SaveButton />
                  </TabsContent>
                  
                  {/* Text/Watermark tab */}
                  <TabsContent value="text" className="mt-0 space-y-4">
                    <div className="grid grid-cols-2 gap-2"><Button variant={state.watermarkKind === 'text' ? 'default' : 'outline'} size="sm" onClick={() => setState(s => ({ ...s, watermarkKind: 'text' }))}>{t('Text')}</Button><Button variant={state.watermarkKind === 'image' ? 'default' : 'outline'} size="sm" onClick={() => setState(s => ({ ...s, watermarkKind: 'image' }))}>{t('Logo / Image')}</Button></div>
                    {state.watermarkKind === 'text' ? <>
                      <div className="space-y-2"><Label className="text-xs">{t('Watermark Text')}</Label><Input value={state.watermarkText} onChange={(e) => setState(s => ({ ...s, watermarkText: e.target.value }))} placeholder={t('Enter watermark...')} /></div>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="text-xs">{t('Font')}
                          <select className="mt-1 w-full rounded border bg-background p-2" value={state.watermarkFont} onChange={e => setState(s => ({ ...s, watermarkFont: e.target.value as WatermarkFont }))}>
                            {watermarkFontOptions.map(({ value, label }) => <option value={value} key={value} style={{ fontFamily: watermarkPreviewFonts[value] }}>{t(label)}</option>)}
                          </select>
                        </label>
                        <label className="text-xs">{t('Text color')}<input className="mt-1 h-9 w-full" type="color" value={state.watermarkColor} onChange={e => setState(s => ({ ...s, watermarkColor: e.target.value.toUpperCase() }))} /></label>
                        <label className="text-xs">{t('Shadow color')}<input className="mt-1 h-9 w-full" type="color" value={state.watermarkShadowColor} onChange={e => setState(s => ({ ...s, watermarkShadowColor: e.target.value.toUpperCase() }))} /></label>
                      </div>
                    </> : <div className="space-y-3 rounded border p-3"><Label className="text-xs">{t('Use an uploaded PNG, JPEG, WebP, or SVG as a logo/image watermark')}</Label><select className="w-full rounded border bg-background p-2 text-sm" value={state.watermarkImageId ?? ''} onChange={e => setState(s => ({ ...s, watermarkImageId: e.target.value ? Number(e.target.value) : null }))}><option value="">{t('Select an uploaded image')}</option>{libraryImages.filter(candidate => candidate.id !== currentImageId && candidate.mimeType.startsWith('image/')).map(candidate => <option value={candidate.id} key={candidate.id}>{candidate.originalFilename}</option>)}</select><label className="text-xs">{t('Scale: {count}% of short edge', { count: state.watermarkImageScale })}<Slider className="mt-2" value={[state.watermarkImageScale]} min={1} max={100} step={1} onValueChange={([value]) => setState(s => ({ ...s, watermarkImageScale: value }))} /></label><div className="grid grid-cols-2 gap-2"><label className="text-xs">{t('X offset')}<Input type="number" min="0" value={state.watermarkOffsetX} onChange={e => setState(s => ({ ...s, watermarkOffsetX: Number(e.target.value) || 0 }))} /></label><label className="text-xs">{t('Y offset')}<Input type="number" min="0" value={state.watermarkOffsetY} onChange={e => setState(s => ({ ...s, watermarkOffsetY: Number(e.target.value) || 0 }))} /></label></div></div>}
                    <div className="space-y-2">
                      <Label className="text-xs">{t('Position')}</Label>
                      <div className="grid grid-cols-3 gap-2 w-fit mx-auto">
                        {positions.map((pos) => (
                          <button key={pos.id} onClick={() => setState(s => ({ ...s, watermarkPosition: pos.id }))}
                            className={cn("w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-bold transition-all",
                              state.watermarkPosition === pos.id ? "border-primary bg-primary text-primary-foreground" : "border-muted hover:border-primary/50"
                            )}>
                            {pos.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-xs">{t('Font Size')}</Label>
                        <span className="text-xs text-muted-foreground">{state.watermarkFontSize}pt</span>
                      </div>
                      <Slider 
                        value={[state.watermarkFontSize]} 
                        onValueChange={([v]) => setState(s => ({ ...s, watermarkFontSize: v }))} 
                        min={8} max={72} step={2}
                      />
                      <div className="flex gap-1 mt-1">
                        {[12, 18, 24, 36, 48].map((size) => (
                          <button
                            key={size}
                            onClick={() => setState(s => ({ ...s, watermarkFontSize: size }))}
                            className={`flex-1 text-xs py-1 rounded ${state.watermarkFontSize === size ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-xs">{t('Opacity')}</Label>
                        <span className="text-xs text-muted-foreground">{state.watermarkOpacity}%</span>
                      </div>
                      <Slider 
                        value={[state.watermarkOpacity]} 
                        onValueChange={([v]) => setState(s => ({ ...s, watermarkOpacity: v }))} 
                        min={10} max={100} step={5}
                      />
                    </div>
                    {(state.watermarkKind === 'text' ? state.watermarkText : state.watermarkImageId) && (
                      <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-sm text-green-700 dark:text-green-300">✓ {state.watermarkKind === 'text' ? t('Text watermark "{text}" at {position} ({opacity}%)', { text: state.watermarkText, position: t(state.watermarkPosition), opacity: state.watermarkOpacity }) : t('Image watermark at {position} ({opacity}%)', { position: t(state.watermarkPosition), opacity: state.watermarkOpacity })}</p>
                      </div>
                    )}
                    
                    <SaveButton />
                  </TabsContent>
                  
                  {/* AI tab */}
                  <TabsContent value="ai" className="mt-0 space-y-4">
                    {/* Upscale Section */}
                    <div className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <ZoomIn className="h-5 w-5 text-primary" />
                        <div>
                          <h4 className="font-medium text-sm">{t('Upscale')}</h4>
                          <p className="text-xs text-muted-foreground">{t('Increase image resolution')}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleUpscale(2)} 
                          disabled={isUpscaling || isRemovingBg || isEnhancing}
                        >
                          {isUpscaling ? <Loader2 className="h-3 w-3 animate-spin" /> : "2x"}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleUpscale(3)} 
                          disabled={isUpscaling || isRemovingBg || isEnhancing}
                        >
                          {isUpscaling ? <Loader2 className="h-3 w-3 animate-spin" /> : "3x"}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleUpscale(4)} 
                          disabled={isUpscaling || isRemovingBg || isEnhancing}
                        >
                          {isUpscaling ? <Loader2 className="h-3 w-3 animate-spin" /> : "4x"}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        {isUpscaling ? t('Upscaling in progress...') : t('Uses high-quality Lanczos algorithm with sharpening')}
                      </p>
                    </div>
                    
                    {/* Remove Background Section */}
                    <div className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Eraser className="h-5 w-5 text-primary" />
                        <div>
                          <h4 className="font-medium text-sm">{t('Remove Background')}</h4>
                          <p className="text-xs text-muted-foreground">{t('AI-powered background removal')}</p>
                        </div>
                      </div>
                      <Button className="w-full" onClick={handleRemoveBackground} disabled={isUpscaling || isRemovingBg || isEnhancing}>
                        {isRemovingBg ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                        {isRemovingBg ? t('Removing...') : t('Remove Background')}
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        {isRemovingBg ? t('This may take 30-60 seconds...') : t('May take 30-60 seconds')}
                      </p>
                    </div>
                    
                    {/* Auto Enhance Section */}
                    <div className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Wand2 className="h-5 w-5 text-primary" />
                        <div>
                          <h4 className="font-medium text-sm">{t('Auto Enhance')}</h4>
                          <p className="text-xs text-muted-foreground">{t('Improve colors & quality')}</p>
                        </div>
                      </div>
                      <Button variant="outline" className="w-full" onClick={handleAutoEnhance} disabled={isUpscaling || isRemovingBg || isEnhancing}>
                        {isEnhancing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {isEnhancing ? t('Enhancing...') : t('Auto Enhance')}
                      </Button>
                    </div>
                    
                    <SaveButton />
                  </TabsContent>
                </div>
              </Tabs>
              
              {/* Footer */}
              <div className="border-t p-4 space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">{t('Format')}</Label>
                    <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}
                      className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                      <option value="webp">WebP</option>
                      <option value="png">PNG</option>
                      <option value="jpg">JPEG</option>
                    </select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">{t('Quality: {count}%', { count: quality })}</Label>
                    <Slider value={[quality]} onValueChange={([v]) => setLocalQuality(v)} min={1} max={100} className="mt-2" />
                  </div>
                </div>
                
                <Button className="w-full" size="lg" onClick={handleDownload} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                  {t('Download')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Save dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('Unsaved Changes')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('You have unsaved changes. What would you like to do?')}</p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { setShowSaveDialog(false); setPendingTab(null); }}>{t('Cancel')}</Button>
            <Button variant="outline" onClick={discardAndContinue}>{t('Discard')}</Button>
            <Button onClick={saveAndContinue}>{t('Save Changes')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
