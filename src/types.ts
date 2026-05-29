export type SessionRecord = {
  id: string;
  offeringId: string;
  teacherId: string;
  startAt: Date;
  endAt: Date;
};

export type OfferingRecord = {
  id: string;
  courseName: string;
  title: string;
  teacherId: string;
  teacherTimezone: string;
  createdAt: Date;
};

export type BookingRecord = {
  id: string;
  offeringId: string;
  parentId: string;
  createdAt: Date;
};