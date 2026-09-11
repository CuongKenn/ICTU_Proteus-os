// Meeting Module — seed mở rộng từ db/seed_data.sql (giữ nguyên 2 phòng
// gốc) + phòng, lịch đặt, việc cần làm VN thực tế.
import type { ActionItem, Booking, MeetingRoom } from '../types';

export const seedRooms: MeetingRoom[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Phòng Họp Lớn A1',
    capacity: 50,
    floor: 'Tầng 1',
    amenities: { projector: true, whiteboard: true, video_conf: true },
    is_active: true,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Phòng Họp Nhỏ B2',
    capacity: 10,
    floor: 'Tầng 2',
    amenities: { projector: false, whiteboard: true, video_conf: false },
    is_active: true,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Phòng Họp Trực tuyến C1',
    capacity: 20,
    floor: 'Tầng 3',
    amenities: { projector: true, whiteboard: false, video_conf: true },
    is_active: true,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Phòng Seminar D1',
    capacity: 100,
    floor: 'Tầng 4',
    amenities: { projector: true, whiteboard: true, video_conf: true },
    is_active: false,
  },
];

export const seedBookings: Booking[] = [
  {
    id: 'b1111111-1111-1111-1111-111111111111',
    room_id: '11111111-1111-1111-1111-111111111111',
    title: 'Họp giao ban đầu tuần',
    organizer_id: 'Phòng Hành chính',
    start_time: '2026-09-14T07:30:00.000Z',
    end_time: '2026-09-14T09:00:00.000Z',
    status: 'SCHEDULED',
    description: 'Giao ban các phòng ban, điểm lại tuần 37',
  },
  {
    id: 'b1111111-2222-2222-2222-222222222222',
    room_id: '22222222-2222-2222-2222-222222222222',
    title: 'Review đồ án tốt nghiệp nhóm AI',
    organizer_id: 'ThS. Lê Văn Cường',
    start_time: '2026-09-12T13:30:00.000Z',
    end_time: '2026-09-12T15:00:00.000Z',
    status: 'COMPLETED',
    description: 'Duyệt tiến độ 3 nhóm NCKH sinh viên',
  },
  {
    id: 'b1111111-3333-3333-3333-333333333333',
    room_id: '33333333-3333-3333-3333-333333333333',
    title: 'Họp trực tuyến với đối tác FPT',
    organizer_id: 'PGS.TS Nguyễn Văn An',
    start_time: '2026-09-15T08:00:00.000Z',
    end_time: '2026-09-15T09:30:00.000Z',
    status: 'SCHEDULED',
    description: 'Bàn hợp tác đào tạo AI cho sinh viên năm 3',
  },
];

export const seedActions: ActionItem[] = [
  {
    id: 'a2222222-1111-1111-1111-111111111111',
    booking_id: 'b1111111-2222-2222-2222-222222222222',
    task_desc: 'Hoàn thiện slide báo cáo đồ án vision-transformer',
    owner_id: 'Nhóm SV Nguyễn Thị Lan',
    due_date: '2026-09-16',
    status: 'IN_PROGRESS',
  },
  {
    id: 'a2222222-2222-2222-2222-222222222222',
    booking_id: 'b1111111-2222-2222-2222-222222222222',
    task_desc: 'Gửi biên bản họp cho các thành viên',
    owner_id: 'ThS. Lê Văn Cường',
    due_date: '2026-09-13',
    status: 'COMPLETED',
  },
  {
    id: 'a2222222-3333-3333-3333-333333333333',
    booking_id: 'b1111111-1111-1111-1111-111111111111',
    task_desc: 'Tổng hợp báo cáo tuần 37 của các phòng',
    owner_id: 'Phòng Hành chính',
    due_date: '2026-09-15',
    status: 'PENDING',
  },
];
