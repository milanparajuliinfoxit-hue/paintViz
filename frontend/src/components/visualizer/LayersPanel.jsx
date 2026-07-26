import { useState } from 'react';
import { IconButton, Typography, Tooltip, MenuItem, Select } from '@mui/material';
import { Eye, EyeOff, Trash2, Layers as LayersIcon } from 'lucide-react';
import useVisualizerStore from '../../store/visualizerStore';

const LABELS = ['Wall', 'Roof', 'Trim', 'Door', 'Window', 'Ceiling', 'Other'];

export default function LayersPanel({ hiddenIds, onToggleVisibility }) {
  const surfaces = useVisualizerStore((s) => s.surfaces);
  const activeSurfaceId = useVisualizerStore((s) => s.activeSurfaceId);
  const selectSurface = useVisualizerStore((s) => s.selectSurface);
  const deleteSurface = useVisualizerStore((s) => s.deleteSurface);

  if (surfaces.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <LayersIcon size={22} className="text-zinc-300" />
        <span className="text-xs text-[var(--pv-text-muted)]">
          No surfaces traced yet. Use the Trace tool to outline a wall, roof, or trim.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-2 py-2">
      {surfaces.map((surface) => {
        const isActive = surface.id === activeSurfaceId;
        const isHidden = hiddenIds.includes(surface.id);
        return (
          <div
            key={surface.id}
            className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer ${
              isActive ? 'bg-[var(--pv-accent)]/10' : 'hover:bg-zinc-50'
            }`}
            onClick={() => selectSurface(surface.id)}
          >
            <div
              className="h-4 w-4 shrink-0 rounded border border-black/10"
              style={{ backgroundColor: surface.color?.hex || 'transparent' }}
            />
            <div className="min-w-0 flex-1">
              <Typography variant="body2" noWrap className={isActive ? '!font-medium !text-[var(--pv-accent)]' : ''}>
                {surface.customName || surface.label}
              </Typography>
            </div>
            <Tooltip title={isHidden ? 'Show' : 'Hide'}>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggleVisibility(surface.id); }}>
                {isHidden ? <EyeOff size={14} /> : <Eye size={14} className="opacity-0 group-hover:opacity-100" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete surface">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); deleteSurface(surface.id); }}>
                <Trash2 size={14} className="opacity-0 group-hover:opacity-100" />
              </IconButton>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}

export function SurfaceLabelSelect({ surfaceId, value }) {
  const [label, setLabel] = useState(value);
  return (
    <Select
      size="small"
      value={label}
      onChange={(e) => setLabel(e.target.value)}
      className="!text-xs"
    >
      {LABELS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
    </Select>
  );
}

export { LABELS };
