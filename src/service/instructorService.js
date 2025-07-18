import { BASE_URL } from "../constants";
import { fetchAPI } from "./api";
import { handleResponse } from "./handleResponse";

let activeLessons = [];
let videos = [
  { id: 'v1', timestamp: '2025-05-26T16:53:00' },
  { id: 'v2', timestamp: '2025-05-26T16:43:00' },
  { id: 'v3', timestamp: '2025-05-26T16:42:00' },
  { id: 'v4', timestamp: '2025-05-26T16:39:00' },
  { id: 'v5', timestamp: '2025-05-26T16:27:00' },
];

export async function getStudents() {
  const options = { method: "GET", redirect: "follow" };
  const response = await fetchAPI(`${BASE_URL}/api/instructor/students`, options);
  const result = await handleResponse(response);
  if (!result.success) throw new Error(result.message || "Failed to fetch students");
  const arr = result.data?.data;
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("No students found");
  }
  return arr;
}

export async function getActiveLessons() {
  return [...activeLessons];
}

export async function getUnlinkedVideos() {
  return [];
}

export async function startLesson(studentId, studentName) {
  const now = new Date();
  const lesson = {
    id: studentId,
    studentId,
    studentName,
    date: now.toISOString().split("T")[0],
    startTime: now.toTimeString().slice(0, 5),
    endTime: null,
    linkedVideos: [],
  };
  activeLessons = [lesson];
  return lesson;
}

export async function stopLesson(lessonId) {
  const idx = activeLessons.findIndex(l => l.id === lessonId);
  if (idx === -1) throw new Error(`No active lesson found with id ${lessonId}`);
  const lesson = activeLessons[idx];

  const now = new Date();

  const endTimeUtcIso = now.toISOString();

  const [year, month, day] = lesson.date.split('-').map(Number);
  const [startHour, startMinute] = lesson.startTime.split(':').map(Number);
  const localStart = new Date(year, month - 1, day, startHour, startMinute);
  const startTimeUtcIso = localStart.toISOString();

  lesson.endTime = endTimeUtcIso;

  const utcDateOnly = now.toISOString().slice(0, 10);

  const body = {
    student_id: lesson.studentId,
    start_time: startTimeUtcIso,
    end_time: endTimeUtcIso,
    date: utcDateOnly
  };

  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "follow",
  };

  const response = await fetchAPI(`${BASE_URL}/api/instructor/update_lesson`, options);
  const result = await handleResponse(response);
  if (!result.success) throw new Error(result.message || "Failed to stop lesson");

  activeLessons = [];
  return lesson;
}



/**
 * Fetch completed lessons for the given student with proper student name mapping
 */
export async function getCompletedLessons(studentId) {
  if (!studentId) return [];
  const options = { method: "GET", redirect: "follow", noAuth: true };
  const url = `${BASE_URL}/api/lessons?student_id=${studentId}`;
  const response = await fetchAPI(url, options);
  const result = await handleResponse(response);
  if (!result.success) throw new Error(result.message || "Failed to fetch completed lessons");

  const lessonsArray = result.data?.data || [];
  console.log('Raw completed lessons result:', lessonsArray);
  // Get students to map student names properly
  const students = await getStudents();

  return lessonsArray.map(lesson => {
    // Find the student name from the students array
    // const student = students.find(s => s.id === lesson.student_id);
    const student = students.find(s =>
      String(s.id) === String(lesson.student_id)
    );

    return {
      id: lesson.id,
      studentId: lesson.student_id,
      studentName: student?.name ?? lesson.student_name ?? 'Unknown Student',
      date: lesson.date, // Keep as string for now
      startTime: lesson.start_time,
      endTime: lesson.end_time,
      linkedVideosCount: Array.isArray(lesson.videos)
        ? lesson.videos.length
        : lesson.videos || 0
    };
  });
}

/**
 * NEW FUNCTION: Get lesson details by lesson ID
 */
export async function getLessonDetails(lessonId) {
  const options = { method: "GET", redirect: "follow" };
  const url = `${BASE_URL}/api/lessons_details_mux?id=${lessonId}`;

  try {
    const response = await fetchAPI(url, options);
    const result = await handleResponse(response);

    if (!result.success) {
      throw new Error(result.message || "Failed to fetch lesson details");
    }

    // Debug: Log the raw result to understand the API response structure
    console.log('Raw lesson details result:', result);

    return result.data || result;
  } catch (error) {
    console.error('API call failed for lesson details:', error);
    throw error;
  }
}

export async function linkVideoToLesson(lessonId, videoObj) {
  return videoObj;
}

export async function uploadVideoToLesson(lessonId, file) {
  const lesson = activeLessons.find(l => l.id === lessonId);
  if (!lesson) throw new Error(`Active lesson not found: ${lessonId}`);
  const newVid = {
    id: 'v' + Date.now(),
    timestamp: new Date().toISOString(),
    filename: file.name,
  };
  lesson.linkedVideos.push(newVid);
  return newVid;
}

export async function uploadUnlinkedVideo(file) {
  const newVid = {
    id: 'v' + Date.now(),
    timestamp: new Date().toISOString(),
    filename: file.name,
  };
  videos.unshift(newVid);
  return newVid;
}
