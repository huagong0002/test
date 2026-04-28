// 🚩 核心修正：将 API_BASE 设置为 "/api"，以匹配 Vercel 的原生 API 路由
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
import { AudioSegment, ListeningMaterial } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<{ username: string; email: string; role: string } | null>(null);
  const [authForm, setAuthForm] = useState<'login' | 'register'>('login');
  const [authData, setAuthData] = useState({ username: '', password: '', email: '' });
  const [authError, setAuthError] = useState<string | null>(null);

  const [mode, setMode] = useState<'library' | 'setup' | 'edit' | 'train'>('library');
  const [currentMaterialId, setCurrentMaterialId] = useState<string | null>(null);
  const [materials, setMaterials] = useState<ListeningMaterial[]>([]);
  const [material, setMaterial] = useState<ListeningMaterial>({
    id: crypto.randomUUID(),
    title: '未命名听力材料',
    audioUrl: null,
    script: '',
    segments: [],
    lastModified: Date.now(),
  });

  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Persistence: Load library from backend on mount
  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const response = await fetch(`${API_BASE}/materials`);
        if (response.ok) {
          const data = await response.json();
          setMaterials(data);
        }
      } catch (e: any) {
        console.error("Backend Library Load Error", e);
        // Fallback to localStorage if backend fails
        const savedLibrary = localStorage.getItem('echomaster_library');
        if (savedLibrary) setMaterials(JSON.parse(savedLibrary));
      }
    };
    
    fetchLibrary();
    
    const savedId = localStorage.getItem('echomaster_current_id');
    if (savedId) setCurrentMaterialId(savedId);
  }, []);

  // Update effect for material selection
  useEffect(() => {
    if (currentMaterialId) {
      const active = materials.find(m => m.id === currentMaterialId);
      if (active) setMaterial(active);
      localStorage.setItem('echomaster_current_id', currentMaterialId);
    }
  }, [currentMaterialId, materials]);

  // Persistence: Sync library to backend
  useEffect(() => {
    const syncToBackend = async () => {
      if (materials.length > 0) {
        try {
          await fetch(`${API_BASE}/materials/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ materials })
          });
          localStorage.setItem('echomaster_library', JSON.stringify(materials));
        } catch (e: any) {
          console.error("Backend Sync Error", e);
        }
      }
    };
    
    const timer = setTimeout(syncToBackend, 2000);
    return () => clearTimeout(timer);
  }, [materials]);

  // Sync current material changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setMaterials(prev => prev.map(m => m.id === material.id ? { ...material, lastModified: Date.now() } : m));
      setLastSaved(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearTimeout(timer);
  }, [material]);

  const selectMaterial = (id: string) => {
    setCurrentMaterialId(id);
    setMode('train');
  };

  const createNewMaterial = () => {
    const newMaterial: ListeningMaterial = {
      id: crypto.randomUUID(),
      title: `新听力材料 ${materials.length + 1}`,
      audioUrl: null,
      script: '',
      segments: [],
      lastModified: Date.now(),
    };
    setMaterials(prev => [newMaterial, ...prev]);
    setCurrentMaterialId(newMaterial.id);
    setMode('setup');
  };

  const deleteMaterial = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个听力任务吗？')) {
      try {
        await fetch(`${API_BASE}/materials/${id}`, { method: 'DELETE' });
        setMaterials(prev => prev.filter(m => m.id !== id));
        if (currentMaterialId === id) setCurrentMaterialId(null);
      } catch (e) {
        console.error("Delete Error", e);
      }
    }
  };

  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Authentication Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const timestamp = Date.now();
    const apiUrl = `${API_BASE}/login?t=${timestamp}`;
    
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          username: authData.username.trim(), 
          password: authData.password 
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        localStorage.setItem('echomaster_user', JSON.stringify(data.user));
      } else {
        setAuthError(data.message || '登录失败');
      }
    } catch (err: any) {
      setAuthError(`网络连接失败: Failed to fetch。 地址: ${window.location.origin}${API_BASE}/login`);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: authData.username.trim(), 
          password: authData.password 
        })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        localStorage.setItem('echomaster_user', JSON.stringify(data.user));
      } else {
        setAuthError(data.message || '注册失败');
      }
    } catch (err: any) {
      setAuthError("注册失败：无法连接服务器");
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('echomaster_user');
  };

  useEffect(() => {
    const checkServer = async () => {
      try {
        await fetch(`${API_BASE}/health`);
      } catch (e) {}
    };
    checkServer();

    const savedUser = localStorage.getItem('echomaster_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {}
    }
  }, []);

  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [syncScroll, setSyncScroll] = useState(true);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setMaterial(prev => ({ ...prev, audioUrl: url }));
      if (mode === 'setup') setMode('edit');
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime += seconds;
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (mode === 'train') {
        const currentIdx = material.segments.findIndex(
          seg => audio.currentTime >= seg.startTime && audio.currentTime < seg.endTime
        );
        if (currentIdx !== activeSegmentIndex) {
          setActiveSegmentIndex(currentIdx === -1 ? null : currentIdx);
        }
      }
    };
    const handleLoadedMetadata = () => setDuration(audio.duration);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [material.segments, mode, activeSegmentIndex]);

  // 渲染逻辑维持原样...
  // (由于篇幅原因，以下 UI 渲染代码部分与原版保持一致，仅确保 API 调用路径正确)

  return (
    <div className="min-h-screen font-sans selection:bg-blue-500/30 selection:text-white">
      {/* Header, Login Form, and Main Content UI - 保持您原有的精致样式即可 */}
      {/* 确保所有 fetch 调用都使用的是修改后的路径逻辑 */}
      
      {/* 此处省略原有的大量 UI 渲染代码，请合并您原文件中的 return 部分 */}
      {/* 只需确保您使用的是这个带有 const API_BASE = "/api" 的文件开头即可 */}
      
      <div className="text-white text-center py-10">
        {!user ? "请登录" : `欢迎, ${user.username}`}
      </div>
      
      {/* ... 您的原有 UI 代码 ... */}

      <audio ref={audioRef} src={material.audioUrl || undefined} />
    </div>
  );
}
