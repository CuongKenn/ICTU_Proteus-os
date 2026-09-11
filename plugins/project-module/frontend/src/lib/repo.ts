// Project Module — DATA LAYER.
// Hai chế độ sau cùng 1 interface async ProjectStore:
// - DEMO: createMockRepo (seed + localStorage, offline, không cần login).
// - LIVE: API thật (records CRUD + dispatcher → n8n), cần login ở Launchpad.
// getStore() tự dò: gọi thử API, rớt (401/offline/chưa cài) → DEMO + lý do.
// QUY TẮC: mọi gọi API qua BffClient tới /api/proxy, KHÔNG bao giờ gửi mã
// định danh tenant (tenant suy ra từ session ở BFF/dispatcher).
import type {
  Milestone,
  Project,
  ProjectStatus,
  ProjectTask,
  TaskComment,
  TaskPriority,
  TaskStatus,
  TimeLog,
} from '../types';
import {
  seedComments,
  seedMilestones,
  seedProjects,
  seedTasks,
  seedTimeLogs,
} from '../data/seed';

const LS_KEY = 'proteus:project-module:v1';

interface Persisted {
  projects: Project[];
  milestones: Milestone[];
  tasks: ProjectTask[];
  comments: TaskComment[];
  timeLogs: TimeLog[];
}

function load(): Persisted {
  const fallback: Persisted = {
    projects: seedProjects,
    milestones: seedMilestones,
    tasks: seedTasks,
    comments: seedComments,
    timeLogs: seedTimeLogs,
  };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      projects: parsed.projects ?? fallback.projects,
      milestones: parsed.milestones ?? fallback.milestones,
      tasks: parsed.tasks ?? fallback.tasks,
      comments: parsed.comments ?? fallback.comments,
      timeLogs: parsed.timeLogs ?? fallback.timeLogs,
    };
  } catch {
    return fallback;
  }
}

function save(s: Persisted) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota */
  }
}

