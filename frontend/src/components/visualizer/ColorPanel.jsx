import { useEffect, useState } from 'react';
import { TextField, InputAdornment, Typography, Tooltip } from '@mui/material';
import { Search } from 'lucide-react';
import { colorsApi } from '../../api/colors';
import useVisualizerStore from '../../store/visualizerStore';

export default function ColorPanel() {
  const [colors, setColors] = useState([]);
  const [search, setSearch] = useState('');
  const activeSurfaceId = useVisualizerStore((s) => s.activeSurfaceId);
  const assignColor = useVisualizerStore((s) => s.assignColor);
  const surfaces = useVisualizerStore((s) => s.surfaces);

  const activeSurface = surfaces.find((s) => s.id === activeSurfaceId);

  useEffect(() => {
    colorsApi.list({ is_active: 'true' })
      .then((result) => {
        const rows = Array.isArray(result) ? result : (result?.data ?? []);
        setColors(rows);
      })
      .catch(() => {});
  }, []);

  const filtered = colors.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
  );

  const handlePick = (color) => {
    if (!activeSurfaceId) return;
    assignColor(activeSurfaceId, color);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-3 pb-2">
        <TextField
          size="small"
          fullWidth
          placeholder="Search colors…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment>,
            },
          }}
        />
      </div>

      {!activeSurfaceId && (
        <div className="mx-3 mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Select a surface to apply a color.
        </div>
      )}
      {activeSurface && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2">
          <div
            className="h-4 w-4 rounded border border-black/10"
            style={{ backgroundColor: activeSurface.color?.hex || '#fff' }}
          />
          <span className="text-xs text-[var(--pv-text-muted)]">
            {activeSurface.customName || activeSurface.label}
            {activeSurface.color ? ` — ${activeSurface.color.name}` : ' — unpainted'}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="grid grid-cols-4 gap-2">
          {filtered.map((color) => (
            <Tooltip key={color.id} title={`${color.name} · ${color.code}`}>
              <button
                className={`h-10 w-10 rounded-lg border-2 transition-transform hover:scale-105 ${
                  activeSurface?.color?.id === color.id ? 'border-[var(--pv-accent)]' : 'border-black/5'
                } ${!activeSurfaceId ? 'cursor-not-allowed opacity-50' : ''}`}
                style={{ backgroundColor: color.hex }}
                onClick={() => handlePick(color)}
                disabled={!activeSurfaceId}
              />
            </Tooltip>
          ))}
        </div>
        {filtered.length === 0 && (
          <Typography variant="body2" className="!text-[var(--pv-text-muted)] !mt-4 !text-center">
            No colors match your search.
          </Typography>
        )}
      </div>
    </div>
  );
}
