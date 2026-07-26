import { useState, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, LinearProgress, Box,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Chip, Alert, AlertTitle,
} from '@mui/material';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { colorsApi } from '../../api/colors';

function formatImportError(err) {
  if (!err) return { title: 'Import Failed', message: 'Import failed. Please try again.', retryable: false };

  const code = err.code || 'UNKNOWN_ERROR';

  if (code === 'DATABASE_UNAVAILABLE') {
    return {
      title: 'Database Unavailable',
      message: 'We couldn\'t complete the import because the database is temporarily unavailable. No colors were imported. Please try again shortly.',
      retryable: true,
    };
  }

  if (code === 'VALIDATION_ERROR') {
    return {
      title: 'Invalid Excel File',
      message: err.message || 'The Excel file could not be processed.',
      retryable: false,
    };
  }

  if (code === 'NETWORK_ERROR') {
    return {
      title: 'Connection Error',
      message: 'Unable to reach the server. Please check your connection and try again.',
      retryable: true,
    };
  }

  return {
    title: 'Import Failed',
    message: err.message || 'Something went wrong while processing your request. Please try again.',
    retryable: err.retryable || false,
  };
}

export default function ImportColorsDialog({ open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [brand, setBrand] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);

  const reset = () => {
    setFile(null);
    setBrand('');
    setResult(null);
    setImportError(null);
    setProgress(0);
  };

  const handleClose = () => {
    if (uploading) return;
    reset();
    onClose();
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setResult(null);
      setImportError(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      setFile(dropped);
      setResult(null);
      setImportError(null);
    }
  };

  const handleImport = async () => {
    if (!file || !brand.trim()) return;
    setUploading(true);
    setProgress(0);
    setImportError(null);
    setResult(null);
    try {
      setProgress(30);
      const res = await colorsApi.importColors(file, brand.trim());
      setProgress(100);
      setResult(res);
      if (res.inserted > 0) {
        onImported();
      }
    } catch (err) {
      setImportError(formatImportError(err));
    } finally {
      setUploading(false);
    }
  };

  const handleRetry = () => {
    handleImport();
  };

  const hasResult = result !== null;
  const hasError = importError !== null;
  const canImport = file && brand.trim() && !uploading;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FileSpreadsheet size={22} />
        Import Colors from Excel
      </DialogTitle>
      <DialogContent dividers>
        {!hasResult && !hasError && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            <TextField
              label="Brand Name"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Jotun, Nippon, Dulux"
              required
              size="small"
              disabled={uploading}
              sx={{ maxWidth: 320 }}
            />

            <Box
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                border: '2px dashed',
                borderColor: file ? 'primary.main' : 'grey.300',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: file ? 'primary.50' : 'grey.50',
                transition: 'all 0.2s',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              {file ? (
                <>
                  <FileSpreadsheet size={32} color="#6d28d9" />
                  <Typography sx={{ mt: 1, fontWeight: 500 }}>{file.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {(file.size / 1024).toFixed(1)} KB
                  </Typography>
                </>
              ) : (
                <>
                  <Upload size={32} color="#a1a1aa" />
                  <Typography sx={{ mt: 1, fontWeight: 500 }}>
                    Drop an Excel file here or click to browse
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Supports .xlsx and .xls formats
                  </Typography>
                </>
              )}
            </Box>

            {uploading && (
              <Box>
                <LinearProgress variant="determinate" value={progress} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Processing file...
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {hasError && !hasResult && (
          <Box sx={{ pt: 1 }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              <AlertTitle>{importError.title}</AlertTitle>
              {importError.message}
            </Alert>
          </Box>
        )}

        {hasResult && (
          <Box sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <Chip
                label={`Total: ${result.totalRows}`}
                color="default"
                variant="outlined"
              />
              <Chip
                label={`Imported: ${result.inserted}`}
                color="success"
                icon={<CheckCircle size={16} />}
              />
              {result.skipped > 0 && (
                <Chip
                  label={`Skipped: ${result.skipped}`}
                  color="warning"
                  icon={<AlertTriangle size={16} />}
                />
              )}
              {result.failed > 0 && (
                <Chip
                  label={`Failed: ${result.failed}`}
                  color="error"
                />
              )}
            </Box>

            {result.errors.length > 0 && (
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Row</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Field</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Error</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.errors.map((err, i) => (
                      <TableRow key={i}>
                        <TableCell>{err.row || '-'}</TableCell>
                        <TableCell>{err.field}</TableCell>
                        <TableCell>{err.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          {hasResult ? 'Close' : 'Cancel'}
        </Button>
        {hasError && importError.retryable && (
          <Button
            variant="contained"
            onClick={handleRetry}
            disabled={!canImport}
            startIcon={<RefreshCw size={16} />}
          >
            Try Again
          </Button>
        )}
        {!hasResult && !hasError && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={!canImport}
          >
            {uploading ? 'Importing...' : 'Import'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
