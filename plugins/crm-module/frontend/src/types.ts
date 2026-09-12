// CRM types map với migrations/V1.0.0__initial.sql
export type LeadStage = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
export type OppStage =
  | 'PROSPECTING'
  | 'QUALIFICATION'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'CLOSED_WON'
  | 'CLOSED_LOST';
export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_ON_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED';
export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';

export interface Customer {
  id: string;
  name: string;
  type: string;
  industry: string;
  company_size: string;
  status: string;
}
export interface Contact {
  id: string;
  customer_id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  is_primary: boolean;
}
export interface Lead {
  id: string;
  contact_name: string;
  company_name: string;
  email: string;
  phone: string;
  source: string;
  estimated_value: number;
  stage: LeadStage;
}
export interface Opportunity {
  id: string;
  customer_id: string;
  title: string;
  value: number;
  probability_pct: number;
  expected_close_date: string;
  stage: OppStage;
}
export interface Ticket {
  id: string;
  customer_id: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  sla_deadline: string; // ISO
  assignee: string;
  created_at: string;
}
export interface TicketComment {
  id: string;
  ticket_id: string;
  user: string;
  content: string;
  created_at: string;
}

export const LEAD_STAGES: LeadStage[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];
export const OPP_STAGES: OppStage[] = [
  'PROSPECTING',
  'QUALIFICATION',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
];

export function formatVND(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
}
