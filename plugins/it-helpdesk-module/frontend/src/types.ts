// IT Helpdesk Module — types map 1-1 với migrations/V1.0.0__initial.sql
// Lưu ý: `requester_id` / `assignee_id` / `author_id` / `user_id` là UUID →
// hr_employees ở DB thật; UI hiển thị *_name (live map từ id tương ứng).

export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';

export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_ON_USER'
  | 'RESOLVED'
  | 'CLOSED';

export interface ItCategory {
  id: string;
  name: string;
  description: string;
}

export interface SlaPolicy {
  id: string;
  priority: TicketPriority;
  resolve_time_hours: number;
}

export interface ItTicket {
  id: string;
  requester_name: string;
  category_id: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee_name: string;
  sla_deadline: string; // ISO
  escalated: boolean;
  feedback_rating: number | null;
  created_at: string; // ISO
}

export interface TicketUpdate {
  id: string;
  ticket_id: string;
  user_name: string;
  message: string;
  new_status: string | null;
  created_at: string; // ISO
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  content_md: string;
  category_id: string;
  author_name: string;
  view_count: number;
  is_published: boolean;
  created_at: string; // ISO
}

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Mới',
  IN_PROGRESS: 'Đang xử lý',
  WAITING_ON_USER: 'Chờ người dùng',
  RESOLVED: 'Đã giải quyết',
  CLOSED: 'Đóng',
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  P1: 'P1 Nguy kịch',
  P2: 'P2 Cao',
  P3: 'P3 Thường',
  P4: 'P4 Thấp',
};
