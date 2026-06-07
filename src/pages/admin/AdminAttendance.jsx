import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase.js';
import { useStudentStore } from '../../store/useStudentStore.js';
import { usePathshalaStore } from '../../store/usePathshalaStore.js';
import { useTransactionStore } from '../../store/useTransactionStore.js';
import { useConfigStore, DEFAULT_BATCH_CLASSES } from '../../store/useConfigStore.js';
import {
  getCampTotalDays,
  getDateForCampDay,
  getAttendanceDateForToday,
} from '../../lib/campDates.js';

const STATUS_BADGE = {
  present: 'bg-green-100 text-green-800 border-green-200',
  absent: 'bg-red-100 text-red-800 border-red-200',
  late: 'bg-amber-100 text-amber-800 border-amber-200',
  excused: 'bg-blue-100 text-blue-800 border-blue-200',
  unmarked: 'bg-gray-100 text-gray-600 border-gray-200',
};

function escapeCSV(val) {
  return `"${String(val ?? '').replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]
  ));
}

function parsePaathshalaClassCode(code) {
  const m = String(code || '').match(/^P(.+?)::(.+)$/);
  if (!m) return null;
  return { paathshalaCode: m[1], eventId: m[2] };
}

function isPaathshalaCode(code) {
  return /^P.+::.+$/.test(String(code || ''));
}

function matchesSearch(text, q) {
  return String(text || '').toLowerCase().includes(q);
}

function groupMatchesSearch(group, q, type) {
  if (!q) return true;
  if (type === 'class') {
    if (matchesSearch(group.classCode, q)) return true;
    if (group.classStudents?.some((s) =>
      matchesSearch(s.name, q) || matchesSearch(s.roll_no, q)
    )) return true;
  }
  if (type === 'paathshala') {
    if (matchesSearch(group.paathshalaName, q) || matchesSearch(group.paathshalaCode, q)) return true;
    if (group.myStudents?.some((s) =>
      matchesSearch(s.name, q) || matchesSearch(s.roll_no, q)
    )) return true;
  }
  return group.sessions.some((session) =>
    matchesSearch(session.label, q) ||
    matchesSearch(session.teacher, q) ||
    session.rows.some((row) =>
      matchesSearch(row.student_name, q) ||
      matchesSearch(row.roll_no, q)
    )
  );
}

function buildStudentStatuses(students, sessionRows) {
  const statusByStudent = new Map(
    (sessionRows || []).map((row) => [row.student_id, row.status || 'present'])
  );
  return [...(students || [])]
    .sort((a, b) => String(a.roll_no || '').localeCompare(String(b.roll_no || ''), undefined, { numeric: true }))
    .map((student) => ({
      id: student.id,
      roll_no: student.roll_no || '—',
      name: student.name || '—',
      status: statusByStudent.get(student.id) || 'unmarked',
    }));
}

function filterStudentsByQuery(students, q) {
  if (!q) return students;
  return students.filter((s) =>
    matchesSearch(s.name, q) || matchesSearch(s.roll_no, q) || matchesSearch(s.status, q)
  );
}

function SessionAttendanceCard({ session, students, isOpen, onToggle, searchQuery }) {
  const roster = useMemo(
    () => filterStudentsByQuery(buildStudentStatuses(students, session.rows), searchQuery),
    [students, session.rows, searchQuery]
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-slate-50 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-3 text-left hover:bg-slate-100/80 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <span className={`text-gray-400 text-xs mt-1 transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-800">{session.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">Teacher: {session.teacher}</div>
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
            session.submitted ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {session.submitted ? 'Submitted' : 'Pending'}
          </span>
        </div>
        <div className="mt-2 ml-5 flex flex-wrap gap-1.5 text-[11px]">
          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800">✅ {session.counts.present || 0}</span>
          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800">❌ {session.counts.absent || 0}</span>
          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Unmarked {session.unmarked}</span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-gray-200 bg-white px-3 py-2 max-h-64 overflow-y-auto">
          {roster.length ? roster.map((student) => (
            <div
              key={student.id}
              className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0"
            >
              <span className="text-[11px] font-mono text-gray-400 w-12 flex-shrink-0">{student.roll_no}</span>
              <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">{student.name}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize flex-shrink-0 ${
                STATUS_BADGE[student.status] || STATUS_BADGE.unmarked
              }`}>
                {student.status}
              </span>
            </div>
          )) : (
            <div className="text-xs text-gray-400 py-3 text-center">No students match your search.</div>
          )}
        </div>
      )}
    </div>
  );
}

function CollapsibleAttendanceGroup({
  groupKey,
  title,
  subtitle,
  students,
  sessions,
  isGroupOpen,
  onToggleGroup,
  openSessions,
  onToggleSession,
  searchQuery,
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggleGroup}
        className="w-full px-4 py-3 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-2 text-left hover:bg-gray-100/80 transition-colors"
        aria-expanded={isGroupOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-gray-400 text-sm transition-transform ${isGroupOpen ? 'rotate-90' : ''}`}>▶</span>
          <div className="font-semibold text-gray-900 truncate">{title}</div>
        </div>
        <div className="text-xs text-gray-500">{subtitle}</div>
      </button>

      {isGroupOpen && (
        <div className="p-4 space-y-2">
          {sessions.map((session) => {
            const sessionKey = `${groupKey}::${session.sessionNum}`;
            return (
              <SessionAttendanceCard
                key={sessionKey}
                session={session}
                students={students}
                isOpen={openSessions.has(sessionKey)}
                onToggle={() => onToggleSession(sessionKey)}
                searchQuery={searchQuery}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function downloadCSV(filename, headers, rows) {
  const csv = [headers, ...rows].map((row) => row.map(escapeCSV).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportPDF(title, headers, rows) {
  const win = window.open('', '_blank');
  if (!win) return;
  const thead = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const tbody = rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>
      body{font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;margin:24px;}
      h1{font-size:18px;margin:0 0 2px;color:#14532d;}
      .meta{font-size:11px;color:#6b7280;margin-bottom:14px;}
      table{width:100%;border-collapse:collapse;font-size:11px;}
      th{background:#14532d;color:#fff;text-align:left;padding:7px 9px;}
      td{padding:6px 9px;border-bottom:1px solid #e5e7eb;}
      tr:nth-child(even) td{background:#f9fafb;}
      @media print{button{display:none;}}
    </style></head><body>
    <button onclick="window.print()">Print / Save as PDF</button>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">Generated ${new Date().toLocaleString('en-IN')} · ${rows.length} rows</div>
    <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
    </body></html>`);
  win.document.close();
  win.focus();
}

export default function AdminAttendance() {
  const { students, fetchStudents } = useStudentStore();
  const { paathshalas, students: pathStudents, fetchPathashalas } = usePathshalaStore();
  const { currentDay } = useTransactionStore();
  const batchClasses = useConfigStore((s) => s.batchClasses) || DEFAULT_BATCH_CLASSES;

  const [selectedDay, setSelectedDay] = useState(currentDay || 1);
  const [activeTab, setActiveTab] = useState('summary');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [classEvents, setClassEvents] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const [expandedSessions, setExpandedSessions] = useState(() => new Set());

  const selectedDate = getDateForCampDay(selectedDay);
  const campInfo = getAttendanceDateForToday();

  useEffect(() => {
    setSelectedDay(currentDay || 1);
  }, [currentDay]);

  useEffect(() => {
    fetchStudents();
    fetchPathashalas();
  }, [fetchStudents, fetchPathashalas]);

  useEffect(() => {
    let alive = true;
    supabase
      .from('events')
      .select('id,name,time_slot,sort_order')
      .eq('is_active', true)
      .eq('event_type', 'class')
      .order('sort_order')
      .order('name')
      .then(({ data }) => { if (alive) setClassEvents(data || []); });
    return () => { alive = false; };
  }, []);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: attRows, error: attErr }, { data: subRows, error: subErr }] = await Promise.all([
        supabase.from('attendance').select('*').eq('date', selectedDate),
        supabase.from('attendance_submissions').select('*').eq('date', selectedDate),
      ]);
      if (attErr) throw attErr;
      if (subErr) throw subErr;
      setRecords(attRows || []);
      setSubmissions(subRows || []);
    } catch (err) {
      toast.error(err?.message || 'Failed to load attendance.');
      setRecords([]);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const eventById = useMemo(() => {
    const map = new Map();
    classEvents.forEach((ev, i) => map.set(ev.id, { ...ev, sessionNum: i + 1 }));
    return map;
  }, [classEvents]);

  const paathshalaByCode = useMemo(() => {
    const map = new Map();
    paathshalas.forEach((p) => map.set(String(p.paathshala_code || ''), p));
    return map;
  }, [paathshalas]);

  const studentById = useMemo(() => {
    const map = new Map();
    [...students, ...pathStudents].forEach((s) => map.set(s.id, s));
    return map;
  }, [students, pathStudents]);

  const classCodes = useMemo(() => {
    const fromBatch = Object.values(batchClasses).flat();
    const fromStudents = students.map((s) => String(s.class || '').trim()).filter(Boolean);
    return [...new Set([...fromBatch, ...fromStudents])]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students, batchClasses]);

  const sessionLabel = (sessionNum) => {
    const ev = classEvents[Number(sessionNum) - 1];
    if (!ev) return `Session ${sessionNum}`;
    return ev.time_slot ? `${ev.name} · ${ev.time_slot}` : ev.name;
  };

  const enrichedRows = useMemo(() => records.map((row) => {
    const student = studentById.get(row.student_id);
    const code = String(row.class_code || '').trim();
    const parsed = parsePaathshalaClassCode(code);
    const type = isPaathshalaCode(code) ? 'paathshala' : 'class';
    const event = parsed ? eventById.get(parsed.eventId) : null;
    const paathshala = parsed ? paathshalaByCode.get(parsed.paathshalaCode) : null;
    return {
      ...row,
      type,
      roll_no: student?.roll_no || '',
      student_class: student?.class || '',
      paathshala_name: paathshala?.paathshala_name || parsed?.paathshalaCode || '',
      session_label: event
        ? (event.time_slot ? `${event.name} · ${event.time_slot}` : event.name)
        : sessionLabel(row.class_num),
    };
  }), [records, studentById, eventById, paathshalaByCode, classEvents]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = enrichedRows;
    if (activeTab === 'class') rows = rows.filter((r) => r.type === 'class');
    if (activeTab === 'paathshala') rows = rows.filter((r) => r.type === 'paathshala');
    if (!q) return rows;
    return rows.filter((r) =>
      String(r.student_name || '').toLowerCase().includes(q) ||
      String(r.roll_no || '').toLowerCase().includes(q) ||
      String(r.class_code || '').toLowerCase().includes(q) ||
      String(r.paathshala_name || '').toLowerCase().includes(q) ||
      String(r.session_label || '').toLowerCase().includes(q)
    );
  }, [enrichedRows, activeTab, query]);

  const stats = useMemo(() => {
    const present = enrichedRows.filter((r) => r.status === 'present').length;
    const absent = enrichedRows.filter((r) => r.status === 'absent').length;
    const late = enrichedRows.filter((r) => r.status === 'late').length;
    const excused = enrichedRows.filter((r) => r.status === 'excused').length;
    const classCount = enrichedRows.filter((r) => r.type === 'class').length;
    const pathCount = enrichedRows.filter((r) => r.type === 'paathshala').length;
    return {
      total: enrichedRows.length,
      present,
      absent,
      late,
      excused,
      submissions: submissions.length,
      classCount,
      pathCount,
    };
  }, [enrichedRows, submissions]);

  const classGroups = useMemo(() => {
    const groups = new Map();
    classCodes.forEach((classCode) => {
      const classStudents = students.filter((s) => String(s.class || '').trim() === classCode);
      const sessions = classEvents.map((ev, i) => {
        const sessionNum = i + 1;
        const rows = enrichedRows.filter(
          (r) => r.type === 'class' && r.class_code === classCode && Number(r.class_num) === sessionNum
        );
        const sub = submissions.find(
          (s) => s.class_code === classCode && Number(s.class_num) === sessionNum
        );
        return {
          sessionNum,
          label: ev.time_slot ? `${ev.name} · ${ev.time_slot}` : ev.name,
          rows,
          submitted: !!sub,
          submittedAt: sub?.submitted_at,
          teacher: sub?.teacher_name || rows[0]?.teacher_name || '—',
          counts: rows.reduce((acc, r) => {
            acc[r.status] = (acc[r.status] || 0) + 1;
            return acc;
          }, {}),
          unmarked: Math.max(0, classStudents.length - rows.length),
        };
      });
      groups.set(classCode, { classCode, classStudents, sessions });
    });
    return groups;
  }, [classCodes, students, classEvents, enrichedRows, submissions]);

  const paathshalaGroups = useMemo(() => {
    const groups = new Map();
    paathshalas.forEach((p) => {
      const code = String(p.paathshala_code || '');
      const myStudents = pathStudents.filter((s) => String(s.paathshala_code || '') === code);
      const sessions = classEvents.map((ev, i) => {
        const classCode = `P${code}::${ev.id}`;
        const sessionNum = i + 1;
        const rows = enrichedRows.filter(
          (r) => r.type === 'paathshala' && r.class_code === classCode
        );
        const sub = submissions.find((s) => s.class_code === classCode);
        return {
          sessionNum,
          label: ev.time_slot ? `${ev.name} · ${ev.time_slot}` : ev.name,
          rows,
          submitted: !!sub,
          submittedAt: sub?.submitted_at,
          teacher: sub?.teacher_name || rows[0]?.teacher_name || '—',
          counts: rows.reduce((acc, r) => {
            acc[r.status] = (acc[r.status] || 0) + 1;
            return acc;
          }, {}),
          unmarked: Math.max(0, myStudents.length - rows.length),
        };
      });
      groups.set(code, {
        paathshalaCode: code,
        paathshalaName: p.paathshala_name,
        myStudents,
        sessions,
      });
    });
    return groups;
  }, [paathshalas, pathStudents, classEvents, enrichedRows, submissions]);

  const exportRows = filteredRows.map((r) => [
    r.type === 'paathshala' ? 'Paathshala' : 'Class',
    r.roll_no || '—',
    r.student_name || '—',
    r.type === 'paathshala' ? r.paathshala_name : r.class_code,
    r.session_label,
    r.status,
    r.teacher_name || '—',
  ]);

  const handleExportCSV = () => {
    downloadCSV(
      `attendance-day-${selectedDay}-${selectedDate}.csv`,
      ['Type', 'Roll No', 'Name', 'Class / Paathshala', 'Session', 'Status', 'Teacher'],
      exportRows
    );
  };

  const handleExportPDF = () => {
    exportPDF(
      `Attendance — Day ${selectedDay} (${selectedDate})`,
      ['Type', 'Roll No', 'Name', 'Class / Paathshala', 'Session', 'Status', 'Teacher'],
      exportRows
    );
  };

  const TABS = [
    { key: 'summary', label: 'Summary' },
    { key: 'class', label: 'Class Attendance' },
    { key: 'paathshala', label: 'Paathshala Attendance' },
    { key: 'records', label: 'All Records' },
  ];

  const searchPlaceholder = {
    summary: 'Search name, roll no, class, paathshala…',
    class: 'Search class, session, teacher, student…',
    paathshala: 'Search paathshala, session, teacher, student…',
    records: 'Search name, roll no, class, paathshala…',
  }[activeTab];

  const q = query.trim().toLowerCase();
  const filteredClassGroups = useMemo(
    () => [...classGroups.values()].filter((g) => groupMatchesSearch(g, q, 'class')),
    [classGroups, q]
  );
  const filteredPaathshalaGroups = useMemo(
    () => [...paathshalaGroups.values()].filter((g) => groupMatchesSearch(g, q, 'paathshala')),
    [paathshalaGroups, q]
  );

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSession = (key) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (!q) return;
    const sessionKeys = new Set();
    const groupKeys = new Set();
    const groups = activeTab === 'class' ? filteredClassGroups : filteredPaathshalaGroups;
    groups.forEach((group) => {
      const groupKey = group.classCode || group.paathshalaCode;
      groupKeys.add(groupKey);
      group.sessions.forEach((session) => {
        const sessionKey = `${groupKey}::${session.sessionNum}`;
        const roster = buildStudentStatuses(
          group.classStudents || group.myStudents,
          session.rows
        );
        const sessionMatch =
          matchesSearch(session.label, q) ||
          matchesSearch(session.teacher, q);
        const studentMatch = roster.some((s) =>
          matchesSearch(s.name, q) || matchesSearch(s.roll_no, q)
        );
        if (sessionMatch || studentMatch) {
          sessionKeys.add(sessionKey);
          groupKeys.add(groupKey);
        }
      });
    });
    setExpandedGroups((prev) => new Set([...prev, ...groupKeys]));
    setExpandedSessions((prev) => new Set([...prev, ...sessionKeys]));
  }, [q, activeTab, filteredClassGroups, filteredPaathshalaGroups]);

  return (
    <div className="p-3 sm:p-6 space-y-4 bg-slate-50 min-h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Attendance</h2>
          <p className="text-xs text-gray-500 mt-1">
            Class and Paathshala attendance synced from teacher submissions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={!exportRows.length}
            className="px-3 py-1.5 rounded-xl bg-forest-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            ⬇ CSV
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={!exportRows.length}
            className="px-3 py-1.5 rounded-xl bg-saffron-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            ⬇ PDF
          </button>
          <button
            type="button"
            onClick={loadAttendance}
            className="px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Camp day</div>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(Number(e.target.value))}
            className="mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm"
          >
            {Array.from({ length: getCampTotalDays() }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                Day {day} — {getDateForCampDay(day)}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-gray-700">
          <span className="font-semibold">Calendar date:</span>{' '}
          {format(new Date(selectedDate), 'EEEE, d MMMM yyyy')}
        </div>
        {selectedDay === (campInfo.day || currentDay) && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            campInfo.active ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {campInfo.active ? 'Camp active today' : 'Camp not active today'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'Marked', val: stats.total, color: 'text-forest-700' },
          { label: 'Present', val: stats.present, color: 'text-green-700' },
          { label: 'Absent', val: stats.absent, color: 'text-red-700' },
          { label: 'Class rows', val: stats.classCount, color: 'text-saffron-700' },
          { label: 'Paathshala rows', val: stats.pathCount, color: 'text-violet-700' },
          { label: 'Submissions', val: stats.submissions, color: 'text-blue-700' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
            <div className={`text-2xl font-semibold leading-none ${s.color}`}>{s.val}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="inline-flex rounded-2xl border border-gray-200 bg-white p-1 shadow-sm flex-wrap gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
              activeTab === tab.key ? 'bg-saffron-600 text-white' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative max-w-xl">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
        <input
          className="w-full border border-gray-300 rounded-xl pl-9 pr-8 py-2.5 text-sm bg-white shadow-sm focus:outline-none focus:border-saffron-500"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 px-1"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading attendance…</div>
      ) : activeTab === 'summary' ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900">Class sessions</h3>
            <p className="text-xs text-gray-500 mt-1">{classEvents.length} active class events</p>
            <div className="mt-3 space-y-2">
              {classEvents.map((ev, i) => {
                const count = enrichedRows.filter(
                  (r) => r.type === 'class' && Number(r.class_num) === i + 1
                ).length;
                const subs = submissions.filter(
                  (s) => !isPaathshalaCode(s.class_code) && Number(s.class_num) === i + 1
                ).length;
                return (
                  <div key={ev.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate">{ev.name}</div>
                      <div className="text-xs text-gray-500">{ev.time_slot || 'No time set'}</div>
                    </div>
                    <div className="text-xs text-gray-600 text-right">
                      <div>{count} marked</div>
                      <div>{subs} submitted</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900">Recent records</h3>
            <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
              {filteredRows.slice(0, 12).map((row) => (
                <div key={row.id} className="flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-2">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_BADGE[row.status] || STATUS_BADGE.unmarked}`}>
                    {row.status}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{row.student_name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {row.type === 'paathshala' ? row.paathshala_name : row.class_code} · {row.session_label}
                    </div>
                  </div>
                </div>
              ))}
              {!filteredRows.length && (
                <div className="text-sm text-gray-400 py-6 text-center">No attendance records for this day.</div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'class' ? (
        <div className="space-y-4">
          {filteredClassGroups.map((group) => (
            <CollapsibleAttendanceGroup
              key={group.classCode}
              groupKey={group.classCode}
              title={`Class ${group.classCode}`}
              subtitle={`${group.classStudents.length} students`}
              students={group.classStudents}
              sessions={group.sessions}
              isGroupOpen={expandedGroups.has(group.classCode)}
              onToggleGroup={() => toggleGroup(group.classCode)}
              openSessions={expandedSessions}
              onToggleSession={toggleSession}
              searchQuery={q}
            />
          ))}
          {!filteredClassGroups.length && (
            <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-200">
              {q ? 'No classes match your search.' : 'No class data for this day.'}
            </div>
          )}
        </div>
      ) : activeTab === 'paathshala' ? (
        <div className="space-y-4">
          {filteredPaathshalaGroups.map((group) => (
            <CollapsibleAttendanceGroup
              key={group.paathshalaCode}
              groupKey={group.paathshalaCode}
              title={group.paathshalaName}
              subtitle={`${group.myStudents.length} students`}
              students={group.myStudents}
              sessions={group.sessions}
              isGroupOpen={expandedGroups.has(group.paathshalaCode)}
              onToggleGroup={() => toggleGroup(group.paathshalaCode)}
              openSessions={expandedSessions}
              onToggleSession={toggleSession}
              searchQuery={q}
            />
          ))}
          {!filteredPaathshalaGroups.length && (
            <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-200">
              {q ? 'No paathshalas match your search.' : 'No paathshala data for this day.'}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Type', 'Roll', 'Name', 'Class / Paathshala', 'Session', 'Status', 'Teacher'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 capitalize">{row.type}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{row.roll_no || '—'}</td>
                    <td className="px-4 py-2.5">{row.student_name}</td>
                    <td className="px-4 py-2.5">{row.type === 'paathshala' ? row.paathshala_name : row.class_code}</td>
                    <td className="px-4 py-2.5">{row.session_label}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_BADGE[row.status] || STATUS_BADGE.unmarked}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{row.teacher_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredRows.length && (
            <div className="text-center py-12 text-gray-400">No attendance records for this day.</div>
          )}
        </div>
      )}
    </div>
  );
}
