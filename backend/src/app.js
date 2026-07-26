require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { notFound, errorHandler } = require('./middleware/errorHandler');
const { UPLOAD_DIR } = require('./middleware/upload');

const colorsRoutes = require('./routes/colors.routes');
const projectsRoutes = require('./routes/projects.routes');
const photosRoutes = require('./routes/photos.routes');
const surfacesRoutes = require('./routes/surfaces.routes');
const visualizationsRoutes = require('./routes/visualizations.routes');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Serve uploaded photos statically
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

app.get('/api/health', (req, res) => res.json({ data: { status: 'ok' }, error: null }));

app.use('/api/colors', colorsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/surfaces', surfacesRoutes);
app.use('/api/visualizations', visualizationsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
