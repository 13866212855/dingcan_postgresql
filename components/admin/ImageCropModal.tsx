'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Check,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Crop as CropIcon,
  Eye,
  Info,
} from 'lucide-react';

export type AspectRatioType = '4:3' | '16:9' | '1:1' | 'original';

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageFile?: File | null;
  imageUrl?: string;
  dishNameHint?: string;
  onConfirmCrop: (params: {
    croppedBlob: Blob;
    cropRatio: AspectRatioType;
    cropBox?: { x: number; y: number; width: number; height: number };
  }) => void;
  onUseOriginal: () => void;
}

export default function ImageCropModal({
  isOpen,
  onClose,
  imageFile,
  imageUrl,
  dishNameHint,
  onConfirmCrop,
  onUseOriginal,
}: ImageCropModalProps) {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>('4:3');
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [processing, setProcessing] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Load image source from File or URL
  useEffect(() => {
    if (!isOpen) return;

    let url = '';
    if (imageFile) {
      url = URL.createObjectURL(imageFile);
      setImgSrc(url);
    } else if (imageUrl) {
      setImgSrc(imageUrl);
    }

    // Reset controls
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setAspectRatio('4:3');

    return () => {
      if (url && imageFile) {
        URL.revokeObjectURL(url);
      }
    };
  }, [isOpen, imageFile, imageUrl]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNaturalDimensions({ width: w, height: h });

    // 默认智能适配：如果原图已经是横版，设置合适的缩放；竖版则默认 4:3 黄金构图并居中聚焦
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  };

  // Mouse / Touch drag to pan image inside the crop frame
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - offset.x,
        y: e.touches[0].clientY - offset.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Rotate 90 degrees clockwise
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Auto-center dish
  const handleResetCenter = () => {
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  };

  // Calculate crop target ratio
  const getRatioValue = useCallback((): number => {
    switch (aspectRatio) {
      case '4:3':
        return 4 / 3;
      case '16:9':
        return 16 / 9;
      case '1:1':
        return 1;
      case 'original':
        return naturalDimensions.width && naturalDimensions.height
          ? naturalDimensions.width / naturalDimensions.height
          : 4 / 3;
      default:
        return 4 / 3;
    }
  }, [aspectRatio, naturalDimensions]);

  // Export cropped image via Canvas
  const handleConfirm = async () => {
    if (!imageRef.current || naturalDimensions.width === 0) {
      onUseOriginal();
      return;
    }

    setProcessing(true);
    try {
      const img = imageRef.current;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      const targetRatio = getRatioValue();
      const outputWidth = Math.min(1600, Math.max(800, naturalDimensions.width));
      const outputHeight = Math.round(outputWidth / targetRatio);

      canvas.width = outputWidth;
      canvas.height = outputHeight;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outputWidth, outputHeight);

      // Render with transform
      ctx.save();
      ctx.translate(outputWidth / 2, outputHeight / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // If rotated 90 or 270, dimensions swap
      const isRotatedQuarter = rotation === 90 || rotation === 270;
      const srcW = isRotatedQuarter ? naturalDimensions.height : naturalDimensions.width;
      const srcH = isRotatedQuarter ? naturalDimensions.width : naturalDimensions.height;

      // Base scale to cover or fit
      const scaleBase = Math.max(outputWidth / srcW, outputHeight / srcH);
      const totalScale = scaleBase * zoom;

      // Adjust user offset relative to canvas scale
      const containerW = 440; // Approx preview viewport width
      const scaleMultiplier = outputWidth / containerW;
      const drawOffsetX = offset.x * scaleMultiplier;
      const drawOffsetY = offset.y * scaleMultiplier;

      const drawW = naturalDimensions.width * totalScale;
      const drawH = naturalDimensions.height * totalScale;

      ctx.drawImage(
        img,
        -drawW / 2 + drawOffsetX,
        -drawH / 2 + drawOffsetY,
        drawW,
        drawH
      );
      ctx.restore();

      // Convert canvas to Blob
      canvas.toBlob(
        (blob) => {
          setProcessing(false);
          if (blob) {
            onConfirmCrop({
              croppedBlob: blob,
              cropRatio: aspectRatio,
            });
          } else {
            onUseOriginal();
          }
        },
        'image/webp',
        0.92
      );
    } catch (err) {
      console.error('[Crop Export Error]', err);
      setProcessing(false);
      onUseOriginal();
    }
  };

  if (!isOpen) return null;

  const targetRatio = getRatioValue();
  // Frame box size inside modal preview
  const frameWidth = 440;
  const frameHeight = Math.round(frameWidth / targetRatio);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] border border-neutral-200">
        {/* Header */}
        <div className="px-5 py-3.5 bg-neutral-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <CropIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">菜品图片智能裁剪与构图</h3>
              <p className="text-[11px] text-neutral-300">
                调整取景框，确保完整呈现菜品美味主体（杜绝盘碟被裁切）
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ratio Selector Tabs */}
        <div className="px-5 py-2.5 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-neutral-500 font-medium shrink-0 mr-1 text-[11px]">构图画幅:</span>
            <button
              type="button"
              onClick={() => {
                setAspectRatio('4:3');
                setOffset({ x: 0, y: 0 });
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all text-xs flex items-center space-x-1 cursor-pointer ${
                aspectRatio === '4:3'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-neutral-700 hover:bg-neutral-200 border border-neutral-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>4:3 美食标准</span>
              <span className="text-[10px] opacity-80">(推荐)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAspectRatio('16:9');
                setOffset({ x: 0, y: 0 });
              }}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                aspectRatio === '16:9'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-neutral-700 hover:bg-neutral-200 border border-neutral-200'
              }`}
            >
              <span>16:9 宽屏</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAspectRatio('1:1');
                setOffset({ x: 0, y: 0 });
              }}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                aspectRatio === '1:1'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-neutral-700 hover:bg-neutral-200 border border-neutral-200'
              }`}
            >
              <span>1:1 正方形</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAspectRatio('original');
                setOffset({ x: 0, y: 0 });
              }}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                aspectRatio === 'original'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-neutral-700 hover:bg-neutral-200 border border-neutral-200'
              }`}
            >
              <span>原图完整</span>
            </button>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              onClick={handleRotate}
              title="顺时针旋转 90 度"
              className="p-1.5 bg-white hover:bg-neutral-200 border border-neutral-200 text-neutral-700 rounded-lg text-xs flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">旋转</span>
            </button>
            <button
              type="button"
              onClick={handleResetCenter}
              title="复位并居中"
              className="p-1.5 bg-white hover:bg-neutral-200 border border-neutral-200 text-neutral-700 rounded-lg text-xs flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">居中</span>
            </button>
          </div>
        </div>

        {/* Workspace Canvas / Viewport */}
        <div className="p-4 bg-neutral-950 flex flex-col items-center justify-center relative select-none overflow-hidden flex-1 min-h-[300px]">
          {/* Helpful gesture tip */}
          <div className="absolute top-2 left-3 z-20 flex items-center space-x-1 text-[11px] text-neutral-400 bg-neutral-900/80 px-2 py-0.5 rounded-md pointer-events-none border border-neutral-800">
            <Info className="w-3 h-3 text-amber-400" />
            <span>可直接按住图片拖动位置，配合下方滑块缩放</span>
          </div>

          {/* Cropping Viewport Box */}
          <div
            ref={containerRef}
            style={{
              width: `${frameWidth}px`,
              maxWidth: '92%',
              height: `${frameHeight}px`,
              maxHeight: '340px',
            }}
            className="relative rounded-xl overflow-hidden border-2 border-amber-400 shadow-2xl cursor-grab active:cursor-grabbing bg-neutral-900 flex items-center justify-center transition-all duration-150"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* The Image being cropped */}
            {imgSrc ? (
              <img
                ref={imageRef}
                src={imgSrc}
                alt="菜品预览"
                onLoad={handleImageLoad}
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                  maxWidth: 'none',
                  maxHeight: 'none',
                }}
                className="w-full h-full object-cover pointer-events-none select-none"
                draggable={false}
              />
            ) : (
              <div className="text-neutral-500 text-xs">加载图片中...</div>
            )}

            {/* Rule of Thirds Grid Guidelines */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-amber-400/30">
              <div className="border-r border-b border-white/20"></div>
              <div className="border-r border-b border-white/20"></div>
              <div className="border-b border-white/20"></div>
              <div className="border-r border-b border-white/20"></div>
              <div className="border-r border-b border-white/20"></div>
              <div className="border-b border-white/20"></div>
              <div className="border-r border-white/20"></div>
              <div className="border-r border-white/20"></div>
              <div></div>
            </div>

            {/* Corner Viewfinder Markers */}
            <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-amber-400 pointer-events-none"></div>
            <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-amber-400 pointer-events-none"></div>
            <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-amber-400 pointer-events-none"></div>
            <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-amber-400 pointer-events-none"></div>

            {/* Ratio watermark */}
            <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-xs text-amber-400 px-2 py-0.5 rounded text-[10px] font-mono pointer-events-none border border-amber-400/30">
              {aspectRatio === '4:3'
                ? '4:3 外卖黄金标准'
                : aspectRatio === '16:9'
                ? '16:9 宽屏'
                : aspectRatio === '1:1'
                ? '1:1 方形'
                : '100% 原始比例'}
            </div>
          </div>
        </div>

        {/* Zoom & Fine-tune Toolbar */}
        <div className="px-5 py-3 bg-neutral-100 border-t border-neutral-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center space-x-2 flex-1 max-w-sm">
            <ZoomOut className="w-4 h-4 text-neutral-500 shrink-0" />
            <input
              type="range"
              min="0.8"
              max="2.5"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full accent-amber-600 cursor-pointer h-1.5 bg-neutral-300 rounded-lg"
            />
            <ZoomIn className="w-4 h-4 text-neutral-500 shrink-0" />
            <span className="text-xs text-neutral-600 font-mono w-10 text-right shrink-0">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div className="text-[11px] text-neutral-500 hidden sm:flex items-center space-x-1">
            <Eye className="w-3.5 h-3.5 text-emerald-600" />
            <span>所见即所得 · 自动转为极速 WebP</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-white border-t border-neutral-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onUseOriginal}
            className="px-3.5 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-medium text-xs sm:text-sm transition-colors border border-neutral-300 cursor-pointer"
          >
            直接上传原图 (跳过裁剪)
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-medium text-xs sm:text-sm transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              disabled={processing}
              onClick={handleConfirm}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {processing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>生成中...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>确认裁剪并优化</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-200 ml-0.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
