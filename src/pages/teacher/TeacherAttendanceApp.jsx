import { useState, useCallback, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore.js';
import { useStudentStore } from '../../store/useStudentStore.js';
import { useAttendanceStore } from '../../store/useAttendanceStore.js';
import { useTransactionStore } from '../../store/useTransactionStore.js';
import LanguageToggle from '../../components/common/LanguageToggle.jsx';
import OfflineBanner from '../../components/common/OfflineBanner.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  present: { label: 'Present', emoji: '✅', badge: 'bg-green-500 text-white',  row: '' },
  absent:  { label: 'Absent',  emoji: '❌', badge: 'bg-red-500 text-white',    row: 'bg-red-50' },
  late:    { label: 'Late',    emoji: '⏰', badge: 'bg-amber-500 text-white',  row: 'bg-amber-50' },
  excused: { label: 'Excused', emoji: '📋', badge: 'bg-blue-400 text-white',   row: 'bg-blue-50' },
};
const STATUSES = ['present', 'absent', 'late', 'excused'];

// Two morning sessions + one afternoon session
const COLUMN_ACCENT = {
  1: { header: 'bg-amber-50 border-amber-200',   tab: 'border-amber-500 text-amber-700',  dot: 'bg-amber-500',  label: 'Morning 1' },
  2: { header: 'bg-orange-50 border-orange-200', tab: 'border-orange-500 text-orange-700', dot: 'bg-orange-500', label: 'Morning 2' },
  3: { header: 'bg-sky-50 border-sky-200',       tab: 'border-sky-500 text-sky-700',       dot: 'bg-sky-500',    label: 'Afternoon' },
};

function normalizeAssignedClasses(user) {
  const fromArray = Array.isArray(user?.assigned_classes)
    ? user.assigned_classes.map(v => String(v || '').trim()).filter(Boolean)
    : [];
  if (fromArray.length) return [...new Set(fromArray)];
  const single = String(user?.assigned_class || '').trim();
  if (!single || ['1', '2', '3'].includes(single)) return [];
  return [single];
}

// Parse the per-session class map from the volunteer record. Falls back to
// repeating the primary assigned class for every session so older teacher
// rows (without a session map) still see all 3 columns populated.
function normalizeSessionClasses(user, fallbackClasses) {
  let raw = user?.session_classes;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { raw = null; }
  }
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      const code = String(v || '').trim();
      if (code) out[String(k)] = code;
    }
  }
  if (!Object.keys(out).length && fallbackClasses?.[0]) {
    out['1'] = fallbackClasses[0];
    out['2'] = fallbackClasses[0];
    out['3'] = fallbackClasses[0];
  }
  return out;
}

// ─── Student Row ──────────────────────────────────────────────────────────────

// Approximate dropdown height (4 rows × 44px + padding). Used to decide
// whether to flip the menu above the trigger when a row is near the bottom
// of the scroll container.
const DROPDOWN_HEIGHT_PX = 200;

