import { useEffect, useState } from 'react';
import {
  Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Snackbar, Alert,
} from '@mui/material';
import { Plus, FolderKanban } from 'lucide-react';
import { projectsApi } from '../api/projects';
import ProjectCard from '../components/projects/ProjectCard';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await projectsApi.list();
      setProjects(data);
    } catch (err) {
      setToast({ severity: err.severity || 'error', message: err.message || 'Failed to load projects.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await projectsApi.create({ name: newName.trim() });
      setNewDialogOpen(false);
      setNewName('');
      fetchProjects();
    } catch (err) {
      setToast({ severity: err.severity || 'error', message: err.message || 'Failed to create project.' });
    }
  };

  const handleRename = async () => {
    if (!renameValue.trim()) return;
    try {
      await projectsApi.update(renameTarget.id, { name: renameValue.trim() });
      setRenameTarget(null);
      fetchProjects();
    } catch (err) {
      setToast({ severity: err.severity || 'error', message: err.message || 'Failed to rename project.' });
    }
  };

  const handleDelete = async () => {
    try {
      await projectsApi.remove(deleteTarget.id);
      setDeleteTarget(null);
      setToast({ severity: 'success', message: 'Project deleted.' });
      fetchProjects();
    } catch (err) {
      setToast({ severity: err.severity || 'error', message: err.message || 'Failed to delete project.' });
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--pv-border)] bg-[var(--pv-surface)] px-8 py-5">
        <div>
          <Typography variant="h5" className="!font-semibold !tracking-tight">Projects</Typography>
          <Typography variant="body2" className="!text-[var(--pv-text-muted)] !mt-0.5">
            Upload house photos and visualize paint colors
          </Typography>
        </div>
        <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setNewDialogOpen(true)}>
          New project
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <FolderKanban size={36} className="text-zinc-300" />
            <Typography variant="body1" className="!font-medium">No projects yet</Typography>
            <Typography variant="body2" className="!text-[var(--pv-text-muted)] max-w-sm">
              Create a project, upload house photos, and start visualizing paint colors.
            </Typography>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setNewDialogOpen(true)} className="!mt-2">
              New project
            </Button>
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onRename={(p) => { setRenameTarget(p); setRenameValue(p.name); }}
              onDelete={(p) => setDeleteTarget(p)}
            />
          ))}
        </div>
      </div>

      {/* New project dialog */}
      <Dialog open={newDialogOpen} onClose={() => setNewDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Project name"
            placeholder="e.g. 123 Maple Street"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="!mt-2"
          />
        </DialogContent>
        <DialogActions className="!px-6 !pb-4">
          <Button onClick={() => setNewDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onClose={() => setRenameTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Rename project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            className="!mt-2"
          />
        </DialogContent>
        <DialogActions className="!px-6 !pb-4">
          <Button onClick={() => setRenameTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleRename}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete "{deleteTarget?.name}"?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" className="!text-[var(--pv-text-muted)]">
            This deletes all photos, traced surfaces, and saved visualizations in this project. This can't be undone.
          </Typography>
        </DialogContent>
        <DialogActions className="!px-6 !pb-4">
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {toast && <Alert severity={toast.severity} variant="filled">{toast.message}</Alert>}
      </Snackbar>
    </div>
  );
}
