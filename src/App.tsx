// 🚩 核心修正 1：将 API_BASE 设置为 "/api"，确保在 Vercel 环境下能正确路由到后端函数
const API_BASE = "/api"; 

import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Settings2, 
  BookOpen, 
  Clock, 
  Plus, 
  Trash2, 
  Download, 
  Upload,
  FastForward,
  Rewind,
  CheckCircle2,
  ListMusic,
  ArrowRight,
  Save,
  Library,
  Folder,
  FileAudio,
  Calendar,
  ChevronRight,
  User,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- 类型定义 ---
export interface AudioSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  isCompleted?: boolean;
}

export interface ListeningMaterial {
  id: string;
  title: string;
  audioUrl: string | null;
  script: string;
  segments: AudioSegment[];
  lastModified: number;
}

// Tailwind 类名合并工具
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  // --- 核心状态 ---
  const [user, setUser] = useState<{ username: string; role: string; displayName: string } | null>(null);
  const [authForm, setAuthForm] = useState<'login' | 'register'>('login');
  const [authData, setAuthData] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [mode, setMode] = useState<'library' | 'setup' | 'edit' | 'train'>('library');
  const [materials, setMaterials] = useState<ListeningMaterial[]>([]);
  const [currentMaterialId, setCurrentMaterialId] = useState<string | null>(null);
  const [material, setMaterial] = useState<ListeningMaterial>({
    id: crypto.randomUUID(),
    title: '未命名听力材料',
    audioUrl: null,
    script: '',
    segments: [],
    lastModified: Date.now(),
  });

  // --- 音频播放状态 ---
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // --- 初始化：从后端拉取数据 ---
  useEffect(() => {
    // 检查本地登录状态
    const savedUser = localStorage.getItem('echomaster_user');
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch (e) {}
    }

    const fetchLibrary = async () => {
      try {
        const response = await fetch(`${API_BASE}/materials`);
        if (response.ok) {
          const data = await response.json();
          setMaterials(data);
        }
      } catch (e) {
        console.error("加载库失败", e);
      }
    };
    fetchLibrary();
  }, []);

  // --- 登录/注册逻辑 ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authData)
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setUser(data.user);
        localStorage.setItem('echomaster_user', JSON.stringify(data.user));
      } else {
        setAuthError(data.message || '登录失败');
      }
    } catch (err) {
      setAuthError("服务器连接失败，请检查后端服务");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('echomaster_user');
    setMode('library');
  };

  // --- 数据同步逻辑 (自动保存) ---
  useEffect(() => {
    if (!user) return;
    const sync = async () => {
      try {
        await fetch(`${API_BASE}/materials/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ materials })
        });
      } catch (e) {}
    };
    const timer = setTimeout(sync, 3000);
    return () => clearTimeout(timer);
  }, [materials, user]);

  // --- UI 渲染 ---
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setMode('library')}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Play className="text-white w-4 h-4 fill-current" />
            </div>
            <span className="font-bold text-xl tracking-tight">EchoMaster</span>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3 bg-slate-100 px-3 py-1.5 rounded-full">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <span className="text-sm font-medium">{user.username}</span>
                <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-red-500 transition-colors">退出</button>
              </div>
            ) : (
              <span className="text-sm text-slate-400">访客模式</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {!user ? (
          /* 登录表单界面 */
          <div className="max-w-md mx-auto pt-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-[32px] shadow-xl border border-slate-100 space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">欢迎回来</h2>
                <p className="text-slate-500 text-sm">请输入您的凭据以访问听力训练库</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1">用户名</label>
                  <div className="relative">
                    <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      required
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                      placeholder="admin / jerry / test01"
                      value={authData.username}
                      onChange={e => setAuthData({...authData, username: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1">密码</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                    <input 
                      type="password" 
                      required
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                      placeholder="••••••••"
                      value={authData.password}
                      onChange={e => setAuthData({...authData, password: e.target.value})}
                    />
                  </div>
                </div>

                {authError && (
                  <div className="p-3 bg-red-50 text-red-500 text-xs rounded-xl flex items-center gap-2">
                    <span className="w-1 h-1 bg-red-500 rounded-full" />
                    {authError}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                >
                  {isLoading ? "验证中..." : "立即登录"}
                </button>
              </form>
            </motion.div>
          </div>
        ) : (
          /* 主功能界面 (Library/Train等) */
          <AnimatePresence mode="wait">
            {mode === 'library' && (
              <motion.div 
                key="library"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <h1 className="text-3xl font-bold tracking-tight">我的资源库</h1>
                  <button 
                    onClick={() => setMode('setup')}
                    className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Plus className="w-4 h-4" /> 添加新听力
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {materials.map(m => (
                    <div 
                      key={m.id}
                      onClick={() => { setCurrentMaterialId(m.id); setMode('train'); }}
                      className="group bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer relative"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                          <FileAudio className="text-blue-600 w-5 h-5" />
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setMaterials(prev => prev.filter(x => x.id !== m.id)); }}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <h3 className="font-bold text-lg mb-1 line-clamp-1">{m.title}</h3>
                      <div className="flex items-center gap-3 text-slate-400 text-xs">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {m.segments.length} 段落</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(m.lastModified).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            
            {/* 训练模式、编辑模式等逻辑在此处扩展... */}
            {mode === 'setup' && (
              <div className="text-center py-20">
                <h2 className="text-xl font-bold mb-4">准备开始新的训练</h2>
                <button onClick={() => setMode('library')} className="text-blue-600">返回库</button>
              </div>
            )}
          </AnimatePresence>
        )}
      </main>

      <audio ref={audioRef} src={material.audioUrl || undefined} />
    </div>
  );
}
