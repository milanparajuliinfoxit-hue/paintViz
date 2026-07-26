import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, Tab, CircularProgress } from '@mui/material';
import useVisualizerStore from '../store/visualizerStore';
import PhotoPanel from '../components/visualizer/PhotoPanel';
import LayersPanel from '../components/visualizer/LayersPanel';
import ColorPanel from '../components/visualizer/ColorPanel';
import CanvasStage from '../components/visualizer/CanvasStage';
import Toolbar from '../components/visualizer/Toolbar';

export default function VisualizerPage() {
  const { projectId } = useParams();
  const loadProject = useVisualizerStore((s) => s.loadProject);
  const loading = useVisualizerStore((s) => s.loading);
  const photos = useVisualizerStore((s) => s.photos);
  const undo = useVisualizerStore((s) => s.undo);
  const redo = useVisualizerStore((s) => s.redo);

  const [rightTab, setRightTab] = useState('layers');
  const [hiddenIds, setHiddenIds] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [fitSignal, setFitSignal] = useState(0);
  const stageRef = useRef(null);

  useEffect(() => { loadProject(projectId); }, [projectId, loadProject]);

  useEffect(() => {
    const handleKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [undo, redo]);

  const toggleVisibility = (id) => {
    setHiddenIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const zoomBy = (factor) => {
    const stage = stageRef.current;
    if (!stage) return;
    const newScale = Math.max(0.1, Math.min(8, stage.scaleX() * factor));
    const center = { x: stage.width() / 2, y: stage.height() / 2 };
    const pointTo = { x: (center.x - stage.x()) / stage.scaleX(), y: (center.y - stage.y()) / stage.scaleY() };
    stage.scale({ x: newScale, y: newScale });
    stage.position({ x: center.x - pointTo.x * newScale, y: center.y - pointTo.y * newScale });
    stage.batchDraw();
    setZoom(newScale);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--pv-canvas-bg)]">
        <CircularProgress size={28} sx={{ color: 'white' }} />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <Toolbar
        zoom={zoom}
        onZoomIn={() => zoomBy(1.25)}
        onZoomOut={() => zoomBy(0.8)}
        onFit={() => setFitSignal((n) => n + 1)}
      />
      <div className="flex flex-1 overflow-hidden">
        <PhotoPanel />

        <div className="relative flex-1">
          {photos.length === 0 ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[var(--pv-canvas-bg)] text-center">
              <span className="text-sm text-zinc-400">Upload a photo to get started</span>
              <span className="text-xs text-zinc-500">Use the panel on the left</span>
            </div>
          ) : (
            <CanvasStage
              hiddenIds={hiddenIds}
              onZoomChange={setZoom}
              fitSignal={fitSignal}
              stageRef={stageRef}
            />
          )}
        </div>

        <div className="flex w-72 shrink-0 flex-col border-l border-[var(--pv-border)] bg-[var(--pv-surface)]">
          <Tabs
            value={rightTab}
            onChange={(_, v) => setRightTab(v)}
            variant="fullWidth"
            className="!min-h-0 !border-b !border-[var(--pv-border)]"
          >
            <Tab value="layers" label="Layers" className="!min-h-10 !text-xs" />
            <Tab value="colors" label="Colors" className="!min-h-10 !text-xs" />
          </Tabs>
          <div className="flex-1 overflow-y-auto">
            {rightTab === 'layers' ? (
              <LayersPanel hiddenIds={hiddenIds} onToggleVisibility={toggleVisibility} />
            ) : (
              <ColorPanel />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
