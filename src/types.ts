export interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'user';
}

export interface AudioSegment {
  id: string;
  label: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  subtitle?: string; // Optional per-segment transcript
}

export interface ListeningMaterial {
  id: string;
  title: string;
  audioUrl: string | null;
  script: string;
  segments: AudioSegment[];
  lastModified: number;
  authorId?: string;
}
