import { useRef, useState, useCallback } from 'react';
import { IconButton, Checkbox, Typography, LinearProgress, Tooltip } from '@mui/material';
import { Upload, X, ImagePlus, AlertCircle, Trash2 } from 'lucide-react';
import useVisualizerStore from '../../store/visualizerStore';

const MAX_FILE_SIZE_MB = 15;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function validateFiles(fileList) {
  const valid = [];
  const errors = [];
  Array.from(fileList).forEach((file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      errors.push(`${file.name}: unsupported file type`);
    } else if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      errors.push(`${file.name}: exceeds ${MAX_FILE_SIZE_MB}MB limit`);
    } else {
      valid.push(file);
    }
  });
  return { valid, errors };
}

export default function PhotoPanel() {
  const photos = useVisualizerStore((s) => s.photos);
  const activePhotoId = useVisualizerStore((s) => s.activePhotoId);
  const setActivePhoto = useVisualizerStore((s) => s.setActivePhoto);
  const addPhotos = useVisualizerStore((s) => s.addPhotos);
  const deletePhoto = useVisualizerStore((s) => s.deletePhoto);
  const bulkDeletePhotos = useVisualizerStore((s) => s.bulkDeletePhotos);

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState([]);

  const handleFiles = useCallback(async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const { valid, errors: validationErrors } = validateFiles(fileList);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
    }

    if (valid.length === 0) return;

    setUploading(true);
    setProgress(0);
    try {
      await addPhotos(valid, setProgress);
    } catch (err) {
      const msg = err?.message || 'Upload failed. Check file type and size, then try again.';
      setErrors([msg]);
    } finally {
      setUploading(false);
    }
  }, [addPhotos]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const toggleSelected = useCallback((id) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }, []);

  const handleBulkDelete = useCallback(async () => {
    try {
      await bulkDeletePhotos(selectedIds);
      setSelectedIds([]);
      setSelectMode(false);
    } catch {
      setErrors(['Unable to remove the selected photos. Please try again.']);
    }
  }, [bulkDeletePhotos, selectedIds]);

  const handleDelete = useCallback(async (e, photoId) => {
    e.stopPropagation();
    try {
      await deletePhoto(photoId);
    } catch {
      setErrors(['Unable to remove the photo. Please try again.']);
    }
  }, [deletePhoto]);

  const clearErrors = useCallback(() => setErrors([]), []);

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-[var(--pv-border)] bg-[var(--pv-surface)]">
      <div className="flex items-center justify-between px-4 py-3">
        <Typography variant="subtitle2" className="!font-semibold">
          Photos
          {photos.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-[var(--pv-text-muted)]">
              ({photos.length})
            </span>
          )}
        </Typography>
        <div className="flex items-center gap-1">
          {photos.length > 0 && (
            <button
              className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--pv-text-muted)] transition-colors hover:bg-zinc-100 hover:text-[var(--pv-text)]"
              onClick={() => { setSelectMode((v) => !v); setSelectedIds([]); }}
            >
              {selectMode ? 'Cancel' : 'Select'}
            </button>
          )}
        </div>
      </div>

      {selectMode && selectedIds.length > 0 && (
        <div className="flex items-center justify-between border-b border-[var(--pv-border)] bg-red-50 px-4 py-2">
          <span className="text-xs font-medium text-red-700">
            {selectedIds.length} selected
          </span>
          <button
            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800"
            onClick={handleBulkDelete}
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      )}

      <div
        className={`mx-3 mb-3 mt-1 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-5 text-center transition-all ${
          dragOver
            ? 'border-[var(--pv-accent)] bg-[var(--pv-accent)]/5'
            : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
      >
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
          dragOver ? 'bg-[var(--pv-accent)]/10' : 'bg-zinc-100'
        }`}>
          <Upload size={16} className={dragOver ? 'text-[var(--pv-accent)]' : 'text-zinc-400'} />
        </div>
        <div>
          <span className="text-xs font-medium text-[var(--pv-text)]">
            {dragOver ? 'Drop photos here' : 'Upload photos'}
          </span>
          <span className="mt-0.5 block text-[11px] text-[var(--pv-text-muted)]">
            Drag & drop or click to browse
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {uploading && (
        <div className="mx-3 mb-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] text-[var(--pv-text-muted)]">Uploading...</span>
            <span className="text-[11px] font-medium text-[var(--pv-accent)]">{progress}%</span>
          </div>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 4,
              borderRadius: 2,
              backgroundColor: '#f4f4f5',
              '& .MuiLinearProgress-bar': { borderRadius: 2, backgroundColor: 'var(--pv-accent)' },
            }}
          />
        </div>
      )}

      {errors.length > 0 && (
        <div className="mx-3 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <div className="flex items-start gap-1.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-500" />
            <div className="flex-1">
              {errors.length === 1 ? (
                <p className="text-xs text-red-700">{errors[0]}</p>
              ) : (
                <ul className="list-inside list-disc text-xs text-red-700">
                  {errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  {errors.length > 5 && <li>...and {errors.length - 5} more</li>}
                </ul>
              )}
            </div>
            <button onClick={clearErrors} className="shrink-0 text-red-400 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {photos.length === 0 && !uploading && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
              <ImagePlus size={22} className="text-zinc-300" />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--pv-text-muted)]">No photos yet</p>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                Upload project photos to start tracing surfaces
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {photos.map((photo, index) => {
            const isActive = activePhotoId === photo.id;
            return (
              <div
                key={photo.id}
                className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 transition-all ${
                  isActive
                    ? 'border-[var(--pv-accent)] shadow-sm shadow-[var(--pv-accent)]/10'
                    : 'border-transparent hover:border-zinc-200'
                }`}
                onClick={() => (selectMode ? toggleSelected(photo.id) : setActivePhoto(photo.id))}
              >
                <img
                  src={photo.fileUrl}
                  alt={`Project photo ${index + 1}`}
                  className="h-24 w-full object-cover"
                  loading="lazy"
                />
                <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent px-2 py-1.5 transition-opacity ${
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  <span className="text-[11px] font-medium text-white">
                    Photo {index + 1}
                  </span>
                </div>
                {isActive && !selectMode && (
                  <div className="absolute left-1.5 top-1.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--pv-accent)] text-white shadow-sm">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                )}
                {selectMode && (
                  <div className="absolute left-1.5 top-1.5">
                    <Checkbox
                      size="small"
                      checked={selectedIds.includes(photo.id)}
                      className="!rounded-md !bg-white/90"
                    />
                  </div>
                )}
                {!selectMode && (
                  <Tooltip title="Remove photo">
                    <IconButton
                      size="small"
                      className="!absolute !right-1.5 !top-1.5 !bg-black/50 !p-0.5 opacity-0 backdrop-blur-sm transition-opacity hover:!bg-red-500/90 hover:!text-white group-hover:opacity-100"
                      onClick={(e) => handleDelete(e, photo.id)}
                    >
                      <X size={12} />
                    </IconButton>
                  </Tooltip>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
