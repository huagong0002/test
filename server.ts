import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Supabase Initialization
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

let supabase: any = null;

try {
  // Only attempt to initialize if we have both URL and Key, AND the URL looks valid
  // This prevents crashes with placeholders like "https://your-project.supabase.co"
  if (supabaseUrl && 
      supabaseKey && 
      supabaseUrl.startsWith('http') && 
      !supabaseUrl.includes('your-project.supabase.co')) {
    supabase = createClient(supabaseUrl, supabaseKey);
  } else if (supabaseUrl || supabaseKey) {
    console.warn('⚠️ Supabase credentials appear incomplete or use placeholders.');
  }
} catch (error) {
  console.error('❌ Failed to initialize Supabase client:', error);
}

if (!supabase) {
  console.warn('⚠️ Supabase persistence is disabled. Using in-memory fallback.');
}

// 0. Trust Proxy for Cloudflare/Load Balancers
app.set('trust proxy', true);

// 1. Basic Middlewares
// 极致兼容的跨域处理 (支持子域名 Cookie 共享与凭证)
app.use((req, res, next) => {
  const origin = req.get('Origin');
  
  // 允许所有 sd-education.online 的子域名
  const isTrustedOrigin = origin && (
    origin.endsWith('sd-education.online') || 
    origin.includes('localhost')
  );

  if (isTrustedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin, Cookie');
  res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: '50mb' }));

// 2. Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[REQ] ${req.method} ${req.url}`);
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[RES] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// In-memory Fallback (for local dev without supabase)
let LOCAL_STORE: any[] = [];
let LOCAL_USERS: any[] = [
  { id: '1', username: 'admin', password: 'admin123', email: 'admin@e-listen.com', role: 'admin' },
  { id: '2', username: 'tester', password: 'password', email: 'tester@example.com', role: 'user' }
];

// 3. API Routes
app.get('/ping', (req, res) => res.send('pong'));
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    supabaseConnected: !!supabase,
    env: process.env.NODE_ENV,
    serverTime: new Date().toISOString() 
  });
});

app.get('/debug/host', (req, res) => {
  res.json({
    host: req.get('host'),
    origin: req.get('origin'),
    headers: req.headers,
    env: process.env.NODE_ENV,
    url: req.url
  });
});

const handleLogin = async (req, res) => {
  const { username, password } = req.method === 'GET' ? req.query : req.body;
  
  if (supabase) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (data) {
      const { password: _, ...userWithoutPassword } = data as any;
      return res.json({ success: true, user: userWithoutPassword });
    }
  } else {
    const user = LOCAL_USERS.find(u => u.username === username && u.password === password);
    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ success: true, user: userWithoutPassword });
    }
  }
  
  res.status(401).json({ error: '用户名或密码错误' });
};

const handleRegister = async (req, res) => {
  const { username, password } = req.body;
  
  if (supabase) {
    const { data: existing } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .single();

    if (existing) {
      return res.status(400).json({ error: '该用户名已被占用' });
    }

    const { data, error } = await supabase
      .from('users')
      .insert([{ id: randomUUID(), username, password, email: '', role: 'user' }])
      .select()
      .single();

    if (data) {
      const { password: _, ...userWithoutPassword } = data as any;
      return res.json({ success: true, user: userWithoutPassword });
    }
  } else {
    if (LOCAL_USERS.find(u => u.username === username)) {
      return res.status(400).json({ error: '该用户名已被占用' });
    }
    const newUser = { id: randomUUID(), username, password, email: '', role: 'user' };
    LOCAL_USERS.push(newUser);
    const { password: _, ...userWithoutPassword } = newUser;
    return res.json({ success: true, user: userWithoutPassword });
  }
  
  res.status(500).json({ error: '注册失败' });
};

app.all(['/api/login', '/login'], handleLogin);
app.all(['/api/register', '/register'], handleRegister);

app.get('/api/materials', async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('lastModified', { ascending: false });
    return res.json(data || []);
  }
  res.json(LOCAL_STORE);
});

app.post('/api/materials/sync', async (req, res) => {
  const { materials } = req.body;
  if (!Array.isArray(materials)) {
    return res.status(400).json({ error: 'Invalid materials data' });
  }

  if (supabase) {
    // Upsert materials one by one or in batch
    // To keep it simple and robust, we use upsert
    const { error } = await supabase
      .from('materials')
      .upsert(materials.map(m => ({
        id: m.id,
        title: m.title,
        audioUrl: m.audioUrl,
        script: m.script,
        segments: m.segments,
        lastModified: m.lastModified
      })));

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, count: materials.length });
  } else {
    materials.forEach(newM => {
      const index = LOCAL_STORE.findIndex(m => m.id === newM.id);
      if (index !== -1) {
        if (newM.lastModified > LOCAL_STORE[index].lastModified) {
          LOCAL_STORE[index] = newM;
        }
      } else {
        LOCAL_STORE.push(newM);
      }
    });
    LOCAL_STORE.sort((a, b) => b.lastModified - a.lastModified);
    res.json({ success: true, count: LOCAL_STORE.length });
  }
});

app.delete('/api/materials/:id', async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    await supabase.from('materials').delete().eq('id', id);
  } else {
    LOCAL_STORE = LOCAL_STORE.filter(m => m.id !== id);
  }
  res.json({ success: true });
});

// API 404 handler - MUST be before the Vite/Static fallback
app.all('/api/*', (req, res) => {
  console.warn(`[API 404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'API 接口不存在', 
    method: req.method,
    path: req.originalUrl 
  });
});

// Vite middleware for development
async function setupVite() {
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
}

// Initializing the server environment
setupVite().catch(err => {
  console.error('Failed to setup Vite:', err);
});

// Export for Vercel
export default app;

// Listen only if not in Vercel or if explicitly told
const shouldListen = process.env.NODE_ENV !== 'production' || process.env.RENDER || process.env.K_SERVICE || process.env.PORT;
if (shouldListen) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