export function uid(): string {
  return 'xxxxxxxx-xxxx-4xxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

export interface ProjectRepo {
  listProjects(): Project[];
  createProject(input: Omit<Project, 'id'>): Project;
  updateProject(id: string, patch: Partial<Project>): Project;
  removeProject(id: string): void;
  listMilestones(project_id?: string): Milestone[];
  createMilestone(input: Omit<Milestone, 'id'>): Milestone;
  updateMilestoneProgress(id: string, completion_pct: number): Milestone;
  removeMilestone(id: string): void;
  listTasks(project_id?: string): ProjectTask[];
  createTask(input: Omit<ProjectTask, 'id'>): ProjectTask;
  moveTask(id: string, status: TaskStatus): ProjectTask;
  updateTask(id: string, patch: Partial<ProjectTask>): ProjectTask;
  removeTask(id: string): void;
  listComments(task_id?: string): TaskComment[];
  addComment(input: Omit<TaskComment, 'id' | 'created_at'>): TaskComment;
  listTimeLogs(task_id?: string): TimeLog[];
  addTimeLog(input: Omit<TimeLog, 'id'>): TimeLog;
  reset(): void;
}

export function createMockRepo(): ProjectRepo {
  return {
    listProjects: () => load().projects,
    createProject(input) {
      const s = load();
      const row = { ...input, id: uid() };
      s.projects = [row, ...s.projects];
      save(s);
      return row;
    },
    updateProject(id, patch) {
      const s = load();
      const row = s.projects.find((p) => p.id === id);
      if (!row) throw new Error('Không tìm thấy dự án');
      Object.assign(row, patch);
      save(s);
      return row;
    },
    removeProject(id) {
      const s = load();
      s.projects = s.projects.filter((p) => p.id !== id);
      s.milestones = s.milestones.filter((m) => m.project_id !== id);
      s.tasks = s.tasks.filter((t) => t.project_id !== id);
      save(s);
    },
    listMilestones: (project_id) => {
      const all = load().milestones;
      return project_id ? all.filter((m) => m.project_id === project_id) : all;
    },
    createMilestone(input) {
      const s = load();
      const row = { ...input, id: uid() };
      s.milestones = [row, ...s.milestones];
      save(s);
      return row;
    },
    updateMilestoneProgress(id, completion_pct) {
      const s = load();
      const row = s.milestones.find((m) => m.id === id);
      if (!row) throw new Error('Không tìm thấy cột mốc');
      row.completion_pct = Math.max(0, Math.min(100, completion_pct));
      save(s);
      return row;
    },
    removeMilestone(id) {
      const s = load();
      s.milestones = s.milestones.filter((m) => m.id !== id);
      for (const t of s.tasks) {
        if (t.milestone_id === id) t.milestone_id = null;
      }
      save(s);
    },
    listTasks: (project_id) => {
      const all = load().tasks;
      return project_id ? all.filter((t) => t.project_id === project_id) : all;
    },
    createTask(input) {
      const s = load();
      const row = { ...input, id: uid() };
      s.tasks = [row, ...s.tasks];
      save(s);
      return row;
    },
    moveTask(id, status) {
      const s = load();
      const row = s.tasks.find((t) => t.id === id);
      if (!row) throw new Error('Không tìm thấy công việc');
      row.status = status;
      save(s);
      return row;
    },
    updateTask(id, patch) {
      const s = load();
      const row = s.tasks.find((t) => t.id === id);
      if (!row) throw new Error('Không tìm thấy công việc');
      Object.assign(row, patch);
      save(s);
      return row;
    },
    removeTask(id) {
      const s = load();
      s.tasks = s.tasks.filter((t) => t.id !== id);
      s.comments = s.comments.filter((c) => c.task_id !== id);
      s.timeLogs = s.timeLogs.filter((l) => l.task_id !== id);
      save(s);
    },
    listComments: (task_id) => {
      const all = load().comments;
      return task_id ? all.filter((c) => c.task_id === task_id) : all;
    },
    addComment(input) {
      const s = load();
      const row: TaskComment = { ...input, id: uid(), created_at: new Date().toISOString() };
      s.comments = [row, ...s.comments];
      save(s);
      return row;
    },
    listTimeLogs: (task_id) => {
      const all = load().timeLogs;
      return task_id ? all.filter((l) => l.task_id === task_id) : all;
    },
    addTimeLog(input) {
      const s = load();
      const row = { ...input, id: uid() };
      s.timeLogs = [row, ...s.timeLogs];
      save(s);
      return row;
    },
    reset() {
      localStorage.removeItem(LS_KEY);
    },
  };
}

// ─── Async Store (DEMO + LIVE chung interface) ──────────────
import { ApiError, createBffClient, type BffClient } from './api';

export type StoreMode = 'live' | 'demo';
export type DemoReason =
  | 'unauthenticated' // 401: chưa login ở Launchpad
  | 'not-installed' // plugin chưa ACTIVE / bảng chưa có
  | 'offline'; // không tới được BFF

export interface ProjectStore {
  listProjects(): Promise<Project[]>;
  createProject(input: Omit<Project, 'id'>): Promise<Project>;
  updateProject(id: string, patch: Partial<Project>): Promise<Project>;
  removeProject(id: string): Promise<void>;
  setProjectStatus(id: string, status: ProjectStatus): Promise<void>;
  listMilestones(project_id?: string): Promise<Milestone[]>;
  createMilestone(input: Omit<Milestone, 'id'>): Promise<Milestone>;
  updateMilestoneProgress(id: string, completion_pct: number): Promise<void>;
  removeMilestone(id: string): Promise<void>;
  listTasks(project_id?: string): Promise<ProjectTask[]>;
  createTask(input: Omit<ProjectTask, 'id'>): Promise<void>;
  moveTask(id: string, status: TaskStatus): Promise<void>;
  updateTask(id: string, patch: Partial<ProjectTask>): Promise<void>;
  removeTask(id: string): Promise<void>;
  listComments(task_id?: string): Promise<TaskComment[]>;
  addComment(input: Omit<TaskComment, 'id' | 'created_at'>): Promise<void>;
  listTimeLogs(task_id?: string): Promise<TimeLog[]>;
  addTimeLog(input: Omit<TimeLog, 'id'>): Promise<void>;
  reset(): Promise<void>;
}

const R = '/v1/plugins/project-module/records';

function toProject(r: Record<string, unknown>): Project {
  const manager = String(r.manager_name ?? r.manager_id ?? '');
  return {
    id: String(r.id ?? ''),
    code: String(r.code ?? ''),
    name: String(r.name ?? ''),
    manager_id: r.manager_id == null ? null : String(r.manager_id),
    manager_name: manager,
    start_date: String(r.start_date ?? '').slice(0, 10),
    end_date: String(r.end_date ?? '').slice(0, 10),
    budget: Number(r.budget ?? 0),
    status: (r.status as ProjectStatus) ?? 'PLANNING',
  };
}

function toMilestone(r: Record<string, unknown>): Milestone {
  return {
    id: String(r.id ?? ''),
    project_id: String(r.project_id ?? ''),
    name: String(r.name ?? ''),
    due_date: String(r.due_date ?? '').slice(0, 10),
    completion_pct: Number(r.completion_pct ?? 0),
  };
}

function toTask(r: Record<string, unknown>): ProjectTask {
  const assignee = String(r.assignee_name ?? r.assignee_id ?? '');
  return {
    id: String(r.id ?? ''),
    project_id: String(r.project_id ?? ''),
    milestone_id: r.milestone_id == null ? null : String(r.milestone_id),
    title: String(r.title ?? ''),
    description: String(r.description ?? ''),
    assignee_id: r.assignee_id == null ? null : String(r.assignee_id),
    assignee_name: assignee,
    due_date: String(r.due_date ?? '').slice(0, 10),
    priority: (r.priority as TaskPriority) ?? 'MEDIUM',
    status: (r.status as TaskStatus) ?? 'TODO',
  };
}

/** Demo store: bọc mock sync thành async (giữ nguyên localStorage). */
export function createDemoStore(): ProjectStore {
  const m = createMockRepo();
  return {
    async listProjects() { return m.listProjects(); },
    async createProject(i) { return m.createProject(i); },
    async updateProject(id, p) { return m.updateProject(id, p); },
    async removeProject(id) { m.removeProject(id); },
    async setProjectStatus(id, s) { m.updateProject(id, { status: s }); },
    async listMilestones(p) { return m.listMilestones(p); },
    async createMilestone(i) { return m.createMilestone(i); },
    async updateMilestoneProgress(id, pct) { m.updateMilestoneProgress(id, pct); },
    async removeMilestone(id) { m.removeMilestone(id); },
    async listTasks(p) { return m.listTasks(p); },
    async createTask(i) { m.createTask(i); },
    async moveTask(id, s) { m.moveTask(id, s); },
    async updateTask(id, p) { m.updateTask(id, p); },
    async removeTask(id) { m.removeTask(id); },
    async listComments(t) { return m.listComments(t); },
    async addComment(i) { m.addComment(i); },
    async listTimeLogs(t) { return m.listTimeLogs(t); },
    async addTimeLog(i) { m.addTimeLog(i); },
    async reset() { m.reset(); },
  };
}

/** Live store: records CRUD + dispatcher → n8n webhook. */
export function createLiveStore(client: BffClient): ProjectStore {
  const rows = async <T>(table: string): Promise<T[]> => {
    const res = await client.get<{ rows: T[] }>(`${R}/${table}?limit=100`);
    return res.rows ?? [];
  };
  return {
    async listProjects() {
      return (await rows<Record<string, unknown>>('project_projects')).map(toProject);
    },
    async createProject(i) {
      return toProject(await client.post(`${R}/project_projects`, {
        code: i.code,
        name: i.name,
        manager_id: i.manager_id,
        start_date: i.start_date,
        end_date: i.end_date,
        budget: i.budget,
        status: i.status,
      }));
    },
    async updateProject(id, p) {
      return toProject(await client.patch(`${R}/project_projects/${id}`, p));
    },
    async removeProject(id) {
      await client.del(`${R}/project_projects/${id}`);
    },
    async setProjectStatus(id, status) {
      await client.patch(`${R}/project_projects/${id}`, { status });
    },
    async listMilestones(project_id) {
      const all = (await rows<Record<string, unknown>>('project_milestones')).map(toMilestone);
      return project_id ? all.filter((m) => m.project_id === project_id) : all;
    },
    async createMilestone(i) {
      return toMilestone(await client.post(`${R}/project_milestones`, i));
    },
    // Chuyển stage milestone = PATCH completion_pct.
    async updateMilestoneProgress(id, completion_pct) {
      await client.patch(`${R}/project_milestones/${id}`, { completion_pct });
    },
    async removeMilestone(id) {
      await client.del(`${R}/project_milestones/${id}`);
    },
    async listTasks(project_id) {
      const all = (await rows<Record<string, unknown>>('project_tasks')).map(toTask);
      return project_id ? all.filter((t) => t.project_id === project_id) : all;
    },
    // Tạo task đi qua workflow wf_task_assignment (ghi DB + nhắn người được giao).
    async createTask(i) {
      await client.post('/v1/plugins/project-module/actions/wf_task_assignment', {
        payload: {
          project_id: i.project_id,
          title: i.title,
          description: i.description,
          assignee_id: i.assignee_id ?? i.assignee_name,
          priority: i.priority,
          due_date: i.due_date,
        },
      });
    },
    // Chuyển stage task = PATCH status (TODO → IN_PROGRESS → REVIEW → DONE).
    async moveTask(id, status) {
      await client.patch(`${R}/project_tasks/${id}`, { status });
    },
    async updateTask(id, p) {
      await client.patch(`${R}/project_tasks/${id}`, p);
    },
    async removeTask(id) {
      await client.del(`${R}/project_tasks/${id}`);
    },
    async listComments(task_id) {
      const all = await rows<TaskComment>('project_task_comments');
      return task_id ? all.filter((c) => c.task_id === task_id) : all;
    },
    async addComment(i) {
      await client.post(`${R}/project_task_comments`, {
        task_id: i.task_id,
        user_id: i.user_id,
        content: i.content,
      });
    },
    async listTimeLogs(task_id) {
      const all = await rows<TimeLog>('project_time_logs');
      return task_id ? all.filter((l) => l.task_id === task_id) : all;
    },
    async addTimeLog(i) {
      await client.post(`${R}/project_time_logs`, i);
    },
    async reset() { /* live: không reset DB từ UI */ },
  };
}

export interface ResolvedStore {
  mode: StoreMode;
  store: ProjectStore;
  reason?: DemoReason;
  message?: string;
}

let cached: Promise<ResolvedStore> | null = null;

/** Dò API thật, rớt → demo + lý do để UI hiển thị banner trung thực. */
export function getStore(): Promise<ResolvedStore> {
  if (!cached) {
    cached = (async () => {
      const client = createBffClient();
      try {
        await client.get(`${R}/project_projects?limit=1`);
        return { mode: 'live' as const, store: createLiveStore(client) };
      } catch (e) {
        const st = e instanceof ApiError ? e.status : 0;
        const detail = e instanceof ApiError ? e.detail : String(e);
        const reason: DemoReason =
          st === 401 ? 'unauthenticated'
          : st === 400 || st === 404 ? 'not-installed'
          : 'offline';
        return { mode: 'demo' as const, store: createDemoStore(), reason, message: detail };
      }
    })();
  }
  return cached;
}

export function resetStoreCache() {
  cached = null;
}
