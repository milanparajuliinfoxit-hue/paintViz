import { useState } from 'react';
import { Button, IconButton, Tooltip, Select, MenuItem, Divider, Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress } from '@mui/material';
import {
  Undo2, Redo2, RotateCcw, Eye, MousePointer2, PenTool, ZoomIn, ZoomOut, Maximize,
  ArrowLeft, Save, Check, Lock, Unlock, Eraser, Loader2, Paintbrush, Plus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useVisualizerStore from '../../store/visualizerStore';
import { createRemovalJob } from '../../api/removals';

export default function Toolbar({ zoom, onZoomIn, onZoomOut, onFit }) {
  const navigate = useNavigate();
  const project = useVisualizerStore((s) => s.project);
  const tool = useVisualizerStore((s) => s.tool);
  const setTool = useVisualizerStore((s) => s.setTool);
  const undo = useVisualizerStore((s) => s.undo);
  const redo = useVisualizerStore((s) => s.redo);
  const history = useVisualizerStore((s) => s.history);
  const future = useVisualizerStore((s) => s.future);
  const resetColors = useVisualizerStore((s) => s.resetColors);
  const beforeAfter = useVisualizerStore((s) => s.beforeAfter);
  const setBeforeAfter = useVisualizerStore((s) => s.setBeforeAfter);
  const combos = useVisualizerStore((s) => s.combos);
  const activeComboId = useVisualizerStore((s) => s.activeComboId);
  const applyCombo = useVisualizerStore((s) => s.applyCombo);
  const saveCombo = useVisualizerStore((s) => s.saveCombo);
  const activePhotoId = useVisualizerStore((s) => s.activePhotoId);
  const lockedPhotoIds = useVisualizerStore((s) => s.lockedPhotoIds);
  const togglePhotoLock = useVisualizerStore((s) => s.togglePhotoLock);
  const cleanupMask = useVisualizerStore((s) => s.cleanupMask);
  const activeRemovalJobId = useVisualizerStore((s) => s.activeRemovalJobId);
  const removalJobStatus = useVisualizerStore((s) => s.removalJobStatus);
  const setActiveRemovalJob = useVisualizerStore((s) => s.setActiveRemovalJob);
  const clearCleanupSelection = useVisualizerStore((s) => s.clearCleanupSelection);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [comboName, setComboName] = useState('');
  const [saved, setSaved] = useState(false);
  const [submittingRemoval, setSubmittingRemoval] = useState(false);
  const [refining, setRefining] = useState(false);
  const [brushSize, setBrushSize] = useState(20);

  const isLocked = activePhotoId ? lockedPhotoIds.includes(activePhotoId) : false;
  const isCleanupMode = tool === 'cleanup';
  const canRemove = isCleanupMode && cleanupMask && !activeRemovalJobId && !submittingRemoval;
  const isJobActive = activeRemovalJobId && (removalJobStatus === 'pending' || removalJobStatus === 'processing');

  const handleSaveCombo = async () => {
    if (!comboName.trim()) return;
    await saveCombo(comboName.trim());
    setSaveDialogOpen(false);
    setComboName('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleRemove = async () => {
    if (!canRemove || !activePhotoId) return;
    setSubmittingRemoval(true);
    try {
      const { jobId } = await createRemovalJob(activePhotoId, cleanupMask);
      setActiveRemovalJob(jobId);
    } catch (err) {
      const message = err.message || 'Failed to submit removal job';
      console.error('Failed to submit removal job', {
        photoId: activePhotoId,
        status: err.code,
        message,
      });
      alert(message);
    } finally {
      setSubmittingRemoval(false);
    }
  };

  return (
    <div className="flex h-14 shrink-0 items-center gap-1.5 border-b border-[var(--pv-border)] bg-[var(--pv-surface)] px-3">
      <Tooltip title="Back to projects">
        <IconButton size="small" onClick={() => navigate('/projects')}>
          <ArrowLeft size={17} />
        </IconButton>
      </Tooltip>
      <span className="mr-2 max-w-[160px] truncate text-sm font-medium">{project?.name}</span>

      <Divider orientation="vertical" flexItem className="!my-2.5" />

      <Tooltip title="Select & edit (V)">
        <IconButton size="small" onClick={() => setTool('select')} className={tool === 'select' ? '!bg-[var(--pv-accent)]/10 !text-[var(--pv-accent)]' : ''}>
          <MousePointer2 size={16} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Trace a surface (P)">
        <IconButton size="small" onClick={() => setTool('trace')} className={tool === 'trace' ? '!bg-[var(--pv-accent)]/10 !text-[var(--pv-accent)]' : ''}>
          <PenTool size={16} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Remove objects">
        <IconButton size="small" onClick={() => setTool('cleanup')} className={isCleanupMode ? '!bg-[var(--pv-accent)]/10 !text-[var(--pv-accent)]' : ''}>
          <Eraser size={16} />
        </IconButton>
      </Tooltip>

      {isCleanupMode && (
        <>
          <Divider orientation="vertical" flexItem className="!my-2.5" />

          {isJobActive ? (
            <div className="flex items-center gap-1.5 text-xs text-[var(--pv-text-muted)]">
              <Loader2 size={14} className="animate-spin" />
              <span>Processing...</span>
            </div>
          ) : (
            <>
              <Button
                size="small"
                variant="contained"
                disabled={!canRemove}
                onClick={handleRemove}
                startIcon={submittingRemoval ? <CircularProgress size={12} color="inherit" /> : <Eraser size={14} />}
                className="!text-xs"
              >
                {submittingRemoval ? 'Submitting...' : 'Remove'}
              </Button>

              {cleanupMask && (
                <>
                  <Tooltip title="Add another object to selection">
                    <IconButton
                      size="small"
                      onClick={() => {
                        // Clear mask but keep points — next click will add to existing selection
                        useVisualizerStore.setState({ cleanupMask: null });
                      }}
                      className="!text-[var(--pv-text-muted)]"
                    >
                      <Plus size={14} />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title={refining ? 'Exit refine mode' : 'Refine selection (brush)'}>
                    <IconButton
                      size="small"
                      onClick={() => setRefining(!refining)}
                      className={refining ? '!bg-[var(--pv-accent)]/10 !text-[var(--pv-accent)]' : '!text-[var(--pv-text-muted)]'}
                    >
                      <Paintbrush size={14} />
                    </IconButton>
                  </Tooltip>

                  {refining && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[var(--pv-text-muted)]">{brushSize}px</span>
                      <input
                        type="range"
                        min={5}
                        max={100}
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="w-20 accent-[var(--pv-accent)]"
                      />
                    </div>
                  )}

                  <Tooltip title="Clear selection">
                    <IconButton size="small" onClick={() => { clearCleanupSelection(); setRefining(false); }}>
                      <RotateCcw size={14} />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </>
          )}
        </>
      )}

      <Divider orientation="vertical" flexItem className="!my-2.5" />

      <Tooltip title="Undo (Ctrl+Z)">
        <span>
          <IconButton size="small" onClick={undo} disabled={history.length === 0}>
            <Undo2 size={16} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Redo (Ctrl+Shift+Z)">
        <span>
          <IconButton size="small" onClick={redo} disabled={future.length === 0}>
            <Redo2 size={16} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Reset all colors">
        <IconButton size="small" onClick={resetColors}>
          <RotateCcw size={16} />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem className="!my-2.5" />

      <Tooltip title={isLocked ? 'Unlock image' : 'Lock image position'}>
        <IconButton
          size="small"
          onClick={() => activePhotoId && togglePhotoLock(activePhotoId)}
          disabled={!activePhotoId}
          className={isLocked ? '!bg-amber-100 !text-amber-600' : ''}
        >
          {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
        </IconButton>
      </Tooltip>

      <Tooltip title="Hold to see original photo">
        <IconButton
          size="small"
          onMouseDown={() => setBeforeAfter(true)}
          onMouseUp={() => setBeforeAfter(false)}
          onMouseLeave={() => setBeforeAfter(false)}
          className={beforeAfter ? '!bg-[var(--pv-accent)]/10 !text-[var(--pv-accent)]' : ''}
        >
          <Eye size={16} />
        </IconButton>
      </Tooltip>

      <div className="ml-auto flex items-center gap-1.5">
        <Select
          size="small"
          value={activeComboId || ''}
          displayEmpty
          onChange={(e) => applyCombo(e.target.value)}
          className="!h-8 !text-xs w-40"
        >
          <MenuItem value="" disabled>No combo selected</MenuItem>
          {combos.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
          ))}
        </Select>
        <Button size="small" startIcon={saved ? <Check size={14} /> : <Save size={14} />} onClick={() => setSaveDialogOpen(true)}>
          {saved ? 'Saved' : 'Save combo'}
        </Button>

        <Divider orientation="vertical" flexItem className="!mx-1 !my-2.5" />

        <Tooltip title="Zoom out">
          <IconButton size="small" onClick={onZoomOut}><ZoomOut size={16} /></IconButton>
        </Tooltip>
        <span className="w-10 text-center text-xs text-[var(--pv-text-muted)]">{Math.round(zoom * 100)}%</span>
        <Tooltip title="Zoom in">
          <IconButton size="small" onClick={onZoomIn}><ZoomIn size={16} /></IconButton>
        </Tooltip>
        <Tooltip title="Fit to screen">
          <IconButton size="small" onClick={onFit}><Maximize size={16} /></IconButton>
        </Tooltip>
      </div>

      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Save color combo</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="e.g. Warm neutral scheme"
            value={comboName}
            onChange={(e) => setComboName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveCombo()}
            className="!mt-2"
          />
        </DialogContent>
        <DialogActions className="!px-6 !pb-4">
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveCombo}>Save</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
