import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import CatalogPage from './pages/CatalogPage';
import ProjectsPage from './pages/ProjectsPage';
import VisualizerPage from './pages/VisualizerPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
      </Route>
      {/* Visualizer is a full-bleed workspace, outside the sidebar shell */}
      <Route path="/projects/:projectId" element={<VisualizerPage />} />
    </Routes>
  );
}
