import { useEffect, useState } from 'react';
import {
  Drawer, Box, Typography, TextField, MenuItem, Button, IconButton, Divider, InputAdornment,
} from '@mui/material';
import { X } from 'lucide-react';

const FINISHES = ['Matte', 'Eggshell', 'Satin', 'Semi-Gloss', 'Gloss'];

const emptyForm = { name: '', code: '', hex: '#FFFFFF', brand: '', finish: '' };

export default function ColorDrawer({ open, onClose, onSave, initialColor }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        initialColor
          ? {
              name: initialColor.name,
              code: initialColor.code,
              hex: initialColor.hex,
              brand: initialColor.brand,
              finish: initialColor.finish || '',
            }
          : emptyForm
      );
      setError(null);
    }
  }, [open, initialColor]);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box className="flex h-full w-[380px] flex-col">
        <div className="flex items-center justify-between px-5 py-4">
          <Typography variant="h6" className="!font-semibold !text-[17px]">
            {initialColor ? 'Edit color' : 'Add color'}
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <Divider />
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <TextField
            label="Color name"
            placeholder="e.g. Coastal Fog"
            value={form.name}
            onChange={handleChange('name')}
            required
            fullWidth
            size="small"
          />
          <TextField
            label="Color code"
            placeholder="e.g. CF-204"
            value={form.code}
            onChange={handleChange('code')}
            required
            fullWidth
            size="small"
          />
          <TextField
            label="Hex value"
            placeholder="#A3B1C6"
            value={form.hex}
            onChange={handleChange('hex')}
            required
            fullWidth
            size="small"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <div
                      className="h-5 w-5 rounded border border-black/10"
                      style={{ backgroundColor: /^#?[0-9A-Fa-f]{6}$/.test(form.hex) ? form.hex : '#fff' }}
                    />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            label="Brand"
            placeholder="e.g. Dulux"
            value={form.brand}
            onChange={handleChange('brand')}
            required
            fullWidth
            size="small"
          />
          <TextField
            label="Finish"
            value={form.finish}
            onChange={handleChange('finish')}
            select
            fullWidth
            size="small"
          >
            <MenuItem value="">No finish specified</MenuItem>
            {FINISHES.map((f) => (
              <MenuItem key={f} value={f}>{f}</MenuItem>
            ))}
          </TextField>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="mt-auto flex gap-2 pt-4">
            <Button variant="outlined" fullWidth onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="contained" fullWidth type="submit" disabled={saving}>
              {saving ? 'Saving…' : initialColor ? 'Save changes' : 'Add color'}
            </Button>
          </div>
        </form>
      </Box>
    </Drawer>
  );
}
