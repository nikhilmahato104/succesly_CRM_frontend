import axios from 'axios';

const BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? 'http://localhost:3001/api/v1';

const http = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

/* ── Types ────────────────────────────────────────────────────────────────── */
export interface CameraState { x: number; y: number; scale: number; }

export interface BoardSummary {
  _id:         string;
  name:        string;
  slug:        string;
  thumbnail:   string | null;
  objectCount: number;
  version:     number;
  cameraState: CameraState;
  createdAt:   string;
  updatedAt:   string;
}

export interface BoardFull extends BoardSummary {
  objects: unknown[];
}

export interface Pagination {
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
}

export interface VersionMeta {
  version:     number;
  objectCount: number;
  savedAt:     string;
}

export interface GetAllParams {
  page?:   number;
  limit?:  number;
  search?: string;
  sort?:   'updatedAt' | 'createdAt' | 'name';
  order?:  'asc' | 'desc';
}

/* ── API ──────────────────────────────────────────────────────────────────── */
export const boardApi = {

  /** GET /boards */
  getAll: async (params: GetAllParams = {}) => {
    const res = await http.get('/boards', { params });
    return res.data.data as { boards: BoardSummary[]; pagination: Pagination };
  },

  /** POST /boards */
  create: async (name: string): Promise<BoardSummary> => {
    const res = await http.post('/boards', { name });
    return res.data.data;
  },

  /** GET /boards/:id */
  getById: async (id: string): Promise<BoardFull> => {
    const res = await http.get(`/boards/${id}`);
    return res.data.data;
  },

  /** PATCH /boards/:id */
  rename: async (id: string, name: string) => {
    const res = await http.patch(`/boards/${id}`, { name });
    return res.data.data as { id: string; name: string; slug: string; updatedAt: string };
  },

  /** DELETE /boards/:id */
  remove: async (id: string) => {
    await http.delete(`/boards/${id}`);
  },

  /** PUT /boards/:id/save — autosave */
  save: async (
    id: string,
    payload: { objects: unknown[]; cameraState: CameraState; thumbnail?: string }
  ) => {
    const res = await http.put(`/boards/${id}/save`, payload);
    return res.data.data as { version: number; objectCount: number; savedAt: string };
  },

  /** POST /boards/:id/duplicate */
  duplicate: async (id: string) => {
    const res = await http.post(`/boards/${id}/duplicate`);
    return res.data.data as { id: string; name: string; slug: string };
  },

  /** GET /boards/:id/history */
  getHistory: async (id: string) => {
    const res = await http.get(`/boards/${id}/history`);
    return res.data.data.versions as VersionMeta[];
  },

  /** GET /boards/:id/history/:version */
  getVersion: async (id: string, version: number) => {
    const res = await http.get(`/boards/${id}/history/${version}`);
    return res.data.data as { version: number; objects: unknown[]; savedAt: string };
  },

  /** POST /boards/:id/history/:version/restore */
  restoreVersion: async (id: string, version: number) => {
    const res = await http.post(`/boards/${id}/history/${version}/restore`);
    return res.data.data as { version: number; savedAt: string };
  },
};
