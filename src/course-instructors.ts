import type { Course } from './course-catalog.js';

export function courseInstructors(course: Course) {
  return course.instructors ?? [];
}
