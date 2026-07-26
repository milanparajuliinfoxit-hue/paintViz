import { useEffect, useState, useRef, useCallback } from 'react';
import { TextField, InputAdornment, Tooltip, CircularProgress } from '@mui/material';
import { Search, RefreshCw, Palette } from 'lucide-react';
import useVisualizerStore from '../../store/visualizerStore';
import useEditorColors from '../../hooks/useEditorColors';

const DEBOUNCE_MS = 350;

export default function ColorPanel() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const activeSurfaceId = useVisualizerStore((s) => s.activeSurfaceId);
  const assignColor = useVisualizerStore((s) => s.assignColor);
  const surfaces = useVisualizerStore((s) => s.surfaces);

  const activeSurface = surfaces.find((s) => s.id === activeSurfaceId);

  const { colors, loading, loadingMore, error, hasMore, loadFirstPage, loadMore, retry } =
    useEditorColors();

  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    loadFirstPage(debouncedSearch);
  }, [debouncedSearch, loadFirstPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      { root: scrollRef.current, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadMore]);

  const handlePick = useCallback(
    (color) => {
      if (!activeSurfaceId) return;
      assignColor(activeSurfaceId, color);
    },
    [activeSurfaceId, assignColor]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-3 pb-2">
        <TextField
          size="small"
          fullWidth
          placeholder="Search by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={14} className="text-[var(--pv-text-muted)]" />
                </InputAdornment>
              ),
            },
          }}
        />
      </div>

      {!activeSurfaceId && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Palette size={14} className="shrink-0" />
          Select a surface on the canvas to apply a color.
        </div>
      )}
      {activeSurface && (
        <div className="mx-3 mb-2 flex items-center gap-2.5 rounded-lg border border-[var(--pv-border)] bg-zinc-50 px-3 py-2">
          <div
            className="h-5 w-5 shrink-0 rounded-md border border-black/10 shadow-sm"
            style={{ backgroundColor: activeSurface.color?.hex || '#f4f4f5' }}
          />
          <div className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-[var(--pv-text)]">
              {activeSurface.customName || activeSurface.label}
            </span>
            <span className="block truncate text-[11px] text-[var(--pv-text-muted)]">
              {activeSurface.color ? activeSurface.color.name : 'No color assigned'}
            </span>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="mx-3 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="text-xs text-red-700">
            {colors.length === 0
              ? 'Unable to load colors. Please try again.'
              : 'Unable to load more colors.'}
          </p>
          <button
            onClick={retry}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 pb-4">
        {loading && colors.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12">
            <CircularProgress size={22} sx={{ color: 'var(--pv-accent)' }} />
            <span className="text-xs text-[var(--pv-text-muted)]">Loading colors...</span>
          </div>
        )}

        {!loading && colors.length === 0 && !error && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Palette size={24} className="text-zinc-300" />
            <span className="text-xs text-[var(--pv-text-muted)]">
              {debouncedSearch ? 'No colors match your search.' : 'No colors available.'}
            </span>
            {debouncedSearch && (
              <button
                onClick={() => setSearch('')}
                className="text-xs font-medium text-[var(--pv-accent)] hover:text-[var(--pv-accent-hover)]"
              >
                Clear search
              </button>
            )}
          </div>
        )}

        {colors.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {colors.map((color) => {
              const isActive = activeSurface?.color?.id === color.id;
              return (
                <Tooltip key={color.id} title={`${color.name} (${color.code})`} arrow placement="top">
                  <button
                    className={`group/swatch relative flex flex-col items-center rounded-lg border-2 p-1 transition-all hover:scale-105 ${
                      isActive
                        ? 'border-[var(--pv-accent)] shadow-sm shadow-[var(--pv-accent)]/20'
                        : 'border-transparent hover:border-zinc-200'
                    } ${!activeSurfaceId ? 'cursor-not-allowed opacity-50' : ''}`}
                    onClick={() => handlePick(color)}
                    disabled={!activeSurfaceId}
                  >
                    <div
                      className="h-8 w-full rounded-md border border-black/5"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="mt-1 w-full truncate text-center text-[9px] leading-tight text-[var(--pv-text-muted)]">
                      {color.code}
                    </span>
                    {isActive && (
                      <div className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--pv-accent)] text-white">
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>
                </Tooltip>
              );
            })}
          </div>
        )}

        {loadingMore && (
          <div className="flex items-center justify-center gap-2 py-3">
            <CircularProgress size={14} sx={{ color: 'var(--pv-accent)' }} />
            <span className="text-xs text-[var(--pv-text-muted)]">Loading more...</span>
          </div>
        )}

        <div ref={sentinelRef} className="h-px" />
      </div>

      {colors.length > 0 && (
        <div className="border-t border-[var(--pv-border)] px-3 py-1.5">
          <span className="text-[11px] text-[var(--pv-text-muted)]">
            {colors.length} color{colors.length !== 1 ? 's' : ''} loaded
          </span>
        </div>
      )}
    </div>
  );
}
