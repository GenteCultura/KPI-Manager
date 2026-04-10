import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase config and set env vars BEFORE importing firebase-admin
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = { projectId: '' };

try {
  if (fs.existsSync(firebaseConfigPath)) {
    const content = fs.readFileSync(firebaseConfigPath, 'utf-8');
    firebaseConfig = JSON.parse(content);
    console.log('PRE-LOAD: Successfully loaded config. Project ID:', firebaseConfig.projectId);
    
    if (firebaseConfig.projectId) {
      // These must be set before firebase-admin is loaded to override default project detection
      process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
      process.env.GCLOUD_PROJECT = firebaseConfig.projectId;
      console.log('PRE-LOAD: Set GOOGLE_CLOUD_PROJECT to:', process.env.GOOGLE_CLOUD_PROJECT);
    }
  }
} catch (err) {
  console.error('PRE-LOAD: Error loading config file:', err);
}

// Dynamic imports to ensure env vars are set first
const { default: express } = await import('express');
const { createServer: createViteServer } = await import('vite');
const { default: admin } = await import('firebase-admin');

// Initialize Firebase Admin
async function initAdmin() {
  try {
    const projectId = firebaseConfig.projectId || process.env.GOOGLE_CLOUD_PROJECT;
    console.log('Initializing Firebase Admin. Target Project ID:', projectId);
    
    if (admin.apps.length > 0) {
      console.log('Cleaning up existing Firebase apps...');
      await Promise.all(admin.apps.map(app => app?.delete()));
    }

    admin.initializeApp({
      projectId: projectId,
    });
    
    const initializedProject = admin.app().options.projectId;
    console.log('Firebase Admin initialized. Active Project ID:', initializedProject);
    
    if (initializedProject !== projectId) {
      console.warn('WARNING: Initialized Project ID mismatch! Expected:', projectId, 'Got:', initializedProject);
    }
  } catch (error) {
    console.error('CRITICAL: Error initializing Firebase Admin:', error);
  }
}

async function startServer() {
  await initAdmin();
  
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  // Note: Server-side password updates are disabled in this preview environment 
  // due to cross-project permission restrictions (403 Forbidden).
  // We use client-side password reset emails instead for existing users.

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      project: admin.app().options.projectId,
      configProject: firebaseConfig.projectId,
      envProject: process.env.GOOGLE_CLOUD_PROJECT
    });
  });

  // Global error handler to prevent HTML responses
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Unhandled Express Error:', err);
    res.status(500).json({ 
      error: 'Erro interno no servidor.',
      details: err.message || String(err)
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
