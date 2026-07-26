import { useRef, useState } from 'react';
import { IconButton, Checkbox, Typography, LinearProgress, Tooltip } from '@mui/material';
import { Upload, X, ImagePlus } from 'lucide-react';
import useVisualizerStore from '../../store/visualizerStore';

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
  const [error, setError] = useState(null);

  const handleFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setUploading(true);
    setProgress(0);
    try {
      await addPhotos(fileList, setProgress);
    } catch (err) {
      setError(err?.message || 'Upload failed. Check file type/size and try again.');
    } finally {
      setUploading(false);
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const handleBulkDelete = async () => {
    await bulkDeletePhotos(selectedIds);
    setSelectedIds([]);
    setSelectMode(false);
  };

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-[var(--pv-border)] bg-[var(--pv-surface)]">
      <div className="flex items-center justify-between px-4 py-3">
        <Typography variant="subtitle2" className="!font-semibold">Photos</Typography>
        <div className="flex items-center gap-1">
          {photos.length > 0 && (
            <button
              className="text-xs font-medium text-[var(--pv-text-muted)] hover:text-[var(--pv-text)]"
              onClick={() => { setSelectMode((v) => !v); setSelectedIds([]); }}
            >
              {selectMode ? 'Cancel' : 'Select'}
            </button>
          )}
        </div>
      </div>

      {selectMode && selectedIds.length > 0 && (
        <div className="flex items-center justify-between px-4 pb-2">
          <span className="text-xs text-[var(--pv-text-muted)]">{selectedIds.length} selected</span>
          <button
            className="text-xs font-medium text-red-600 hover:text-red-700"
            onClick={handleBulkDelete}
          >
            Delete
          </button>
        </div>
      )}

      <div
        className={`mx-4 mb-3 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-4 text-center transition-colors ${
          dragOver ? 'border-[var(--pv-accent)] bg-[var(--pv-accent)]/5' : 'border-zinc-200'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        role="button"
      >
        <Upload size={18} className="text-zinc-400" />
        <span className="text-xs text-[var(--pv-text-muted)]">Drag photos or click to upload</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {uploading && (
        <div className="mx-4 mb-3">
          <LinearProgress variant="determinate" value={progress} />
        </div>
      )}
      {error && <div className="mx-4 mb-3 text-xs text-red-600">{error}</div>}

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {photos.length === 0 && !uploading && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ImagePlus size={24} className="text-zinc-300" />
            <span className="text-xs text-[var(--pv-text-muted)]">No photos uploaded yet</span>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className={`group relative cursor-pointer overflow-hidden rounded-lg border-2 transition-colors ${
                activePhotoId === photo.id ? 'border-[var(--pv-accent)]' : 'border-transparent hover:border-zinc-200'
              }`}
              onClick={() => (selectMode ? toggleSelected(photo.id) : setActivePhoto(photo.id))}
            >
              <img src={photo.fileUrl} alt="" className="h-24 w-full object-cover" />
              {selectMode && (
                <div className="absolute left-1.5 top-1.5">
                  <Checkbox
                    size="small"
                    checked={selectedIds.includes(photo.id)}
                    className="!bg-white/80 !rounded"
                  />
                </div>
              )}
              {!selectMode && (
                <Tooltip title="Delete photo">
                  <IconButton
                    size="small"
                    className="!absolute !right-1 !top-1 !bg-white/85 opacity-0 transition-opacity hover:!bg-white group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id); }}
                  >
                    <X size={13} />
                  </IconButton>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
