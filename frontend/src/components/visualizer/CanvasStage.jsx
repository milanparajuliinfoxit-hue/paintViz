import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Circle, Group } from 'react-konva';
import useImage from 'use-image';
import useVisualizerStore from '../../store/visualizerStore';

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const SNAP_THRESHOLD = 10; // px, in image space

function flatten(points) {
  return points.flat();
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
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

  const activePhoto = photos.find((p) => p.id === activePhotoId);
  const [image] = useImage(activePhoto?.fileUrl, 'anonymous');

  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [tracePoints, setTracePoints] = useState([]);
  const [mousePos, setMousePos] = useState(null);
  const [pendingLabel, setPendingLabel] = useState('Wall');

  // Fit-to-screen whenever a new image loads
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

  // Cursor-anchored zoom
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

    setScale(newScale);
    setPosition({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
    onZoomChange?.(newScale);
  };

  const toImageCoords = (pointer) => [
    (pointer.x - position.x) / scale,
    (pointer.y - position.y) / scale,
  ];

  const handleStageClick = (e) => {
    if (tool !== 'trace') return;
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    let [ix, iy] = toImageCoords(pointer);

    // Snap to first point to close polygon
    if (tracePoints.length >= 3 && distance([ix, iy], tracePoints[0]) < SNAP_THRESHOLD / scale) {
      finishTrace();
      return;
    }
    setTracePoints((pts) => [...pts, [ix, iy]]);
  };

  const handleMouseMove = () => {
    if (tool !== 'trace' || !stageRef.current) return;
    const pointer = stageRef.current.getPointerPosition();
    if (!pointer) return;
    setMousePos(toImageCoords(pointer));
  };

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
      if (e.key === 'Escape') cancelTrace();
      if ((e.key === 'Enter') && tool === 'trace') finishTrace();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVertexDrag = (surface, index, e) => {
    const newCoords = surface.polygonCoords.map((pt, i) =>
      i === index ? [e.target.x(), e.target.y()] : pt
    );
    // Optimistic local update happens via store on drag end to avoid excess API calls
    e.target._newCoords = newCoords;
  };

  const handleVertexDragEnd = (surface, e) => {
    const newCoords = e.target._newCoords;
    if (newCoords) updateSurfacePolygon(surface.id, newCoords);
  };

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
        draggable={tool === 'select'}
        onDragEnd={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onMouseMove={handleMouseMove}
        style={{ cursor: tool === 'trace' ? 'crosshair' : 'default' }}
      >
        <Layer>
          {image && <KonvaImage image={image} />}

          {/* Traced surfaces */}
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
                  onClick={(e) => { e.cancelBubble = true; selectSurface(surface.id); }}
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
                      draggable
                      onDragMove={(e) => handleVertexDrag(surface, i, e)}
                      onDragEnd={(e) => handleVertexDragEnd(surface, e)}
                    />
                  ))}
              </Group>
            ))}

          {/* In-progress trace */}
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
        </Layer>
      </Stage>

      {tool === 'trace' && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/75 px-4 py-1.5 text-xs text-white backdrop-blur">
          Click to place points · click the first point (or Enter) to close · Esc to cancel
        </div>
      )}
    </div>
  );
}
