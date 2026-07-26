const XLSX = require('xlsx');
const pool = require('../lib/db');
const { ApiError } = require('../middleware/errorHandler');

const REQUIRED_HEADERS = [
  'colorCode', 'colorName',
  'tenprotect', 'brightshine', 'colorfuleco',
  'jotashield', 'majestic', 'sevenprotect', 'surprised',
  'rValue', 'gValue', 'bValue',
];

const PRODUCT_FLAG_KEYS = [
  'tenprotect', 'brightshine', 'colorfuleco',
  'jotashield', 'majestic', 'sevenprotect', 'surprised',
];

function normalizeHeader(h) {
  return String(h || '').trim();
}

function normalizeString(v) {
  if (v == null) return '';
  return String(v).trim();
}

function parseProductFlag(value, fieldName, rowNum) {
  if (value == null || value === '') return false;
  const n = Number(value);
  if (n === 1 || n === 0) return Boolean(n);
  const s = String(value).trim().toLowerCase();
  if (s === 'true' || s === 'yes') return true;
  if (s === 'false' || s === 'no') return false;
  return { row: rowNum, field: fieldName, message: `Row ${rowNum}: ${fieldName} must be 0 or 1.` };
}

function parseRgb(value, fieldName, rowNum) {
  if (value == null || value === '') {
    return { row: rowNum, field: fieldName, message: `Row ${rowNum}: ${fieldName} is required.` };
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 255) {
    return { row: rowNum, field: fieldName, message: `Row ${rowNum}: ${fieldName} must be between 0 and 255.` };
  }
  return { value: n };
}

function rgbToHex(r, g, b) {
  const toHex = (v) => v.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

async function importColors(fileBuffer, brand) {
  const errors = [];
  const validRows = [];

  // Parse workbook
  let workbook;
  try {
    workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  } catch (err) {
    throw new ApiError(400, 'Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.', 'VALIDATION_ERROR');
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new ApiError(400, 'Excel file contains no sheets.', 'VALIDATION_ERROR');
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  if (rows.length === 0) {
    throw new ApiError(400, 'Excel file contains no data rows.', 'VALIDATION_ERROR');
  }

  // Validate headers
  const firstRow = rows[0];
  const headers = Object.keys(firstRow).map(normalizeHeader);
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    const missing = missingHeaders.map((h) => `'${h}'`).join(', ');
    throw new ApiError(400, `Import failed: The Excel file is missing the required column${missingHeaders.length > 1 ? 's' : ''} ${missing}.`, 'VALIDATION_ERROR');
  }

  // Validate and transform each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const rowErrors = [];

    const colorCode = normalizeString(row.colorCode);
    const colorName = normalizeString(row.colorName);

    if (!colorCode) {
      rowErrors.push({ row: rowNum, field: 'colorCode', message: `Row ${rowNum}: colorCode is required.` });
    }
    if (!colorName) {
      rowErrors.push({ row: rowNum, field: 'colorName', message: `Row ${rowNum}: colorName is required.` });
    }

    // Parse product flags
    const productFlags = {};
    for (const key of PRODUCT_FLAG_KEYS) {
      const result = parseProductFlag(row[key], key, rowNum);
      if (result && result.row) {
        rowErrors.push(result);
      } else {
        productFlags[key] = result;
      }
    }

    // Parse RGB
    const rResult = parseRgb(row.rValue, 'rValue', rowNum);
    const gResult = parseRgb(row.gValue, 'gValue', rowNum);
    const bResult = parseRgb(row.bValue, 'bValue', rowNum);

    if (rResult.row) rowErrors.push(rResult);
    if (gResult.row) rowErrors.push(gResult);
    if (bResult.row) rowErrors.push(bResult);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    const hex = rgbToHex(rResult.value, gResult.value, bResult.value);

    validRows.push({
      name: colorName,
      code: colorCode,
      hex,
      brand,
      productFlags,
    });
  }

  // If all rows have errors, return early
  if (validRows.length === 0) {
    return {
      success: false,
      totalRows: rows.length,
      inserted: 0,
      skipped: 0,
      failed: rows.length,
      errors,
    };
  }

  // Fetch existing (brand, code) pairs to detect duplicates
  const codes = validRows.map((r) => r.code);
  const [existing] = await pool.execute(
    'SELECT code FROM colors WHERE brand = ? AND code IN (?)',
    [brand, codes],
  );
  const existingCodes = new Set(existing.map((c) => c.code));

  const toInsert = [];
  let skipped = 0;

  for (const row of validRows) {
    if (existingCodes.has(row.code)) {
      skipped++;
      errors.push({
        row: null,
        field: 'colorCode',
        message: `Duplicate: color code "${row.code}" already exists for brand "${brand}". Skipped.`,
      });
    } else {
      toInsert.push(row);
    }
  }

  // Bulk insert in batches to handle large imports
  let inserted = 0;
  const BATCH_SIZE = 500;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const sql = `INSERT INTO colors (name, code, hex, brand, product_flags) VALUES ${placeholders}`;
    const values = batch.flatMap((r) => [
      r.name,
      r.code,
      r.hex,
      r.brand,
      JSON.stringify(r.productFlags),
    ]);
    const [result] = await pool.execute(sql, values);
    inserted += result.affectedRows;
  }

  return {
    success: errors.length === 0,
    totalRows: rows.length,
    inserted,
    skipped,
    failed: rows.length - inserted - skipped,
    errors,
  };
}

module.exports = { importColors };
