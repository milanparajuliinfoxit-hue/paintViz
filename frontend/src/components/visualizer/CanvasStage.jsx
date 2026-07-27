import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Circle, Group } from 'react-konva';
import useImage from 'use-image';
import { Lock } from 'lucide-react';
import useVisualizerStore from '../../store/visualizerStore';
import { segmentPoint, refineMask } from '../../api/removals';

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const SNAP_THRESHOLD = 10;
const MIN_IMAGE_VISIBILITY = 60;

function flatten(points) {
  return points.flat();
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function clampPosition(pos, imgWidth, imgHeight, stageWidth, stageHeight, currentScale) {
  if (!imgWidth || !imgHeight || !stageWidth || !stageHeight) return pos;

  const imgW = imgWidth * currentScale;
  const imgH = imgHeight * currentScale;

  const imgLeft = pos.x;
  const imgTop = pos.y;
  const imgRight = pos.x + imgW;
  const imgBottom = pos.y + imgH;

  let x = pos.x;
  let y = pos.y;

  if (imgW <= stageWidth) {
    const centerX = (stageWidth - imgW) / 2;
    if (imgRight < MIN_IMAGE_VISIBILITY) x = MIN_IMAGE_VISIBILITY - imgW;
    if (imgLeft > stageWidth - MIN_IMAGE_VISIBILITY) x = stageWidth - MIN_IMAGE_VISIBILITY;
    if (x > centerX + imgW * 0.3) x = centerX + imgW * 0.3;
    if (x < centerX - imgW * 0.3) x = centerX - imgW * 0.3;
  } else {
    if (imgLeft > -MIN_IMAGE_VISIBILITY) x = -MIN_IMAGE_VISIBILITY;
    if (imgRight < stageWidth + MIN_IMAGE_VISIBILITY) x = stageWidth + MIN_IMAGE_VISIBILITY - imgW;
  }

  if (imgH <= stageHeight) {
    const centerY = (stageHeight - imgH) / 2;
    if (imgBottom < MIN_IMAGE_VISIBILITY) y = MIN_IMAGE_VISIBILITY - imgH;
    if (imgTop > stageHeight - MIN_IMAGE_VISIBILITY) y = stageHeight - MIN_IMAGE_VISIBILITY;
    if (y > centerY + imgH * 0.3) y = centerY + imgH * 0.3;
    if (y < centerY - imgH * 0.3) y = centerY - imgH * 0.3;
  } else {
    if (imgTop > -MIN_IMAGE_VISIBILITY) y = -MIN_IMAGE_VISIBILITY;
    if (imgBottom < stageHeight + MIN_IMAGE_VISIBILITY) y = stageHeight + MIN_IMAGE_VISIBILITY - imgH;
  }

  return { x, y };
}

export default function CanvasStage({ hiddenIds, onZoomChange, fitSignal, stageRef: externalStageRef }) {
  const containerRef = useRef(null);
  const internalStageRef = useRef(null);
  const stageRef = externalStageRef || internalStageRef;

  const photos = useVisualizerStore((s) => s.photos);
  const activePhotoId = useVisualizerStore((s) => s.activePhotoId);
  const surfaces = useVisualizerStore((s) => s.surfaces);
  const activeSurfaceId = useVisualizerStore((s) => s.activeSurfaceId);
  const selectSurface = useVisualizerStore((s) => s.selectSurface);
  const tool = useVisualizerStore((s) => s.tool);
  const setTool = useVisualizerStore((s) => s.setTool);
  const addSurface = useVisualizerStore((s) => s.addSurface);
  const updateSurfacePolygon = useVisualizerStore((s) => s.updateSurfacePolygon);
  const beforeAfter = useVisualizerStore((s) => s.beforeAfter);
  const lockedPhotoIds = useVisualizerStore((s) => s.lockedPhotoIds);
  const cleanupMask = useVisualizerStore((s) => s.cleanupMask);
  const cleanupPoints = useVisualizerStore((s) => s.cleanupPoints);
  const setCleanupMask = useVisualizerStore((s) => s.setCleanupMask);
  const addCleanupPoint = useVisualizerStore((s) => s.addCleanupPoint);
  const clearCleanupSelection = useVisualizerStore((s) => s.clearCleanupSelection);

  const activePhoto = photos.find((p) => p.id === activePhotoId);
  const isLocked = activePhotoId ? lockedPhotoIds.includes(activePhotoId) : false;
  const isCleanupMode = tool === 'cleanup';

  const [image] = useImage(activePhoto?.fileUrl, 'anonymous');

  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [tracePoints, setTracePoints] = useState([]);
  const [mousePos, setMousePos] = useState(null);
  const [pendingLabel] = useState('Wall');
  const [segmenting, setSegmenting] = useState(false);

  // Brush refinement state
  const [refining, setRefining] = useState(false);
  const brushSize = 20;
  const [brushCursor, setBrushCursor] = useState(null);
  const isPaintingRef = useRef(false);
  const brushCanvasRef = useRef(null);
  const [brushLayerImage, setBrushLayerImage] = useState(null);
  const brushDebounceRef = useRef(null);

  const fitToScreen = useCallback(() => {
    if (!image || stageSize.width === 0) return;
    const scaleX = stageSize.width / image.width;
    const scaleY = stageSize.height / image.height;
    const nextScale = Math.min(scaleX, scaleY) * 0.92;
    setScale(nextScale);
    setPosition({
      x: (stageSize.width - image.width * nextScale) / 2,
      y: (stageSize.height - image.height * nextScale) / 2,
    });
    onZoomChange?.(nextScale);
  }, [image, stageSize, onZoomChange]);

  useEffect(() => { fitToScreen(); }, [image, fitSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const resize = () => setStageSize({ width: el.clientWidth, height: el.clientHeight });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Initialize brush canvas when image loads
  useEffect(() => {
    if (image && activePhotoId) {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      brushCanvasRef.current = canvas;
    }
  }, [image, activePhotoId]);

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    const oldScale = scale;

    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.08;
    let newScale = direction > 0 ? oldScale * factor : oldScale / factor;
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    if (image) {
      const clamped = clampPosition(newPos, image.width, image.height, stageSize.width, stageSize.height, newScale);
      setScale(newScale);
      setPosition(clamped);
    } else {
      setScale(newScale);
      setPosition(newPos);
    }
    onZoomChange?.(newScale);
  };

  const toImageCoordsRef = useRef(null);
  toImageCoordsRef.current = (pointer) => [
    (pointer.x - position.x) / scale,
    (pointer.y - position.y) / scale,
  ];
  const toImageCoords = (pointer) => toImageCoordsRef.current(pointer);

  const handleStageClick = useCallback(async (_e) => {
    if (isCleanupMode && !refining && image && activePhotoId) {
      const stage = stageRef.current;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const [ix, iy] = toImageCoords(pointer);

      if (ix < 0 || iy < 0 || ix > image.width || iy > image.height) return;

      setSegmenting(true);
      try {
        const maskDataUrl = await segmentPoint(activePhotoId, ix, iy);
        if (maskDataUrl) {
          setCleanupMask(maskDataUrl);
          addCleanupPoint({ x: ix, y: iy });
        }
      } catch (err) {
        console.error('Segmentation failed:', err);
      } finally {
        setSegmenting(false);
      }
      return;
    }

    if (tool !== 'trace') return;
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    let [ix, iy] = toImageCoords(pointer);

    if (tracePoints.length >= 3 && distance([ix, iy], tracePoints[0]) < SNAP_THRESHOLD / scale) {
      finishTrace();
      return;
    }
    setTracePoints((pts) => [...pts, [ix, iy]]);
  }, [isCleanupMode, refining, image, activePhotoId, tool, tracePoints, scale]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBrushStroke = useCallback(async (ix, iy) => {
    if (!brushCanvasRef.current || !cleanupMask || !activePhotoId) return;

    const canvas = brushCanvasRef.current;
    const ctx = canvas.getContext('2d');

    // Draw the brush stroke on the offscreen canvas
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(ix, iy, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();

    // Update the Konva image
    setBrushLayerImage(canvas.toDataURL());

    // Debounce the backend call
    if (brushDebounceRef.current) clearTimeout(brushDebounceRef.current);
    brushDebounceRef.current = setTimeout(async () => {
      try {
        const updatedMask = await refineMask(activePhotoId, canvas.toDataURL());
        if (updatedMask) {
          setCleanupMask(updatedMask);
        }
      } catch (err) {
        console.error('Mask refinement failed:', err);
      }
    }, 300);
  }, [cleanupMask, activePhotoId, brushSize, setCleanupMask]);

  const handleMouseMove = useCallback(() => {
    if (!stageRef.current) return;
    const pointer = stageRef.current.getPointerPosition();
    if (!pointer) return;

    if (tool === 'trace') {
      setMousePos(toImageCoords(pointer));
    }

    if (isCleanupMode && refining) {
      const [ix, iy] = toImageCoords(pointer);
      setBrushCursor({ x: ix, y: iy });

      if (isPaintingRef.current) {
        handleBrushStroke(ix, iy);
      }
    }
  }, [tool, isCleanupMode, refining, handleBrushStroke]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseDown = useCallback(() => {
    if (isCleanupMode && refining) {
      isPaintingRef.current = true;
    }
  }, [isCleanupMode, refining]);

  const handleMouseUp = useCallback(() => {
    isPaintingRef.current = false;
  }, []);

  const finishTrace = async () => {
    if (tracePoints.length < 3 || !activePhotoId) {
      setTracePoints([]);
      return;
    }
    await addSurface(activePhotoId, { label: pendingLabel, polygon_coords: tracePoints });
    setTracePoints([]);
    setTool('select');
  };

  const cancelTrace = () => setTracePoints([]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        cancelTrace();
        if (isCleanupMode) {
          clearCleanupSelection();
          setRefining(false);
        }
      }
      if ((e.key === 'Enter') && tool === 'trace') finishTrace();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVertexDrag = (surface, index, e) => {
    const newCoords = surface.polygonCoords.map((pt, i) =>
      i === index ? [e.target.x(), e.target.y()] : pt
    );
    e.target._newCoords = newCoords;
  };

  const handleVertexDragEnd = (surface, e) => {
    const newCoords = e.target._newCoords;
    if (newCoords) updateSurfacePolygon(surface.id, newCoords);
  };

  const handleDragEnd = (e) => {
    const pos = { x: e.target.x(), y: e.target.y() };
    if (image) {
      const clamped = clampPosition(pos, image.width, image.height, stageSize.width, stageSize.height, scale);
      setPosition(clamped);
      if (clamped.x !== pos.x || clamped.y !== pos.y) {
        e.target.position(clamped);
        e.target.batchDraw();
      }
    } else {
      setPosition(pos);
    }
  };

  const maskImageRef = useRef(null);
  const [maskImage] = useImage(cleanupMask, 'anonymous');
  maskImageRef.current = maskImage;

  const [brushLayerImg] = useImage(brushLayerImage, 'anonymous');

  const cursorStyle = isCleanupMode
    ? (refining ? 'none' : 'crosshair')
    : (tool === 'trace' ? 'crosshair' : (isLocked ? 'not-allowed' : 'default'));

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[var(--pv-canvas-bg)]">
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        draggable={tool === 'select' && !isLocked}
        onDragEnd={handleDragEnd}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          setBrushCursor(null);
          isPaintingRef.current = false;
        }}
        style={{ cursor: cursorStyle }}
      >
        <Layer>
          {image && <KonvaImage image={image} />}

          {!beforeAfter && isCleanupMode && maskImage && (
            <KonvaImage image={maskImage} opacity={0.45} listening={false} />
          )}

          {!beforeAfter && isCleanupMode && brushLayerImg && (
            <KonvaImage image={brushLayerImg} opacity={0.6} listening={false} />
          )}

          {!beforeAfter && surfaces
            .filter((s) => !hiddenIds.includes(s.id))
            .map((surface) => (
              <Group key={surface.id}>
                <Line
                  points={flatten(surface.polygonCoords)}
                  closed
                  fill={surface.color ? surface.color.hex : 'rgba(109,40,217,0.06)'}
                  opacity={surface.color ? 0.55 : 1}
                  globalCompositeOperation={surface.color ? 'multiply' : 'source-over'}
                  stroke={surface.id === activeSurfaceId ? '#6d28d9' : 'rgba(255,255,255,0.5)'}
                  strokeWidth={(surface.id === activeSurfaceId ? 2.5 : 1) / scale}
                  onClick={(e) => {
                    if (isCleanupMode) return;
                    e.cancelBubble = true;
                    selectSurface(surface.id);
                  }}
                />
                {surface.id === activeSurfaceId && tool === 'select' &&
                  surface.polygonCoords.map((pt, i) => (
                    <Circle
                      key={i}
                      x={pt[0]}
                      y={pt[1]}
                      radius={5 / scale}
                      fill="#ffffff"
                      stroke="#6d28d9"
                      strokeWidth={1.5 / scale}
                      draggable={!isLocked}
                      onDragMove={(e) => handleVertexDrag(surface, i, e)}
                      onDragEnd={(e) => handleVertexDragEnd(surface, e)}
                    />
                  ))}
              </Group>
            ))}

          {tool === 'trace' && tracePoints.length > 0 && (
            <>
              <Line
                points={flatten(mousePos ? [...tracePoints, mousePos] : tracePoints)}
                stroke="#6d28d9"
                strokeWidth={2 / scale}
                dash={[6 / scale, 4 / scale]}
              />
              {tracePoints.map((pt, i) => (
                <Circle
                  key={i}
                  x={pt[0]}
                  y={pt[1]}
                  radius={(i === 0 ? 6 : 4) / scale}
                  fill={i === 0 ? '#6d28d9' : '#ffffff'}
                  stroke="#6d28d9"
                  strokeWidth={1.5 / scale}
                />
              ))}
            </>
          )}

          {isCleanupMode && cleanupPoints.map((pt, i) => (
            <Circle
              key={i}
              x={pt.x}
              y={pt.y}
              radius={5 / scale}
              fill="#ef4444"
              stroke="#ffffff"
              strokeWidth={1.5 / scale}
              listening={false}
            />
          ))}

          {isCleanupMode && refining && brushCursor && (
            <Circle
              x={brushCursor.x}
              y={brushCursor.y}
              radius={brushSize / 2}
              stroke="white"
              strokeWidth={1.5 / scale}
              fill="rgba(255,255,255,0.08)"
              listening={false}
            />
          )}
        </Layer>
      </Stage>

      {tool === 'trace' && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/75 px-4 py-1.5 text-xs text-white backdrop-blur">
          Click to place points · click the first point (or Enter) to close · Esc to cancel
        </div>
      )}

      {isCleanupMode && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/75 px-4 py-1.5 text-xs text-white backdrop-blur">
          {segmenting
            ? 'Detecting object...'
            : refining
              ? 'Paint to refine the selection · click "Refine selection" to exit'
              : !cleanupMask
                ? 'Click on an object to select it for removal'
                : 'Object selected — click "Remove" to proceed'}
        </div>
      )}

      {isLocked && (
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] text-white/90 backdrop-blur">
          <Lock size={12} />
          Image locked
        </div>
      )}
    </div>
  );
}
