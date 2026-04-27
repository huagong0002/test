import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'node:crypto';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log('--- Starting EchoMaster Server ---');
  const app = express();
  const PORT = 3000;

  // 0. Trust Proxy for Cloudflare/Load Balancers
  app.set('trust proxy', true);

  // 1. Basic Middlewares
  app.use(cors({
    origin: true, // Reflect the request origin
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
  }));
  app.use(express.json({ limit: '50mb' }));

  // 2. Logger Middleware
  app.use((req, res, next) => {
    const start = Date.now();
    console.log(`[REQ] ${req.method} ${req.url} - Host: ${req.get('host')} - Origin: ${req.get('origin')}`);
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[RES] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  // In-memory Global Store for materials
  let GLOBAL_STORE: any[] = [];
  let USERS: any[] = [
    { id: '1', username: 'admin', password: 'admin123', email: 'admin@e-listen.com', role: 'admin' },
    { id: '2', username: 'tester', password: 'password', email: 'tester@example.com', role: 'user' }
  ];

  // 3. API Routes
  app.get('/ping', (req, res) => res.send('pong'));
  app.get('/api/health', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  const handleLogin = (req, res) => {
    const { username, password } = req.method === 'GET' ? req.query : req.body;
    console.log(`[AUTH] Login target: ${username} (Method: ${req.method})`);
    
    // In strict mode, only allow POST, but keep GET for debug/bypass if needed
    const user = USERS.find(u => u.username === username && u.password === password);
    
    res.set('Cache-Control', 'no-store');
    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      res.json({ success: true, user: userWithoutPassword });
    } else {
      console.warn(`! Invalid login for: ${username}`);
      res.status(401).json({ error: '用户名或密码错误' });
    }
  };

  const handleRegister = (req, res) => {
    const { username, password } = req.body;
    console.log(`[AUTH] Register attempt: ${username}`);
    
    res.set('Cache-Control', 'no-store');
    if (USERS.find(u => u.username === username)) {
      return res.status(400).json({ error: '该用户名已被占用' });
    }
    
    const newUser = { id: randomUUID(), username, password, email: '', role: 'user' };
    USERS.push(newUser);
    const { password: _, ...userWithoutPassword } = newUser;
    res.json({ success: true, user: userWithoutPassword });
  };

  // Support multiple paths and both GET/POST for maximum compatibility with proxy redirects
  const loginPaths = ['/api/login', '/api/login/', '/api/auth/login', '/auth/login', '/login'];
  const registerPaths = ['/api/register', '/api/register/', '/api/auth/register', '/auth/register', '/register'];

  app.all(loginPaths, handleLogin);
  app.all(registerPaths, handleRegister);

  app.get('/debug/host', (req, res) => {
    res.json({
      host: req.get('host'),
      origin: req.get('origin'),
      headers: req.headers,
      env: process.env.NODE_ENV,
      url: req.url
    });
  });

  app.get('/api/materials', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(GLOBAL_STORE);
  });

  app.post('/api/materials/sync', (req, res) => {
    const { materials } = req.body;
    res.set('Cache-Control', 'no-store');
    if (Array.isArray(materials)) {
      materials.forEach(newM => {
        const index = GLOBAL_STORE.findIndex(m => m.id === newM.id);
        if (index !== -1) {
          if (newM.lastModified > GLOBAL_STORE[index].lastModified) {
            GLOBAL_STORE[index] = newM;
          }
        } else {
          GLOBAL_STORE.push(newM);
        }
      });
      GLOBAL_STORE.sort((a, b) => b.lastModified - a.lastModified);
      res.json({ success: true, count: GLOBAL_STORE.length });
    } else {
      res.status(400).json({ error: 'Invalid materials data' });
    }
  });

  app.delete('/api/materials/:id', (req, res) => {
    const { id } = req.params;
    GLOBAL_STORE = GLOBAL_STORE.filter(m => m.id !== id);
    res.json({ success: true });
  });

  app.use('/api/*', (req, res) => {
    console.warn(`[API 404] ${req.method} ${req.originalUrl} - Host: ${req.get('host')} - Origin: ${req.get('origin')}`);
    res.status(404).json({ 
      error: 'API 接口不存在', 
      path: req.originalUrl,
      method: req.method,
      host: req.get('host'),
      suggestion: '请检查 Cloudflare 是否有缓存或 Page Rules 拦截了该路径。'
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
