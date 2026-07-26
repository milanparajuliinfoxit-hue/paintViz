import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Button, TextField, MenuItem, InputAdornment, Dialog, DialogTitle,
  DialogContent, DialogActions, Typography, Snackbar, Alert,
} from '@mui/material';
import { Plus, Search, Trash2, EyeOff, FileSpreadsheet, X } from 'lucide-react';
import { colorsApi } from '../api/colors';
import ColorTable from '../components/catalog/ColorTable';
import ColorDrawer from '../components/catalog/ColorDrawer';
import ImportColorsDialog from '../components/catalog/ImportColorsDialog';

const DEBOUNCE_MS = 300;

export default function CatalogPage() {
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [brands, setBrands] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingColor, setEditingColor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const abortRef = useRef(0);

  const refreshBrands = useCallback(() => {
    colorsApi.listBrands().then(setBrands).catch(() => {});
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    refreshBrands();
  }, [refreshBrands]);

  // Load distinct brands once
  useEffect(() => { refreshBrands(); }, [refreshBrands]);

  // Debounce search → update debounced value
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 when filters change
  const prevFiltersRef = useRef({ debouncedSearch, brandFilter });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (prev.debouncedSearch !== debouncedSearch || prev.brandFilter !== brandFilter) {
      setPage(1);
      prevFiltersRef.current = { debouncedSearch, brandFilter };
    }
  }, [debouncedSearch, brandFilter]);

  // Fetch colors (server-side paginated)
  useEffect(() => {
    const requestId = ++abortRef.current;
    let cancelled = false;

    async function fetchColors() {
      setLoading(true);
      try {
        const params = { page, limit };
        if (debouncedSearch) params.search = debouncedSearch;
        if (brandFilter) params.brand = brandFilter;
        const result = await colorsApi.list(params);
        if (cancelled || requestId !== abortRef.current) return;
        const rows = Array.isArray(result) ? result : (result?.data ?? []);
        const pagination = result?.pagination;
        setColors(rows);
        setTotal(pagination?.total ?? rows.length);
      } catch (err) {
        if (!cancelled && requestId === abortRef.current) {
          setToast({ severity: err.severity || 'error', message: err.message || 'Failed to load colors.' });
        }
      } finally {
        if (!cancelled && requestId === abortRef.current) setLoading(false);
      }
    }

    fetchColors();
    return () => { cancelled = true; };
  }, [page, limit, debouncedSearch, brandFilter, refreshKey]);

  const handleSearchChange = useCallback((e) => {
    setSearch(e.target.value);
  }, []);

  const handleBrandChange = useCallback((e) => {
    setBrandFilter(e.target.value);
  }, []);

  const handlePageChange = useCallback((_event, newPage) => {
    setPage(newPage + 1);
    setSelectedIds([]);
  }, []);

  const handleLimitChange = useCallback((event) => {
    setLimit(Number(event.target.value));
    setPage(1);
    setSelectedIds([]);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setDebouncedSearch('');
    setBrandFilter('');
    setPage(1);
  }, []);

  const hasActiveFilters = debouncedSearch !== '' || brandFilter !== '';

  const handleSave = async (form) => {
    try {
      if (editingColor) {
        await colorsApi.update(editingColor.id, form);
        setToast({ severity: 'success', message: 'Color updated.' });
      } else {
        await colorsApi.create(form);
        setToast({ severity: 'success', message: 'Color added to catalog.' });
      }
      setDrawerOpen(false);
      setEditingColor(null);
      triggerRefresh();
    } catch (err) {
      setToast({ severity: err.severity || 'error', message: err.message || 'Failed to save.' });
    }
  };

  const handleToggleActive = async (color) => {
    try {
      await colorsApi.update(color.id, { is_active: !color.isActive });
      triggerRefresh();
    } catch (err) {
      setToast({ severity: err.severity || 'error', message: err.message || 'Failed to update color.' });
    }
  };

  const handleDeleteConfirmed = async () => {
    try {
      if (confirmDelete === 'bulk') {
        await colorsApi.bulkDelete(selectedIds);
        setSelectedIds([]);
        setToast({ severity: 'success', message: `${selectedIds.length} colors deleted.` });
      } else if (confirmDelete) {
        await colorsApi.remove(confirmDelete.id);
        setToast({ severity: 'success', message: 'Color deleted.' });
      }
      setConfirmDelete(null);
      // Go back a page if we deleted the last item on the current page
      const deletedCount = confirmDelete === 'bulk' ? selectedIds.length : 1;
      if (total - deletedCount <= (page - 1) * limit && page > 1) {
        setPage(page - 1);
      }
      triggerRefresh();
    } catch (err) {
      setToast({ severity: err.severity || 'error', message: err.message || 'Failed to delete.' });
      setConfirmDelete(null);
    }
  };

  const handleBulkDeactivate = async () => {
    try {
      await colorsApi.bulkDeactivate(selectedIds);
      setSelectedIds([]);
      setToast({ severity: 'success', message: 'Selected colors deactivated.' });
      triggerRefresh();
    } catch (err) {
      setToast({ severity: err.severity || 'error', message: err.message || 'Failed to deactivate colors.' });
    }
  };

  const handleImported = () => {
    triggerRefresh();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--pv-border)] bg-[var(--pv-surface)] px-8 py-5">
        <div>
          <Typography variant="h5" className="!font-semibold !tracking-tight">Color Catalog</Typography>
          <Typography variant="body2" className="!text-[var(--pv-text-muted)] !mt-0.5">
            Manage the paint colors available across all projects
          </Typography>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outlined"
            startIcon={<FileSpreadsheet size={16} />}
            onClick={() => setImportOpen(true)}
          >
            Import Excel
          </Button>
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => { setEditingColor(null); setDrawerOpen(true); }}
          >
            Add color
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-8 py-4">
        <TextField
          size="small"
          placeholder="Search by name or code…"
          value={search}
          onChange={handleSearchChange}
          className="w-72"
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>,
            },
          }}
        />
        <TextField
          size="small"
          select
          value={brandFilter}
          onChange={handleBrandChange}
          className="w-44"
          label="Brand"
        >
          <MenuItem value="">All brands</MenuItem>
          {brands.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
        </TextField>

        {hasActiveFilters && (
          <Button
            size="small"
            startIcon={<X size={14} />}
            onClick={handleClearFilters}
            className="!text-[var(--pv-text-muted)]"
          >
            Clear filters
          </Button>
        )}

        {selectedIds.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <Typography variant="body2" className="!text-[var(--pv-text-muted)]">
              {selectedIds.length} selected
            </Typography>
            <Button size="small" startIcon={<EyeOff size={14} />} onClick={handleBulkDeactivate}>
              Deactivate
            </Button>
            <Button size="small" color="error" startIcon={<Trash2 size={14} />} onClick={() => setConfirmDelete('bulk')}>
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        <ColorTable
          colors={colors}
          loading={loading}
          selectedIds={selectedIds}
          onToggleSelect={(id) => setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
          onToggleSelectAll={(checked) => setSelectedIds(checked ? colors.map((c) => c.id) : [])}
          onEdit={(color) => { setEditingColor(color); setDrawerOpen(true); }}
          onDelete={(color) => setConfirmDelete(color)}
          onToggleActive={handleToggleActive}
          page={page}
          limit={limit}
          total={total}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
        {!loading && colors.length === 0 && !hasActiveFilters && (
          <div className="mt-6 text-center">
            <Typography variant="body1" className="!text-[var(--pv-text-muted)]">
              Nothing here yet — click "Add color" to build out your catalog.
            </Typography>
          </div>
        )}
        {!loading && colors.length === 0 && hasActiveFilters && (
          <div className="mt-6 text-center">
            <Typography variant="body1" className="!text-[var(--pv-text-muted)]">
              No colors match your current filters.
            </Typography>
            <Button size="small" onClick={handleClearFilters} className="!mt-2" startIcon={<X size={14} />}>
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Drawers & Dialogs */}
      <ColorDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingColor(null); }}
        onSave={handleSave}
        initialColor={editingColor}
      />

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Delete {confirmDelete === 'bulk' ? `${selectedIds.length} colors` : 'this color'}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" className="!text-[var(--pv-text-muted)]">
            This can't be undone. Colors already applied to a surface in a project will be cleared.
          </Typography>
        </DialogContent>
        <DialogActions className="!px-6 !pb-4">
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirmed}>Delete</Button>
        </DialogActions>
      </Dialog>

      <ImportColorsDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleImported}
      />

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