function StudentRow({ student, classNum, classCode, onStatusChange, isLocked }) {
  const getStatus = useAttendanceStore(s => s.getStatus);
  const status = getStatus(student.id, classNum, classCode);
  const cfg = STATUS_CONFIG[status];
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const buttonRef = useRef(null);

  // Decide which direction to open before showing the menu so the last
  // student in a class can still mark Absent / Late / Excused.
  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const scrollParent = buttonRef.current.closest('.overflow-y-auto');
      const bottomBoundary = scrollParent
        ? scrollParent.getBoundingClientRect().bottom
        : window.innerHeight;
      const spaceBelow = bottomBoundary - rect.bottom;
      setOpenUpward(spaceBelow < DROPDOWN_HEIGHT_PX);
    }
    setOpen(o => !o);
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-100 transition-colors ${cfg.row || 'bg-gray-50/60'}`}>
      <span className="text-xs text-gray-400 font-mono w-10 flex-shrink-0">{student.roll_no}</span>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-gray-900 truncate leading-tight">{student.name}</div>
        {student.group && <div className="text-xs text-gray-400 mt-0.5">Group {student.group}</div>}
      </div>

      <div className="relative flex-shrink-0">
        <button
          ref={buttonRef}
          disabled={isLocked}
          onClick={handleToggle}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95
            ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'} ${cfg.badge}`}
        >
          <span>{cfg.emoji}</span>
          <span className="hidden sm:inline">{cfg.label}</span>
          {!isLocked && <span className="opacity-60 text-[10px]">▾</span>}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div
              className={`absolute right-0 ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'} bg-white rounded-xl shadow-xl border border-gray-200 z-20 w-36 overflow-hidden animate-dropdown`}
            >
              {STATUSES.map(s => {
                const c = STATUS_CONFIG[s];
                return (
                  <button
                    key={s}
                    onClick={() => { onStatusChange(student.id, student.name, s); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors
                      ${status === s ? 'bg-gray-50 font-semibold' : ''}`}
                  >
                    <span>{c.emoji}</span>
                    <span className="text-gray-800">{c.label}</span>
                    {status === s && <span className="ml-auto text-forest-600 text-xs">✓</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Class Column ─────────────────────────────────────────────────────────────

function ClassColumn({
  classNum,
  students,
  sessionClassCode,
  currentUser,
  currentDay,
  isDesktop,
  onToggleFullscreen,
  isFullscreen,
}) {
  const store = useAttendanceStore();
  const { addPoints } = useStudentStore();
  const { addTransaction } = useTransactionStore();

  const [search, setSearch] = useState('');
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const label = store.sessionLabels[classNum];
  const submission = store.getSubmission(classNum, sessionClassCode);
  const editable = store.canEdit(classNum, sessionClassCode);
  const isLocked = !!submission && !editable;
  const accent = COLUMN_ACCENT[classNum];

  const filtered = (() => {
    const q = search.toLowerCase().trim();
    if (!q) return students;
    return students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.name_hi && s.name_hi.includes(search)) ||
      s.roll_no.toLowerCase().includes(q) ||
      (s.group && s.group.toLowerCase().includes(q))
    );
  })();

  const stats = store.getStats(classNum, sessionClassCode, students);

  const handleStatusChange = useCallback((studentId, studentName, status) => {
    if (!sessionClassCode) {
      toast.error('Session is unassigned. Cannot mark attendance.');
      return;
    }
    const ok = store.setStatus(
      studentId,
      studentName,
      classNum,
      sessionClassCode,
      status,
      currentUser?.id,
      currentUser?.name,
      currentDay
    );
    if (!ok) toast.error('Grace period ended. Attendance is locked.');
  }, [store, classNum, sessionClassCode, currentUser, currentDay]);

  const handleSubmit = async () => {
    if (!sessionClassCode) {
      toast.error('Session is unassigned. Ask admin to set a class for this session.');
      return;
    }
    if (isLocked) { toast.error('Attendance is locked after the 30-minute grace period.'); return; }
    setSubmitting(true);
    try {
      const { wasAlreadySubmitted, pointsAwarded } = await store.submitClass(
        classNum,
        sessionClassCode,
        currentUser?.id,
        currentUser?.name
      );
      if (!pointsAwarded) {
        let awarded = 0;
        for (const student of students) {
          if (store.getStatus(student.id, classNum, sessionClassCode) === 'present') {
            await addPoints(student.id, 5, currentDay);
            await addTransaction({
              student_id: student.id,
              student_name: student.name,
              volunteer_id: currentUser?.id,
              volunteer_name: currentUser?.name,
              activity: `Attendance — Class ${sessionClassCode} (${label})`,
              type: 'Digital',
              points: 5,
              coin_count: 0,
              day: currentDay,
              slot: classNum,
            });
            awarded++;
          }
        }
        store.markPointsAwarded(classNum, sessionClassCode);
        toast.success(
          wasAlreadySubmitted
            ? `Class ${sessionClassCode} re-submitted. Points already awarded.`
            : `Class ${sessionClassCode} submitted! +5 pts to ${awarded} present students.`,
          { duration: 4000 }
        );
      } else {
        toast.success(`Class ${sessionClassCode} re-submitted.`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const saveLabel = () => {
    if (labelDraft.trim()) store.setSessionLabel(classNum, labelDraft.trim());
    setEditingLabel(false);
  };

  return (
    <div className="flex flex-col bg-white rounded-2xl shadow-md border border-gray-100 h-full min-h-0">
      {/* Column header */}
      <div className={`rounded-t-2xl px-3.5 py-3 md:p-4 border-b flex-shrink-0 ${accent.header}`}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${accent.dot}`} />
          <span className="font-bold text-gray-800 text-base">Class {classNum}</span>
          {sessionClassCode ? (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/80 text-saffron-700 border border-saffron-200">
              📚 {sessionClassCode}
            </span>
          ) : (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/80 text-gray-500 border border-gray-200">
              Unassigned
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={onToggleFullscreen}
              className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
              title={isFullscreen ? 'Exit fullscreen panel' : 'Open fullscreen panel'}
            >
              {isFullscreen ? '🗗' : '⛶'}
            </button>
            {!isLocked && (
              <button
                onClick={() => { setEditingLabel(true); setLabelDraft(label); }}
                className="text-gray-400 hover:text-gray-600 text-sm transition-colors"
                title="Rename session"
              >✏️</button>
            )}
            {isLocked && (
              <span className="text-xs font-semibold text-gray-400 flex items-center gap-1">🔒 Locked</span>
            )}
          </div>
        </div>

        {editingLabel ? (
          <div className="flex gap-1.5 mt-1.5">
            <input
              className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:border-saffron-500"
              value={labelDraft}
              onChange={e => setLabelDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveLabel(); if (e.key === 'Escape') setEditingLabel(false); }}
              autoFocus
            />
            <button onClick={saveLabel} className="text-green-600 font-semibold text-sm px-2">Save</button>
            <button onClick={() => setEditingLabel(false)} className="text-gray-400 text-sm px-1">✕</button>
          </div>
        ) : (
          <div className="text-xs text-gray-500 ml-3.5">{label}</div>
        )}

        <div className="flex flex-wrap gap-1.5 mt-2.5">
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">✅ {stats.present}</span>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">❌ {stats.absent}</span>
          {stats.late > 0 && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">⏰ {stats.late}</span>}
          {stats.excused > 0 && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">📋 {stats.excused}</span>}
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500">/ {stats.total}</span>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pt-2.5 pb-2 flex-shrink-0">
        <div className="relative">
          <input
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:border-saffron-500 placeholder:text-gray-400"
            placeholder="Search name, roll no, or group…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search ? (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">✕</button>
          ) : (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
          )}
        </div>
        {search && <div className="text-xs text-gray-400 mt-1 px-1">{filtered.length} of {students.length} students</div>}
      </div>

      {/* Student list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 space-y-1.5 pb-2">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            {search
              ? 'No students match your search.'
              : sessionClassCode
                ? `No students in class ${sessionClassCode}.`
                : 'This session is unassigned. Ask admin to set a class for this session.'}
          </div>
        ) : (
          filtered.map(student => (
            <StudentRow
              key={student.id}
              student={student}
              classNum={classNum}
              classCode={sessionClassCode}
              onStatusChange={handleStatusChange}
              isLocked={isLocked}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 flex-shrink-0">
        {submission ? (
          <div className={`rounded-xl p-3 text-center ${editable ? 'bg-green-50 border border-green-200' : 'bg-gray-100 border border-gray-200'}`}>
            <div className="text-sm font-bold text-green-700">✓ Class {classNum} attendance submitted</div>
            <div className="text-xs text-gray-500 mt-0.5">at {format(new Date(submission.submittedAt), 'h:mm a')}</div>
            {editable && (
              <>
                <div className="text-xs text-amber-600 mt-1">Grace period active — edits allowed</div>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="mt-2 text-xs font-semibold text-forest-700 border border-forest-300 rounded-lg px-3 py-1.5 hover:bg-forest-50 active:scale-95 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Updating…' : 'Re-submit'}
                </button>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary w-full py-3 text-base disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : `Submit Class ${classNum} Attendance`}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceTab({
  studentsBySession,
  sessionClasses,
  loading,
  currentUser,
  currentDay,
  hasAnyAssignment,
}) {
  const store = useAttendanceStore();
  const [activeClass, setActiveClass] = useState(1);
  const [fullscreenClass, setFullscreenClass] = useState(null);

  const toggleFullscreen = (classNum) => {
    setFullscreenClass((prev) => (prev === classNum ? null : classNum));
  };

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === 'Escape') setFullscreenClass(null);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  const columnFor = (n) => ({
    students: studentsBySession[n] || [],
    sessionClassCode: sessionClasses[String(n)] || '',
    currentUser,
    currentDay,
    onToggleFullscreen: () => toggleFullscreen(n),
    isFullscreen: fullscreenClass === n,
  });

  return (
    <>
      {!loading && !hasAnyAssignment && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center bg-white border border-gray-200 rounded-2xl p-6 max-w-md">
            <div className="text-3xl mb-2">📚</div>
            <div className="font-semibold text-gray-800">No sessions assigned</div>
            <div className="text-sm text-gray-500 mt-1">
              Ask admin to set a class for at least one session in your teacher profile
              (Session 1 / 2 / 3 → student class).
            </div>
          </div>
        </div>
      )}

      {/* Desktop-only "Today's Sessions" pill row. On mobile we keep just
          the session tab bar below to avoid duplicate chrome eating into
          the student list. */}
      {!loading && hasAnyAssignment && (
        <div className="hidden md:block px-4 pt-3 pb-2 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Today's Sessions
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map(n => {
              const code = sessionClasses[String(n)];
              const acc = COLUMN_ACCENT[n];
              return (
                <span
                  key={n}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                    code
                      ? 'bg-saffron-50 border-saffron-200 text-saffron-800'
                      : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${acc.dot}`} />
                  {acc.label}: {code || 'Unassigned'}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile class tab bar */}
      <div className="md:hidden bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex">
          {[1, 2, 3].map(n => {
            const acc = COLUMN_ACCENT[n];
            const active = activeClass === n;
            const code = sessionClasses[String(n)];
            const submission = store.getSubmission(n, code);
            return (
              <button
                key={n}
                onClick={() => setActiveClass(n)}
                className={`flex-1 py-2.5 px-2 text-center border-b-2 transition-colors ${active ? acc.tab : 'border-transparent text-gray-400'}`}
              >
                <div className={`text-sm font-bold ${active ? '' : 'text-gray-500'}`}>{acc.label}</div>
                <div className="text-[11px] mt-0.5 font-semibold opacity-80 truncate">
                  {code || '—'}
                </div>
                {submission && <div className="text-xs mt-0.5 text-green-600 font-semibold">✓</div>}
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400 text-center">
            <div className="text-3xl mb-2">⏳</div>
            <div className="text-sm">Loading students…</div>
          </div>
        </div>
      )}

      {!loading && hasAnyAssignment && (
        <>
          {/* Desktop: 3 columns side-by-side. Using flex (not grid) so each
              column actually clamps to the available viewport height — grid
              auto-rows were letting the row grow with content, which made
              the inner list `overflow-y-auto` never get a bounded height
              and so it never showed a scrollbar. */}
          <div className="hidden md:flex flex-1 min-h-0 gap-4 px-4 lg:px-6 py-4 mx-auto w-full max-w-[1600px]">
            {[1, 2, 3].map(n => (
              <div key={n} className="flex-1 min-w-0 min-h-0 flex flex-col">
                <ClassColumn classNum={n} {...columnFor(n)} isDesktop />
              </div>
            ))}
          </div>
          {/* Mobile: active column. pb-24 gives the floating tab dock at
              the bottom enough room so it never covers the Submit button
              or the last student row. */}
          <div className="md:hidden flex-1 min-h-0 overflow-hidden px-3 pt-3 pb-24">
            <ClassColumn classNum={activeClass} {...columnFor(activeClass)} isDesktop={false} />
          </div>
        </>
      )}

      {fullscreenClass && !loading && hasAnyAssignment && (
        <div className="fixed inset-0 z-50 bg-black/45 p-2 sm:p-4 md:p-6">
          <div className="h-full max-w-[1400px] mx-auto">
            <ClassColumn classNum={fullscreenClass} {...columnFor(fullscreenClass)} isDesktop />
          </div>
        </div>
      )}
    </>
  );
}

// ─── My Info Tab ──────────────────────────────────────────────────────────────

function MyInfoTab({ currentUser }) {
  const store = useAttendanceStore();
  const todayStr = format(new Date(), 'EEEE, d MMMM yyyy');
  const assignedClasses = normalizeAssignedClasses(currentUser);
  const sessionClasses = normalizeSessionClasses(currentUser, assignedClasses);
  const sessionResponsibilities = [1, 2, 3]
    .map(n => {
      const code = sessionClasses[String(n)];
      if (!code) return null;
      return `📚 ${COLUMN_ACCENT[n].label}: Class ${code} teaching`;
    })
    .filter(Boolean);

  // Hide legacy class responsibility lines like "Class BA3 teaching" because
  // per-session class assignments are now the source of truth.
  const extraResponsibilities = (currentUser?.responsibilities || []).filter(
    r => !/class\s+[a-z]+\d+/i.test(String(r || ''))
  );

  const totalSubmitted = [1, 2, 3].filter(n => store.getSubmission(n, sessionClasses[String(n)])).length;

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-28 max-w-2xl mx-auto w-full space-y-4">
      {/* Identity card */}
      <div className="bg-forest-700 text-white rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold flex-shrink-0">
            {currentUser?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xl leading-tight">{currentUser?.name}</div>
            {currentUser?.mobile && <div className="text-forest-300 text-sm mt-0.5">📱 {currentUser.mobile}</div>}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(currentUser?.roles || []).map(r => (
                <span key={r} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20">{r}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Today's summary */}
      <div className="card p-4">
        <div className="text-xs text-gray-400 font-medium mb-3 uppercase tracking-wide">Today — {todayStr}</div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(n => {
            const acc = COLUMN_ACCENT[n];
            const code = sessionClasses[String(n)];
            const submission = store.getSubmission(n, code);
            return (
              <div key={n} className={`rounded-xl p-3 text-center border ${submission ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${acc.dot}`} />
                <div className="text-xs font-bold text-gray-700">{acc.label}</div>
                <div className="text-[11px] font-semibold text-saffron-700 mt-0.5">
                  {code ? `📚 ${code}` : '—'}
                </div>
                <div className={`mt-1.5 text-xs font-semibold ${submission ? 'text-green-600' : 'text-gray-400'}`}>
                  {submission ? `✓ ${format(new Date(submission.submittedAt), 'h:mm a')}` : 'Pending'}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-center text-sm text-gray-500">
          <span className="font-semibold text-forest-700">{totalSubmitted}/3</span> sessions submitted today
        </div>
      </div>

      {/* Per-session class assignment */}
      {assignedClasses.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-saffron-100 flex items-center justify-center text-xl flex-shrink-0">📚</div>
            <div className="min-w-0">
              {assignedClasses.length > 0 && (
                <>
                  <div className="text-xs text-gray-400 font-medium">Per-Session Class Assignment</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {[1, 2, 3].map(n => {
                      const code = sessionClasses[String(n)];
                      return (
                        <span
                          key={n}
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            code
                              ? 'bg-saffron-50 border-saffron-200 text-saffron-800'
                              : 'bg-gray-50 border-gray-200 text-gray-400'
                          }`}
                        >
                          {COLUMN_ACCENT[n].label}: {code || '—'}
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Responsibilities */}
      {(sessionResponsibilities.length > 0 || extraResponsibilities.length > 0) && (
        <div>
          <h3 className="section-header">My Responsibilities</h3>
          <div className="space-y-2">
            {sessionResponsibilities.map((r, i) => (
              <div key={`session-${i}`} className="card p-4 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-saffron-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
                <div className="text-sm text-gray-800 font-medium leading-snug">{r}</div>
              </div>
            ))}
            {extraResponsibilities.map((r, i) => (
              <div key={i} className="card p-4 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-saffron-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{sessionResponsibilities.length + i + 1}</div>
                <div className="text-sm text-gray-800 font-medium leading-snug">{r}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'attendance', label: 'Attendance', emoji: '📋' },
  { key: 'myinfo',     label: 'My Info',    emoji: '👤' },
];

export default function TeacherAttendanceApp() {
  const { currentUser, logout } = useAuthStore();
  const { students, loading } = useStudentStore();
  const { currentDay } = useTransactionStore();
  const { fetchAttendance } = useAttendanceStore();

  const [activeTab, setActiveTab] = useState('attendance');

  useEffect(() => { fetchAttendance(); }, []);

  const assignedClassOptions = normalizeAssignedClasses(currentUser);
  const sessionClasses = normalizeSessionClasses(currentUser, assignedClassOptions);
  const teacherClassList = [...new Set(
    [1, 2, 3]
      .map(n => String(sessionClasses[String(n)] || '').trim())
      .filter(Boolean)
  )];

  const studentsBySession = (() => {
    const cache = new Map();
    const out = {};
    for (const n of [1, 2, 3]) {
      const code = sessionClasses[String(n)];
      if (!code) { out[n] = []; continue; }
      if (!cache.has(code)) {
        cache.set(code, students.filter(s => String(s.class || '').trim() === code));
      }
      out[n] = cache.get(code);
    }
    return out;
  })();

  const hasAnyAssignment = [1, 2, 3].some(n => sessionClasses[String(n)]);

  const todayStr = format(new Date(), 'EEEE, d MMMM yyyy');

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <OfflineBanner />

      {/* Header */}
      <div className="bg-forest-700 text-white px-3 md:px-4 py-2.5 md:py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2 max-w-[1600px] mx-auto w-full">
          <div className="min-w-0">
            <div className="font-bold text-base md:text-lg leading-tight truncate">{currentUser?.name || 'Teacher'}</div>
            <div className="text-forest-200 text-[11px] md:text-sm mt-0.5 truncate">
              <span className="md:hidden">Teacher Portal</span>
              <span className="hidden md:inline">{todayStr}</span>
            </div>
          </div>

          {/* Desktop tab switcher (phones use the floating dock) */}
          <div className="hidden md:flex items-center gap-1 bg-forest-800/60 rounded-full p-1 border border-forest-500/40">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  activeTab === tab.key
                    ? 'bg-white text-forest-700'
                    : 'text-forest-200 hover:text-white'
                }`}
              >
                <span className="mr-1.5">{tab.emoji}</span>{tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
            <LanguageToggle compact />
            <button
              onClick={logout}
              className="text-forest-200 hover:text-white text-xs md:text-sm px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg border border-forest-500 hover:bg-forest-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
        {/* Secondary line: only show extra labels on desktop where there's room.
            On mobile the session tab bar already shows class assignments. */}
        <div className="hidden md:block max-w-[1600px] mx-auto w-full mt-1">
          <div className="text-forest-300 text-xs font-medium tracking-wide uppercase">Teacher Portal</div>
          <div className="text-forest-200 text-sm mt-0.5">
            📚 {teacherClassList.length ? `Classes: ${teacherClassList.join(', ')}` : 'Classes: Unassigned'}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'attendance' && (
          <AttendanceTab
            studentsBySession={studentsBySession}
            sessionClasses={sessionClasses}
            loading={loading}
            currentUser={currentUser}
            currentDay={currentDay}
            hasAnyAssignment={hasAnyAssignment}
          />
        )}
        {activeTab === 'myinfo' && (
          <MyInfoTab currentUser={currentUser} />
        )}
      </div>

      {/* Bottom tab bar — phone-only. On md+ it covers the column footers
          (the Submit button / lock card) so we hide it for desktop. */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1rem)] max-w-xs md:hidden">
        <div className="flex rounded-full border border-white/40 bg-white/35 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.18)] px-1.5 py-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 rounded-full flex flex-col items-center gap-0.5 transition-all
                ${activeTab === tab.key
                  ? 'bg-white/70 text-saffron-600 shadow-sm'
                  : 'text-gray-700/80 hover:bg-white/30'}`}
            >
              <span className="text-xl">{tab.emoji}</span>
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
