// Meeting Module — types map 1-1 với migrations/V1.0.0__initial.sql
// (meeting_rooms, meeting_bookings, meeting_attendees, meeting_agendas,
//  meeting_minutes, meeting_action_items).
// UUID tham chiếu nhân sự (organizer_id, owner_id...) ở DEMO hiển thị
// bằng tên tiếng Việt; LIVE gửi UUID thật qua dispatcher/records.

export type BookingStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type ActionStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type RsvpStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';

export interface RoomAmenities {
  projector: boolean;
  whiteboard: boolean;
  video_conf: boolean;
}

export interface MeetingRoom {
  id: string;
  name: string;
  capacity: number;
  floor: string;
  amenities: RoomAmenities;
  is_active: boolean;
}

export interface Booking {
  id: string;
  room_id: string;
  title: string;
  organizer_id: string; // UUID (LIVE) hoặc tên hiển thị (DEMO)
  start_time: string; // ISO
  end_time: string; // ISO
  status: BookingStatus;
  description: string;
}

export interface Attendee {
  id: string;
  booking_id: string;
  user_id: string; // UUID (LIVE) hoặc tên hiển thị (DEMO)
  rsvp_status: RsvpStatus;
}

export interface ActionItem {
  id: string;
  booking_id: string;
  task_desc: string;
  owner_id: string; // UUID (LIVE) hoặc tên hiển thị (DEMO)
  due_date: string; // YYYY-MM-DD
  status: ActionStatus;
}

export const BOOKING_LABEL: Record<BookingStatus, string> = {
  SCHEDULED: 'Đã đặt',
  IN_PROGRESS: 'Đang diễn ra',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Không diễn ra',
};

export const ACTION_LABEL: Record<ActionStatus, string> = {
  PENDING: 'Chờ làm',
  IN_PROGRESS: 'Đang làm',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
