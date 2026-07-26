import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Checkbox, Chip, IconButton, Paper, Switch, Tooltip, TablePagination,
  Skeleton, Box,
} from '@mui/material';
import { Pencil, Trash2 } from 'lucide-react';

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell padding="checkbox">
        <Skeleton variant="rectangular" width={18} height={18} sx={{ borderRadius: 1 }} />
      </TableCell>
      <TableCell>
        <Skeleton variant="rectangular" width={24} height={24} sx={{ borderRadius: 1 }} />
      </TableCell>
      <TableCell><Skeleton variant="text" width="70%" /></TableCell>
      <TableCell><Skeleton variant="text" width="40%" /></TableCell>
      <TableCell><Skeleton variant="text" width="60%" /></TableCell>
      <TableCell><Skeleton variant="text" width="50%" /></TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Skeleton variant="rectangular" width={32} height={18} sx={{ borderRadius: 10 }} />
          <Skeleton variant="text" width={30} />
        </Box>
      </TableCell>
      <TableCell align="right">
        <Skeleton variant="text" width={50} />
      </TableCell>
    </TableRow>
  );
}

const SKELETON_ROWS = 8;

export default function ColorTable({
  colors, loading, selectedIds, onToggleSelect, onToggleSelectAll,
  onEdit, onDelete, onToggleActive,
  page, limit, total, onPageChange, onLimitChange,
}) {
  const allSelected = colors.length > 0 && selectedIds.length === colors.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  return (
    <Paper variant="outlined" className="!border-[var(--pv-border)] !rounded-xl">
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={(e) => onToggleSelectAll(e.target.checked)}
                  disabled={loading || colors.length === 0}
                />
              </TableCell>
              <TableCell>Swatch</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Brand</TableCell>
              <TableCell>Finish</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && colors.length === 0 && Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <SkeletonRow key={`skel-${i}`} />
            ))}
            {!loading && colors.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="!py-12">
                  <div className="text-center text-sm text-[var(--pv-text-muted)]">
                    No colors found.
                  </div>
                </TableCell>
              </TableRow>
            )}
            {colors.map((color) => (
              <TableRow key={color.id} hover selected={selectedIds.includes(color.id)}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedIds.includes(color.id)}
                    onChange={() => onToggleSelect(color.id)}
                  />
                </TableCell>
                <TableCell>
                  <div
                    className="h-6 w-6 rounded-md border border-black/10"
                    style={{ backgroundColor: color.hex }}
                    title={color.hex}
                  />
                </TableCell>
                <TableCell className="!font-medium">{color.name}</TableCell>
                <TableCell className="!text-[var(--pv-text-muted)]">{color.code}</TableCell>
                <TableCell>{color.brand}</TableCell>
                <TableCell>
                  {color.finish ? <Chip size="small" label={color.finish} variant="outlined" /> : '—'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      size="small"
                      checked={color.isActive}
                      onChange={() => onToggleActive(color)}
                    />
                    <span className="text-xs text-[var(--pv-text-muted)]">
                      {color.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => onEdit(color)}>
                      <Pencil size={15} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => onDelete(color)}>
                      <Trash2 size={15} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {total > 0 && (
        <TablePagination
          component="div"
          count={total}
          page={page - 1}
          rowsPerPage={limit}
          onPageChange={onPageChange}
          onRowsPerPageChange={onLimitChange}
          rowsPerPageOptions={[25, 50, 100]}
        />
      )}
    </Paper>
  );
}
