import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase.js';
import { useStudentStore } from '../../store/useStudentStore.js';
import { useVolunteerStore } from '../../store/useVolunteerStore.js';
import { useAttendanceStore } from '../../store/useAttendanceStore.js';
import { useTransactionStore } from '../../store/useTransactionStore.js';
import { CLASS_TEACHER_NAMES, getTeacherNameForClass } from '../../lib/classTeachers.js';
import { getCampTotalDays, getDateForCampDay } from '../../lib/campDates.js';
import { useConfigStore, DEFAULT_BATCH_CLASSES } from '../../store/useConfigStore.js';

const SESSION_KEYS = [1, 2, 3];

function escapeCSVCell(val) {
  return `"${String(val ?? '').replace(/"/g, '""')}"`;
}

function triggerCSVDownload(filename, headers, rows) {
  const csv = [headers, ...rows]
    .map(row => row.map(escapeCSVCell).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadClassOverviewCSV(classData) {
  const headers = [
    'Class', 'Session 1 Teachers', 'Session 2 Teachers', 'Session 3 Teachers',
    'Total Students', 'Boys', 'Girls', 'Checked In', 'Kit Given',
  ];
  const rows = classData.map(c => [
    c.classCode,
    c.sessions[0]?.teachers.join('; ') || 'Not assigned',
    c.sessions[1]?.teachers.join('; ') || 'Not assigned',
    c.sessions[2]?.teachers.join('; ') || 'Not assigned',
    c.classStudents.length,
    c.boys,
    c.girls,
    c.checkedIn,
    c.kitGiven,
  ]);
  triggerCSVDownload('shivir-classes-overview.csv', headers, rows);
}

function downloadClassRosterCSV(classData) {
  const headers = [
    'Class', 'Session 1 Teachers', 'Session 2 Teachers', 'Session 3 Teachers',
    'Roll No', 'Reg ID', 'Name', 'Gender', 'Age', 'Batch',
    'Room', 'City', 'Pathshala', 'Checked In', 'Total Points',
  ];
  const rows = [];
  for (const cls of classData) {
    const t1 = cls.sessions[0]?.teachers.join('; ') || 'Not assigned';
    const t2 = cls.sessions[1]?.teachers.join('; ') || 'Not assigned';
    const t3 = cls.sessions[2]?.teachers.join('; ') || 'Not assigned';
    if (cls.classStudents.length === 0) {
      rows.push([cls.classCode, t1, t2, t3, '', '', '', '', '', '', '', '', '', '', '']);
    } else {
      for (const s of cls.classStudents) {
        rows.push([
          cls.classCode, t1, t2, t3,
          s.roll_no || '', s.reg_id || '', s.name || '',
          s.gender || '', s.age || '', s.batch || '',
          s.room_no || '', s.city || '', s.pathshala || '',
          s.checked_in ? 'Yes' : 'No',
          s.total_points ?? 0,
        ]);
      }
    }
  }
  triggerCSVDownload('shivir-class-roster.csv', headers, rows);
}

const SESSION_LABELS = {
  1: 'Session 1 (Morning 1)',
  2: 'Session 2 (Morning 2)',
  3: 'Session 3 (Afternoon)',
};

function parseSessionClasses(raw) {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { value = null; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.keys(value).reduce((acc, key) => {
    const code = String(value[key] || '').trim();
    if (code) acc[String(key)] = code;
    return acc;
  }, {});
}

function getAttendanceBreakdown(students, sessionNum, classCode, getStatus) {
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  students.forEach((student) => {
    const status = getStatus(student.id, sessionNum, classCode);
    counts[status] = (counts[status] || 0) + 1;
  });
  return counts;
}

function getStudentsByAttendanceStatus(students, sessionNum, classCode, getStatus) {
  const groups = { present: [], absent: [], late: [], excused: [] };
  students.forEach((student) => {
    const status = getStatus(student.id, sessionNum, classCode);
    if (!groups[status]) groups[status] = [];
    groups[status].push(student);
  });
  return groups;
}

export default function AdminClasses() {
  const { students, fetchStudents } = useStudentStore();
  const { volunteers } = useVolunteerStore();
  const { currentDay, fetchTransactions } = useTransactionStore();
  const batchClasses = useConfigStore(s => s.batchClasses) || DEFAULT_BATCH_CLASSES;
  const fetchAttendance = useAttendanceStore(s => s.fetchAttendance);
  const getStatus = useAttendanceStore(s => s.getStatus);
  const getSubmission = useAttendanceStore(s => s.getSubmission);

  const [openClass, setOpenClass] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [resetAttendanceOpen, setResetAttendanceOpen] = useState(false);
  const [resetCheckinOpen, setResetCheckinOpen] = useState(false);
  const [resetDay, setResetDay] = useState(currentDay || 1);
  const [attendanceResetPhrase, setAttendanceResetPhrase] = useState('');
  const [checkInResetPhrase, setCheckInResetPhrase] = useState('');
  const [resettingAttendance, setResettingAttendance] = useState(false);
  const [resettingCheckIn, setResettingCheckIn] = useState(false);

  const ATTENDANCE_RESET_TOKEN = 'RESET ATTENDANCE';
  const CHECKIN_RESET_TOKEN = 'RESET CHECKIN';

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  useEffect(() => {
    setResetDay(currentDay || 1);
  }, [currentDay]);

  const rebuildStudentPointsFromTransactions = async () => {
    const [{ data: txRows, error: txErr }, { data: studentRows, error: stErr }] = await Promise.all([
      supabase.from('transactions').select('student_id,points,day'),
      supabase.from('students').select('id'),
    ]);
    if (txErr) throw txErr;
    if (stErr) throw stErr;

    const statsByStudent = new Map();
    (studentRows || []).forEach((s) => {
      statsByStudent.set(s.id, { total_points: 0, day_points: [0, 0, 0, 0, 0, 0, 0] });
    });

    (txRows || []).forEach((tx) => {
      if (!statsByStudent.has(tx.student_id)) return;
      const row = statsByStudent.get(tx.student_id);
      row.total_points += Number(tx.points || 0);
      const day = Number(tx.day || 0);
      if (day >= 1 && day <= row.day_points.length) {
        row.day_points[day - 1] += Number(tx.points || 0);
      }
    });

    const updates = Array.from(statsByStudent.entries());
    for (let i = 0; i < updates.length; i += 50) {
      const chunk = updates.slice(i, i + 50);
      await Promise.all(chunk.map(async ([id, payload]) => {
        const { error } = await supabase.from('students').update(payload).eq('id', id);
        if (error) throw error;
      }));
    }
  };

  const handleResetAttendanceForDay = async () => {
    if (attendanceResetPhrase.trim() !== ATTENDANCE_RESET_TOKEN) {
      toast.error(`Type "${ATTENDANCE_RESET_TOKEN}" exactly to confirm.`);
      return;
    }
    const targetDate = getDateForCampDay(resetDay);
    setResettingAttendance(true);
    try {
      // Local-day window for submitted_at filtering (timestamptz).
      const start = new Date(`${targetDate}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      // Attendance rows have an explicit day column, so this is robust even if
      // legacy rows used UTC date strings.
      const { error: attErr } = await supabase.from('attendance').delete().eq('day', resetDay);
      if (attErr) throw attErr;

      // Submissions table has no day column in existing schema; reset by local
      // submitted_at window for the selected camp day.
      const { data: subRows, error: subFetchErr } = await supabase
        .from('attendance_submissions')
        .select('id')
        .gte('submitted_at', start.toISOString())
        .lt('submitted_at', end.toISOString());
      if (subFetchErr) throw subFetchErr;

      const submissionIds = (subRows || []).map(r => r.id);
      if (submissionIds.length > 0) {
        const { error: subErr } = await supabase
          .from('attendance_submissions')
          .delete()
          .in('id', submissionIds);
        if (subErr) throw subErr;
      }

      // Remove attendance-awarded transactions for this selected day.
      const { error: txErr } = await supabase
        .from('transactions')
        .delete()
        .eq('day', resetDay)
        .ilike('activity', 'Attendance — Class%');
      if (txErr) throw txErr;

      // Also handle any legacy rows that used a simple ASCII hyphen in activity
      // text (if entered from older versions/scripts).
      const { error: txErrLegacy } = await supabase
        .from('transactions')
        .delete()
        .eq('day', resetDay)
        .ilike('activity', 'Attendance - Class%');
      if (txErrLegacy) throw txErrLegacy;

      await rebuildStudentPointsFromTransactions();

      await Promise.all([fetchStudents(), fetchAttendance(), fetchTransactions()]);
      setAttendanceResetPhrase('');
      toast.success(`Attendance for Day ${resetDay} reset successfully.`);
    } catch (err) {
      toast.error(err?.message || 'Failed to reset attendance for selected day.');
    } finally {
      setResettingAttendance(false);
    }
  };

  const handleResetCheckIn = async () => {
    if (checkInResetPhrase.trim() !== CHECKIN_RESET_TOKEN) {
      toast.error(`Type "${CHECKIN_RESET_TOKEN}" exactly to confirm.`);
      return;
    }
    setResettingCheckIn(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({ checked_in: false, checked_in_at: null })
        .neq('id', '');
      if (error) throw error;

      await fetchStudents();
      setCheckInResetPhrase('');
      toast.success('Check-in data reset for all students.');
    } catch (err) {
      toast.error(err?.message || 'Failed to reset check-in data.');
    } finally {
      setResettingCheckIn(false);
    }
  };

  const classCodes = useMemo(() => {
    const fromBatchConfig = Object.values(batchClasses).flat();
    const fromTeacherMap = Object.keys(CLASS_TEACHER_NAMES);
    const fromStudents = students.map(s => String(s.class || '').trim()).filter(Boolean);
    return [...new Set([...fromBatchConfig, ...fromTeacherMap, ...fromStudents])]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students, batchClasses]);

  const classTeachersBySession = useMemo(() => {
    const map = {};
    classCodes.forEach((classCode) => {
      map[classCode] = { 1: [], 2: [], 3: [] };
    });

    volunteers
      .filter(v => (v.roles || []).includes('Class Teacher'))
      .forEach((volunteer) => {
        const sessionMap = parseSessionClasses(volunteer.session_classes);
        SESSION_KEYS.forEach((sessionNum) => {
          const classCode = String(sessionMap[String(sessionNum)] || '').trim();
          if (!classCode || !map[classCode]) return;
          map[classCode][sessionNum].push(volunteer.name || 'Unnamed Teacher');
        });
      });

    return map;
  }, [classCodes, volunteers]);

  const classData = useMemo(() => {
    return classCodes.map((classCode) => {
      const classStudents = students
        .filter(s => String(s.class || '').trim() === classCode)
        .sort((a, b) => String(a.roll_no || '').localeCompare(String(b.roll_no || ''), undefined, { numeric: true }));

      const checkedIn = classStudents.filter(s => s.checked_in).length;
      const girls = classStudents.filter(s => String(s.gender || '').toLowerCase() === 'girl').length;
      const boys = classStudents.filter(s => String(s.gender || '').toLowerCase() === 'boy').length;
      const kitGiven = classStudents.filter(s => s.kit_given).length;

      const sessions = SESSION_KEYS.map((sessionNum) => {
        const attendance = getAttendanceBreakdown(classStudents, sessionNum, classCode, getStatus);
        const submission = getSubmission(sessionNum, classCode);
        return {
          sessionNum,
          label: SESSION_LABELS[sessionNum],
          teachers: classTeachersBySession[classCode]?.[sessionNum] || [],
          attendance,
          submission,
        };
      });

      return {
        classCode,
        primaryTeacher: getTeacherNameForClass(classCode, false) || 'Not mapped',
        classStudents,
        checkedIn,
        girls,
        boys,
        kitGiven,
        sessions,
      };
    });
  }, [classCodes, students, classTeachersBySession, getStatus, getSubmission]);

  const totalStudents = students.length;
  const totalCheckedIn = students.filter(s => s.checked_in).length;
  const checkInPercent = totalStudents ? Math.round((totalCheckedIn / totalStudents) * 100) : 0;
  const classTeacherCount = volunteers.filter(v => (v.roles || []).includes('Class Teacher')).length;

  return (
    <div className="p-3 sm:p-6 space-y-4 bg-slate-50 min-h-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-900">Classes</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadClassOverviewCSV(classData)}
            className="px-3 py-1.5 rounded-xl bg-forest-600 text-white text-sm font-semibold hover:bg-forest-700 active:scale-[0.98] transition-all flex items-center gap-1.5"
          >
            ⬇ Classes Overview CSV
          </button>
          <button
            type="button"
            onClick={() => downloadClassRosterCSV(classData)}
            className="px-3 py-1.5 rounded-xl bg-saffron-600 text-white text-sm font-semibold hover:bg-saffron-700 active:scale-[0.98] transition-all flex items-center gap-1.5"
          >
            ⬇ Full Student Roster CSV
          </button>
        </div>
      </div>

      <div className="inline-flex rounded-2xl border border-gray-200 bg-white p-1 shadow-sm flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
            activeTab === 'overview'
              ? 'bg-saffron-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Class Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
            activeTab === 'attendance'
              ? 'bg-saffron-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Class Attendance
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('exam')}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
            activeTab === 'exam'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          📝 Exam Marks
        </button>
      </div>

      {activeTab === 'exam' && (() => {
        const EXAM_MAX = 80;
        const withMarks = students.filter(s => s.exam_marks != null).length;
        const avg = withMarks
          ? Math.round(students.filter(s => s.exam_marks != null).reduce((sum, s) => sum + s.exam_marks, 0) / withMarks)
          : null;

        const studentsByClass = students.reduce((acc, student) => {
          const cls = String(student.class || '').trim() || 'No Class';
          if (!acc[cls]) acc[cls] = [];
          acc[cls].push(student);
          return acc;
        }, {});

        const classKeys = Object.keys(studentsByClass).sort((a, b) => {
          if (a === 'No Class') return 1;
          if (b === 'No Class') return -1;
          return a.localeCompare(b, undefined, { numeric: true });
        });

        function downloadExamCSV() {
          const headers = ['Class', 'Rank (Class)', 'Bhag', 'Roll No', 'Name', `Marks (/${EXAM_MAX})`];
          const rows = [];
          classKeys.forEach((cls) => {
            const ranked = [...(studentsByClass[cls] || [])]
              .filter(s => s.exam_marks != null)
              .sort((a, b) => {
                const markDiff = Number(b.exam_marks || 0) - Number(a.exam_marks || 0);
                if (markDiff !== 0) return markDiff;
                return String(a.roll_no || '').localeCompare(String(b.roll_no || ''), undefined, { numeric: true });
              });
            ranked.forEach((s, i) => {
              rows.push([cls, i + 1, s.batch || '', s.roll_no || '', s.name, s.exam_marks]);
            });
          });
          triggerCSVDownload('exam-marks.csv', headers, rows);
        }

        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-3">
                <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3 shadow-sm">
                  <div className="text-xl font-bold text-blue-700">{withMarks}/{students.length}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Marks entered</div>
                </div>
                {avg != null && (
                  <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3 shadow-sm">
                    <div className="text-xl font-bold text-blue-700">{avg}/{EXAM_MAX}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Overall average</div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={downloadExamCSV}
                className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center gap-1.5"
              >
                ⬇ Exam Marks CSV
              </button>
            </div>

            {classKeys.map((cls) => {
              const classStudents = studentsByClass[cls] || [];
              const withM = classStudents.filter(s => s.exam_marks != null);
              const withoutM = classStudents.filter(s => s.exam_marks == null);
              const ranked = [...withM].sort((a, b) => {
                const markDiff = Number(b.exam_marks || 0) - Number(a.exam_marks || 0);
                if (markDiff !== 0) return markDiff;
                return String(a.roll_no || '').localeCompare(String(b.roll_no || ''), undefined, { numeric: true });
              });
              const clsAvg = withM.length
                ? Math.round(withM.reduce((s, st) => s + Number(st.exam_marks || 0), 0) / withM.length)
                : null;

              return (
                <div key={cls} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="font-semibold text-gray-900">Class {cls}</div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{withM.length}/{classStudents.length} marked</span>
                      {clsAvg != null && <span className="font-semibold text-blue-600">Avg {clsAvg}/{EXAM_MAX}</span>}
                    </div>
                  </div>

                  {ranked.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-400">No marks entered yet.</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {ranked.map((s, i) => {
                        const barPct = Math.round((s.exam_marks / EXAM_MAX) * 100);
                        const barColor = barPct >= 75 ? 'bg-green-400' : barPct >= 50 ? 'bg-yellow-400' : 'bg-red-400';
                        return (
                          <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              i === 0 ? 'bg-yellow-100 text-yellow-700' :
                              i === 1 ? 'bg-gray-100 text-gray-600' :
                              i === 2 ? 'bg-orange-100 text-orange-600' :
                              'bg-gray-50 text-gray-500'
                            }`}>
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">{s.name}</div>
                              <div className="text-xs text-gray-400">
                                {s.roll_no || '—'}{s.batch ? ` · ${s.batch}` : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barPct}%` }} />
                              </div>
                              <div className="text-sm font-bold text-gray-800 w-14 text-right">{s.exam_marks}/{EXAM_MAX}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {withoutM.length > 0 && (
                    <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                      <div className="text-xs text-gray-400 mb-1.5">Not yet marked ({withoutM.length})</div>
                      <div className="flex flex-wrap gap-1.5">
                        {withoutM.map(s => (
                          <span key={s.id} className="text-xs px-2 py-0.5 rounded-full border border-gray-200 bg-white text-gray-500">
                            {s.roll_no || '—'} · {s.name}{s.batch ? ` · ${s.batch}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {activeTab === 'overview' ? (
        <>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
          <div className="text-2xl font-semibold text-forest-700 leading-none">{classCodes.length}</div>
          <div className="text-xs text-gray-500 mt-1">Classes</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
          <div className="text-2xl font-semibold text-saffron-700 leading-none">{classTeacherCount}</div>
          <div className="text-xs text-gray-500 mt-1">Class Teachers</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
          <div className="text-2xl font-semibold text-blue-700 leading-none">{totalCheckedIn}/{totalStudents}</div>
          <div className="text-xs text-gray-500 mt-1">Checked-In Students</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
          <div className="text-2xl font-semibold text-violet-700 leading-none">{checkInPercent}%</div>
          <div className="text-xs text-gray-500 mt-1">Overall Check-In</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-red-200 p-4 shadow-sm">
        <h3 className="font-semibold text-red-700">Admin Reset Tools</h3>
        <p className="text-xs text-gray-500 mt-1">
          Use carefully for demo recovery. These actions are destructive and should be done only by admin.
        </p>

        <div className="grid lg:grid-cols-2 gap-4 mt-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <button
              type="button"
              onClick={() => setResetAttendanceOpen(o => !o)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="text-sm font-semibold text-amber-800">Reset Attendance by Day</div>
              <span className="text-amber-600 text-lg leading-none">{resetAttendanceOpen ? '▲' : '▼'}</span>
            </button>

            {resetAttendanceOpen && (
              <>
                <div className="text-xs text-amber-700 mt-2">
                  Clears attendance rows, submission rows, and attendance-awarded transactions for selected day, then rebuilds student totals.
                </div>

                <div className="mt-3 flex gap-2 items-center">
                  <label className="text-xs text-gray-600 font-medium">Day</label>
                  <select
                    value={resetDay}
                    onChange={(e) => setResetDay(Number(e.target.value))}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                  >
                    {Array.from({ length: getCampTotalDays() }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        Day {day} ({getDateForCampDay(day)})
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  value={attendanceResetPhrase}
                  onChange={(e) => setAttendanceResetPhrase(e.target.value)}
                  className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder={`Type ${ATTENDANCE_RESET_TOKEN}`}
                />
                <button
                  type="button"
                  onClick={handleResetAttendanceForDay}
                  disabled={resettingAttendance}
                  className="mt-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
                >
                  {resettingAttendance ? 'Resetting…' : `Reset Day ${resetDay} Attendance`}
                </button>
              </>
            )}
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <button
              type="button"
              onClick={() => setResetCheckinOpen(o => !o)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="text-sm font-semibold text-red-800">Reset Check-In Data (All Students)</div>
              <span className="text-red-600 text-lg leading-none">{resetCheckinOpen ? '▲' : '▼'}</span>
            </button>

            {resetCheckinOpen && (
              <>
                <div className="text-xs text-red-700 mt-2">
                  Sets all students to not checked-in and clears check-in timestamps. This affects dashboard and check-in records.
                </div>

                <input
                  value={checkInResetPhrase}
                  onChange={(e) => setCheckInResetPhrase(e.target.value)}
                  className="mt-3 w-full border border-red-300 rounded-lg px-3 py-2 text-sm"
                  placeholder={`Type ${CHECKIN_RESET_TOKEN}`}
                />
                <button
                  type="button"
                  onClick={handleResetCheckIn}
                  disabled={resettingCheckIn}
                  className="mt-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {resettingCheckIn ? 'Resetting…' : 'Reset All Check-In Data'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {classData.map((item) => {
          const expanded = openClass === item.classCode;
          return (
            <div key={item.classCode} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenClass(expanded ? null : item.classCode)}
                className="w-full text-left p-4 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <div className="font-bold text-gray-900">Class {item.classCode}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Primary Teacher: {item.primaryTeacher}</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700">Students {item.classStudents.length}</span>
                  <span className="px-2 py-1 rounded-full bg-green-100 text-green-700">Checked-In {item.checkedIn}</span>
                  <span className="px-2 py-1 rounded-full bg-cyan-100 text-cyan-700">Boys {item.boys}</span>
                  <span className="px-2 py-1 rounded-full bg-pink-100 text-pink-700">Girls {item.girls}</span>
                  <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700">Kit Given {item.kitGiven}</span>
                </div>
              </button>

              {expanded && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="mt-3 grid lg:grid-cols-3 gap-3">
                    {item.sessions.map((session) => (
                      <div key={session.sessionNum} className="rounded-xl border border-gray-200 p-3 bg-slate-50">
                        <div className="font-semibold text-sm text-gray-800">{session.label}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          Teachers: {session.teachers.length ? session.teachers.join(', ') : 'Not assigned'}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Attendance: ✅ {session.attendance.present} • ❌ {session.attendance.absent} • ⏰ {session.attendance.late} • 📋 {session.attendance.excused}
                        </div>
                        <div className="text-xs mt-1">
                          {session.submission
                            ? <span className="text-green-700 font-semibold">Submitted</span>
                            : <span className="text-amber-700 font-semibold">Pending Submission</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <div className="text-xs font-semibold text-gray-500 mb-2">Student List ({item.classStudents.length})</div>
                    {item.classStudents.length === 0 ? (
                      <div className="text-sm text-gray-400 py-2">No students assigned to this class yet.</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {item.classStudents.map((student) => (
                          <span
                            key={student.id}
                            className="text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-white text-gray-700"
                          >
                            {student.roll_no || '—'} • {student.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900">Class Attendance</h3>
          <p className="text-xs text-gray-500 mt-1">
            Student-wise attendance by class and session.
          </p>
          <div className="mt-3 space-y-3">
            {classData.map((item) => (
              <div key={item.classCode} className="border border-gray-200 rounded-xl p-3 bg-slate-50">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="font-semibold text-gray-900">Class {item.classCode}</div>
                  <div className="text-xs text-gray-500">Students: {item.classStudents.length}</div>
                </div>

                <div className="mt-3 grid lg:grid-cols-3 gap-3">
                  {SESSION_KEYS.map((sessionNum) => {
                    const grouped = getStudentsByAttendanceStatus(
                      item.classStudents,
                      sessionNum,
                      item.classCode,
                      getStatus
                    );
                    const totalPresentLike = grouped.present.length + grouped.late.length + grouped.excused.length;
                    return (
                      <div key={sessionNum} className="bg-white rounded-xl border border-gray-200 p-3">
                        <div className="font-semibold text-sm text-gray-800">{SESSION_LABELS[sessionNum]}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          ✅ {totalPresentLike} marked present-type • ❌ {grouped.absent.length} absent
                        </div>

                        <div className="mt-2 space-y-2">
                          <div>
                            <div className="text-[11px] font-semibold text-green-700 mb-1">
                              Present ({grouped.present.length})
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {grouped.present.length ? grouped.present.map((student) => (
                                <span key={student.id} className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-800">
                                  {student.roll_no || '—'} • {student.name}
                                </span>
                              )) : (
                                <span className="text-[11px] text-gray-400">None</span>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-[11px] font-semibold text-red-700 mb-1">
                              Absent ({grouped.absent.length})
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {grouped.absent.length ? grouped.absent.map((student) => (
                                <span key={student.id} className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-800">
                                  {student.roll_no || '—'} • {student.name}
                                </span>
                              )) : (
                                <span className="text-[11px] text-gray-400">None</span>
                              )}
                            </div>
                          </div>

                          {(grouped.late.length > 0 || grouped.excused.length > 0) && (
                            <div className="pt-1 border-t border-gray-100">
                              {grouped.late.length > 0 && (
                                <div className="mb-1">
                                  <div className="text-[11px] font-semibold text-amber-700">Late ({grouped.late.length})</div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {grouped.late.map((student) => (
                                      <span key={student.id} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
                                        {student.roll_no || '—'} • {student.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {grouped.excused.length > 0 && (
                                <div>
                                  <div className="text-[11px] font-semibold text-blue-700">Excused ({grouped.excused.length})</div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {grouped.excused.map((student) => (
                                      <span key={student.id} className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800">
                                        {student.roll_no || '—'} • {student.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
