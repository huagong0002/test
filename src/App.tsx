// 🚩 核心修正：在 Vercel 中，使用 "/api" 相对路径是解决 404 和跨域问题的终极方案
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
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
// 注意：如果你的项目里没有单独的 types.ts 文件，请确保下方定义了这些接口
import { AudioSegment, ListeningMaterial } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  // --- 状态定义（保持原样） ---
  const [user, setUser] = useState<{ username: string; role: string; displayName: string } | null>(null);
  const [authForm, setAuthForm] = useState<'login' | 'register'>('login');
  const [authData, setAuthData] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState<string | null>(null);

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

  // --- 核心修复：登录逻辑 ---
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
      setAuthError("无法连接到后端服务，请检查网络");
    }
  };

  // --- 核心修复：初始化加载 ---
  useEffect(() => {
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

    const savedUser = localStorage.getItem('echomaster_user');
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch (e) {}
    }
  }, []);

  // --- 自动同步逻辑 ---
  useEffect(() => {
    if (!user || materials.length === 0) return;
    const sync = async () => {
      try {
        await fetch(`${API_BASE}/materials/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ materials })
        });
      } catch (e) {}
    };
    const timer = setTimeout(sync, 2000);
    return () => clearTimeout(timer);
  }, [materials, user]);

  // --- 此处继续你原有的 UI 渲染代码 (return 部分) ---
  // 刚才你提供的部分只到 import，请直接将你原有的漂亮 return 代码接在下面即可
  // 记得确保 handleLogin 被绑定到了登录按钮上
  
  return (
    <div className="min-h-screen font-sans">
        {/* 请在此处粘贴你原有的 return 模块代码 */}
        {/* 只要上面的 API_BASE 和 handleLogin 逻辑是对的，UI 就会完美恢复且可以登录 */}
    </div>
  );
}
