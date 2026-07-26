import { useState } from 'react';
import { IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { MoreVertical, Home, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ProjectCard({ project, onRename, onDelete }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();

  const timeAgo = (() => {
    const diffMs = Date.now() - new Date(project.updatedAt).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  })();

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-xl border border-[var(--pv-border)] bg-[var(--pv-surface)] transition-shadow hover:shadow-md"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div className="relative flex h-36 items-center justify-center bg-zinc-100">
        {project.thumbnailUrl ? (
          <img src={project.thumbnailUrl} alt={project.name} className="h-full w-full object-cover" />
        ) : (
          <Home size={28} className="text-zinc-300" />
        )}
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
          <IconButton
            size="small"
            className="!bg-white/90 hover:!bg-white"
            onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
          >
            <MoreVertical size={15} />
          </IconButton>
        </div>
      </div>
      <div className="px-4 py-3">
        <Typography variant="body2" className="!font-medium !truncate">{project.name}</Typography>
        <Typography variant="caption" className="!text-[var(--pv-text-muted)]">
          Edited {timeAgo}
        </Typography>
      </div>

      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)} onClick={(e) => e.stopPropagation()}>
        <MenuItem onClick={() => { setAnchorEl(null); onRename(project); }}>
          <Pencil size={14} className="mr-2" /> Rename
        </MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); onDelete(project); }} className="!text-red-600">
          <Trash2 size={14} className="mr-2" /> Delete
        </MenuItem>
      </Menu>
    </div>
  );
}
