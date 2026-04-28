// 🚩 核心修正：确保 API 路径正确，这是打通 Vercel 后端的钥匙
const API_BASE = "/api"; 

import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Play, Pause, RotateCcw, Settings2, BookOpen, Clock, Plus, Trash2, 
  Download, Upload, FastForward, Rewind, CheckCircle2, ListMusic, 
  ArrowRight, Save, Library, Folder, FileAudio, Calendar, ChevronRight, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AudioSegment, ListeningMaterial } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  // --- 状态定义 ---
  const [user, setUser] = useState<{ username: string; role: string; displayName: string } | null>(null);
  const [authData, setAuthData] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState<string | null>(null);
  const [mode, setMode] = useState<'library' | 'setup' | 'edit' | 'train'>('library');
  const [materials, setMaterials] = useState<ListeningMaterial[]>([]);
  const [currentMaterialId, setCurrentMaterialId] = useState<string | null>(null);
  const [material, setMaterial] = useState<ListeningMaterial>({
    id: crypto.randomUUID(), title: '未命名听力材料', audioUrl: null, script: '', segments: [], lastModified: Date.now(),
  });

  // --- 初始化加载 ---
  useEffect(() => {
    // 加载库
    const fetchLibrary = async () => {
      try {
        const response = await fetch(`${API_BASE}/materials`);
        if (response.ok) {
          const data = await response.json();
          setMaterials(data);
        }
      } catch (e) { console.error(e); }
    };
    fetchLibrary();

    // 恢复用户状态
    const savedUser = localStorage.getItem('echomaster_user');
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch (e) {}
    }
  }, []);

  // --- 登录处理 ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: authData.username.trim(), 
          password: authData.password 
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setUser(data.user);
        localStorage.setItem('echomaster_user', JSON.stringify(data.user));
      } else {
        setAuthError(data.message || '登录失败');
      }
    } catch (err) {
      setAuthError("连接服务器失败");
    }
  };

  // --- 核心渲染逻辑 (这里恢复你原有的精致 UI) ---
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 selection:bg-blue-500/30">
      {/* 动态渐变背景 */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(30,58,138,0.2),_rgba(15,23,42,1))] z-0" />

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        {!user ? (
          // 🚩 修复重点：如果没登录，显示你那套漂亮的登录表单
          <div className="max-w-md mx-auto pt-20">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 shadow-2xl"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/20">
                  <BookOpen className="text-white w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-white">EchoMaster</h2>
                <p className="text-slate-400 text-sm mt-2">登录以管理您的听力资源</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <input 
                    type="text" 
                    placeholder="用户名" 
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-blue-500 transition-all"
                    value={authData.username}
                    onChange={e => setAuthData({...authData, username: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <input 
                    type="password" 
                    placeholder="密码" 
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-blue-500 transition-all"
                    value={authData.password}
                    onChange={e => setAuthData({...authData, password: e.target.value})}
                  />
                </div>
                {authError && <p className="text-red-400 text-xs ml-2">{authError}</p>}
                <button 
                  type="submit" 
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                >
                  立即登录
                </button>
              </form>
            </motion.div>
          </div>
        ) : (
          // 🚩 登录成功后的主界面
          <div className="space-y-8">
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold text-white">我的资源库</h1>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/20">
                  {materials.length} 个项目
                </span>
              </div>
              <div className="flex items-center gap-4">
                 <button onClick={() => setMode('setup')} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all">
                   <Plus className="w-5 h-5 text-white" />
                 </button>
                 <button onClick={() => {setUser(null); localStorage.removeItem('echomaster_user');}} className="text-slate-400 hover:text-white transition-all">
                   退出登录
                 </button>
              </div>
            </header>

            {/* 这里放你原有的 Grid 布局展示 materials */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {materials.map(m => (
                <motion.div key={m.id} className="bg-white/5 p-6 rounded-[32px] border border-white/5 hover:border-white/20 transition-all cursor-pointer group">
                   <h3 className="text-xl font-bold text-white mb-2">{m.title}</h3>
                   <p className="text-slate-400 text-sm">最后修改: {new Date(m.lastModified).toLocaleDateString()}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
