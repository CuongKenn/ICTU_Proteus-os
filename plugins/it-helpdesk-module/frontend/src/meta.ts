// IT Helpdesk Module — meta cho gateway (catalog + nav). Không chứa logic.
export interface PluginRoute {
  path: string; // '' = index, còn lại 'tickets' | 'knowledge' | 'sla'
  label: string;
}

export const itHelpdeskMeta = {
  code: 'it-helpdesk-module',
  displayName: 'IT Service Desk nội bộ',
  description:
    'Hỗ trợ CNTT nội bộ: tickets, phân công kỹ thuật viên, SLA, tri thức.',
  routes: [
    { path: '', label: 'Tổng quan' },
    { path: 'tickets', label: 'Tickets' },
    { path: 'knowledge', label: 'Tri thức' },
    { path: 'sla', label: 'Chính sách SLA' },
  ] as PluginRoute[],
};
