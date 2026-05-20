import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStudentStore } from '../../store/useStudentStore.js';
import toast from 'react-hot-toast';
import LanguageToggle from '../../components/common/LanguageToggle.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import { getTeacherNameForClass } from '../../lib/classTeachers.js';

const CHECK_IN_PASSWORD = '123';
const TABS = ['All', 'Pending', 'Checked In'];
const GENDER_FILTERS = ['All', 'Boy', 'Girl'];
const CHECKIN_SESSION_KEY = 'shivir-checkin-session';

function PasswordGate({ onUnlock, onBack }) {
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (pwd === CHECK_IN_PASSWORD) {
      onUnlock();
    } else {
      setError('Wrong password. Try again.');
      setPwd('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 w-full max-w-sm text-center">
        <button
          onClick={onBack}
          className="mb-4 text-sm font-semibold text-forest-700 hover:text-forest-800 inline-flex items-center gap-2"
        >
          ← Back
        </button>
        <div className="text-5xl mb-4">🎫</div>
        <h1 className="text-xl font-bold text-forest-700 mb-1">Check-In Station</h1>
        <p className="text-sm text-gray-500 mb-6">Enter password to continue</p>
        <input
          type="password"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-center text-lg tracking-widest
                     focus:outline-none focus:border-saffron-500 mb-3"
          placeholder="••••"
          value={pwd}
          onChange={e => { setPwd(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          autoFocus
        />
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <button
          onClick={submit}
          className="w-full bg-forest-700 text-white font-semibold py-3 rounded-xl hover:bg-forest-800 transition-colors"
        >
          Enter
        </button>
      </div>
    </div>
  );
}

function StudentProfileModal({ student, onClose, onCheckIn, onToggleKitGiven, lastCheckedId, isHindi }) {
  const isIn = student.checked_in;
  const justDone = lastCheckedId === student.id;
  const displayName = isHindi && student.name_hi ? student.name_hi : student.name;
  const displayTeacher = isHindi
    ? (student.group_hi || getTeacherNameForClass(student.class, true) || student.group || '')
    : (student.group || getTeacherNameForClass(student.class, false) || student.group_hi || '');
  const initials = student.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl fade-in overflow-hidden">
        {/* Header strip */}
        <div className={`px-6 pt-6 pb-4 ${isIn ? 'bg-green-50' : 'bg-forest-50'}`}>
          <div className="flex justify-between items-start mb-4">
            <div className={`text-xs font-bold px-3 py-1 rounded-full ${isIn ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
              {isIn ? '✓ Checked In' : 'Not Checked In'}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            >✕</button>
          </div>

          {/* Photo / Avatar */}
          <div className="flex flex-col items-center">
            {student.photo_url ? (
              <img
                src={student.photo_url}
                alt={student.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
              />
            ) : (
              <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-md border-4 border-white
                ${isIn ? 'bg-green-500' : 'bg-forest-700'}`}>
                {initials}
              </div>
            )}
            <h2 className="mt-3 text-xl font-bold text-gray-900">{displayName}</h2>
            {isHindi && student.name_hi && student.name_hi !== student.name && (
              <div className="text-sm text-gray-400 mt-0.5">{student.name}</div>
            )}
            <div className="text-sm text-gray-500 font-mono mt-0.5">{student.roll_no}</div>
          </div>
        </div>

        {/* Details */}
        <div className="px-6 py-4 space-y-3">
          {/* Badges row */}
          <div className="flex flex-wrap gap-2">
            {student.batch && (
              <span className="bg-forest-100 text-forest-700 px-3 py-1 rounded-full text-sm font-semibold">
                📚 {student.batch}
              </span>
            )}
            {student.room_no && (
              <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-semibold">
                🏠 Room {student.room_no}
              </span>
            )}
            {student.class && (
              <span className="bg-saffron-100 text-saffron-700 px-3 py-1 rounded-full text-sm font-semibold">
                🎓 Class {student.class}
              </span>
            )}
            {student.gender && (
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                {student.gender === 'Boy' ? '👦' : '👧'} {student.gender}
              </span>
            )}
            {student.age && (
              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-semibold">
                Age {student.age}
              </span>
            )}
            {student.class && (
              <span className="bg-saffron-100 text-saffron-700 px-3 py-1 rounded-full text-sm font-semibold">
                Class {student.class}
              </span>
            )}
            {student.prev_shivir && (
              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-semibold">
                ⭐ Prev Shivir
              </span>
            )}
          </div>
          {displayTeacher && (
            <div className="text-xs text-gray-500">Teacher: {displayTeacher}</div>
          )}

          {/* Health alert */}
          {student.health_issue && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <div className="flex items-center gap-2 text-red-700 font-semibold text-sm mb-1">
                ⚠️ Health Note
              </div>
              <p className="text-xs text-red-600">{student.health_detail || 'Has a health concern — check with parents'}</p>
            </div>
          )}

          {/* Info rows */}
          <div className="space-y-2 pt-1">
            {student.parent_name && (
              <div className="flex items-center gap-3">
                <span className="text-lg w-6 text-center">👨</span>
                <div>
                  <div className="text-xs text-gray-400 font-medium">Father</div>
                  <div className="text-sm font-semibold text-gray-800">{student.parent_name}</div>
                </div>
              </div>
            )}
            {student.mother_name && (
              <div className="flex items-center gap-3">
                <span className="text-lg w-6 text-center">👩</span>
                <div>
                  <div className="text-xs text-gray-400 font-medium">Mother</div>
                  <div className="text-sm font-semibold text-gray-800">{student.mother_name}</div>
                </div>
              </div>
            )}
            {student.mobile && (
              <div className="flex items-center gap-3">
                <span className="text-lg w-6 text-center">📱</span>
                <div>
                  <div className="text-xs text-gray-400 font-medium">Mobile</div>
                  <div className="text-sm font-semibold text-gray-800">{student.mobile}</div>
                </div>
              </div>
            )}
          </div>

          {/* Kit Given */}
          <div className={`flex items-center justify-between p-3 rounded-xl border-2 ${student.kit_given ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'}`}>
            <div>
              <div className="text-xs text-gray-500 font-medium">Kit Status</div>
              <div className={`text-sm font-bold ${student.kit_given ? 'text-green-700' : 'text-amber-700'}`}>
                {student.kit_given ? '✅ Kit Given' : '📦 Kit Pending'}
              </div>
            </div>
            <button
              onClick={() => onToggleKitGiven(student)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors
                ${student.kit_given
                  ? 'bg-green-200 text-green-800 hover:bg-green-300'
                  : 'bg-amber-500 text-white hover:bg-amber-600'}`}
            >
              {student.kit_given ? 'Undo' : 'Mark Given'}
            </button>
          </div>
        </div>

        {/* Check-in button */}
        <div className="px-6 pb-6">
          <button
            onClick={() => { onCheckIn(student.id); }}
            className={`w-full py-3 rounded-xl font-bold text-base transition-all active:scale-95
              ${justDone ? 'ring-2 ring-green-400 ring-offset-2' : ''}
              ${isIn
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-saffron-500 text-white hover:bg-saffron-600'}`}
          >
            {isIn ? '✓ Already Checked In — Undo?' : '🎫 Check In Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckInApp({ onBack, onLogout }) {
  const { students, checkIn, toggleKitGiven } = useStudentStore();
  const { i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('Pending');
  const [genderFilter, setGenderFilter] = useState('All');
  const [lastCheckedId, setLastCheckedId] = useState(null);
  const [profileStudent, setProfileStudent] = useState(null);
  const [pendingCheckIn, setPendingCheckIn] = useState(null);
  const inputRef = useRef(null);

  const checkedCount = students.filter(s => s.checked_in).length;
  const checkedInBoys = students.filter(s => s.checked_in && String(s.gender || '').toLowerCase() === 'boy').length;
  const checkedInGirls = students.filter(s => s.checked_in && String(s.gender || '').toLowerCase() === 'girl').length;
  const totalBoys = students.filter(s => String(s.gender || '').toLowerCase() === 'boy').length;
  const totalGirls = students.filter(s => String(s.gender || '').toLowerCase() === 'girl').length;
  const total = students.length;
  const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

  const baseList = students.filter(s => {
    if (tab === 'Checked In' && !s.checked_in) return false;
    if (tab === 'Pending' && s.checked_in) return false;
    if (genderFilter !== 'All' && String(s.gender || '').toLowerCase() !== genderFilter.toLowerCase()) return false;
    return true;
  });

  const q = query.trim().toLowerCase();
  const searchHits = q.length >= 2
    ? baseList.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.mobile && s.mobile.includes(q)) ||
        s.roll_no.toLowerCase().includes(q)
      )
    : [];

  const tabList = baseList;
  const visibleCount = q.length >= 2 ? searchHits.length : tabList.length;

  const handleCheckIn = (id) => {
    checkIn(id);
    setLastCheckedId(id);
    setTimeout(() => setLastCheckedId(null), 2000);
  };

  const requestCheckIn = (student) => {
    setPendingCheckIn({
      id: student.id,
      name: student.name,
      isIn: student.checked_in,
    });
  };

  const confirmCheckIn = () => {
    if (!pendingCheckIn) return;
    handleCheckIn(pendingCheckIn.id);
    setPendingCheckIn(null);
  };

  const handleToggleKitGiven = async (student) => {
    const result = await toggleKitGiven(student.id);
    if (!result?.success) {
      toast.error(result?.error || 'Failed to update kit status');
      return;
    }
    toast.success(student.kit_given ? 'Kit marked pending' : 'Kit marked given');
  };

  // Keep profileStudent in sync with store (so checked_in status updates live)
  const liveProfileStudent = profileStudent
    ? students.find(s => s.id === profileStudent.id) || null
    : null;

  const StudentCard = ({ student }) => {
    const isIn = student.checked_in;
    const justDone = lastCheckedId === student.id;
    const displayName = isHindi && student.name_hi ? student.name_hi : student.name;
    const displayTeacher = isHindi
      ? (student.group_hi || getTeacherNameForClass(student.class, true) || student.group || '')
      : (student.group || getTeacherNameForClass(student.class, false) || student.group_hi || '');
    return (
      <div className={`rounded-2xl border-2 p-4 flex items-center gap-4 transition-all
        ${isIn ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}
        ${justDone ? 'ring-2 ring-green-400 ring-offset-1' : ''}`}
      >
        <div
          className={`flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center font-bold text-white text-xs cursor-pointer hover:opacity-80 transition-opacity
            ${isIn ? 'bg-green-500' : 'bg-forest-700'}`}
          onClick={() => setProfileStudent(student)}
        >
          <span className="text-[10px] opacity-80">Roll</span>
          <span className="text-sm leading-tight text-center px-1">{student.roll_no}</span>
        </div>
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setProfileStudent(student)}
        >
          <div className="font-bold text-gray-900 text-base truncate hover:text-forest-700 transition-colors">
            {displayName}
            {student.health_issue && <span className="ml-1 text-red-500 text-xs">⚠️</span>}
          </div>
          {isHindi && student.name_hi && student.name_hi !== student.name && (
            <div className="text-xs text-gray-400 truncate">{student.name}</div>
          )}
          <div className="text-sm text-gray-600 mt-0.5 truncate">
            {student.batch}{student.class ? ` · ${student.class}` : ''}{student.room_no ? ` · Room ${student.room_no}` : ''}{student.gender ? ` · ${student.gender}` : ''}{student.age ? ` · Age ${student.age}` : ''}
          </div>
          {displayTeacher && (
            <div className="text-xs text-gray-400 mt-0.5 truncate">Teacher: {displayTeacher}</div>
          )}
          {student.parent_name && (
            <div className="text-xs text-gray-400 mt-0.5 truncate">👨 {student.parent_name}</div>
          )}
        </div>
        <button
          onClick={() => requestCheckIn(student)}
          className={`flex-shrink-0 px-4 py-2 rounded-xl font-semibold text-sm transition-all active:scale-95
            ${isIn
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-saffron-500 text-white hover:bg-saffron-600'}`}
        >
          {isIn ? '✓ Done' : '🎫 Check In'}
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-forest-700 text-white px-4 py-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-white/90 hover:text-white text-sm font-semibold mr-1"
          aria-label="Back to role selection"
        >
          ← Back
        </button>
        <span className="text-2xl">🎫</span>
        <div>
          <h1 className="font-bold text-lg leading-tight">{isHindi ? 'चेक-इन स्टेशन' : 'Check-In Station'}</h1>
          <p className="text-xs text-forest-300">{isHindi ? 'वितरण' : 'Wristband Distribution'}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={onLogout}
            className="text-white/90 hover:text-white text-xs font-semibold px-2.5 py-1 rounded-lg border border-white/30"
          >
            Logout
          </button>
          <LanguageToggle compact />
          <div className="text-right">
            <div className="font-bold text-lg">{checkedCount}/{total}</div>
            <div className="text-xs text-forest-300">{pct}% done</div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="h-2 bg-forest-900">
        <div
          className="h-full bg-green-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
          <input
            ref={inputRef}
            className="w-full border-2 border-gray-200 rounded-2xl pl-11 pr-10 py-3 text-base
                       focus:outline-none focus:border-saffron-500 bg-white shadow-sm"
            placeholder="Type name or mobile number…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-gray-500 px-1">
          <span>Showing {visibleCount} of {baseList.length} students</span>
          <span>
            Checked In: 👦 {checkedInBoys} • 👧 {checkedInGirls}
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {GENDER_FILTERS.map((g) => (
            <button
              key={g}
              onClick={() => setGenderFilter(g)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${
                genderFilter === g
                  ? 'bg-saffron-500 text-white border-saffron-500'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
              }`}
            >
              {g === 'Boy'
                ? `👦 Boys (${checkedInBoys}/${totalBoys})`
                : g === 'Girl'
                  ? `👧 Girls (${checkedInGirls}/${totalGirls})`
                  : `All (${checkedCount}/${total})`}
            </button>
          ))}
        </div>

        {/* Search results */}
        {q.length >= 2 ? (
          <div className="space-y-2">
            {searchHits.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-gray-400">
                No student found for "{query}" with current filters
              </div>
            ) : (
              searchHits.map(s => <StudentCard key={s.id} student={s} />)
            )}
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {TABS.map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-all
                    ${tab === t
                      ? 'bg-forest-700 text-white border-forest-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'}`}
                >
                  {t === 'Checked In' ? `✓ Checked In (${checkedCount})` :
                   t === 'Pending'    ? `⏳ Pending (${total - checkedCount})` :
                   `All (${total})`}
                </button>
              ))}
            </div>

            {/* Student list */}
            <div className="space-y-2">
              {tabList.map(s => <StudentCard key={s.id} student={s} />)}
              {tabList.length === 0 && (
                <div className="text-center text-gray-400 py-10">
                  {tab === 'Checked In' ? 'No one checked in yet.' : 'All students are checked in! 🎉'}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Profile Modal */}
      {liveProfileStudent && (
        <StudentProfileModal
          student={liveProfileStudent}
          onClose={() => setProfileStudent(null)}
          onCheckIn={() => requestCheckIn(liveProfileStudent)}
          onToggleKitGiven={handleToggleKitGiven}
          lastCheckedId={lastCheckedId}
          isHindi={isHindi}
        />
      )}

      <ConfirmDialog
        open={!!pendingCheckIn}
        title={pendingCheckIn?.isIn ? 'Undo Check-In?' : 'Confirm Check-In?'}
        message={pendingCheckIn ? `${pendingCheckIn.name} ${pendingCheckIn.isIn ? 'is already checked in. Do you want to undo this check-in?' : 'will be marked as checked in.'}` : ''}
        onConfirm={confirmCheckIn}
        onCancel={() => setPendingCheckIn(null)}
        confirmLabel={pendingCheckIn?.isIn ? 'Undo' : 'Check In'}
      />
    </div>
  );
}

export default function AdminCheckIn() {
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(CHECKIN_SESSION_KEY) === 'true');

  const handleUnlock = () => {
    localStorage.setItem(CHECKIN_SESSION_KEY, 'true');
    setUnlocked(true);
  };

  const handleLogout = () => {
    localStorage.removeItem(CHECKIN_SESSION_KEY);
    setUnlocked(false);
    navigate('/login');
  };

  const goBack = () => navigate('/login');
  if (!unlocked) return <PasswordGate onUnlock={handleUnlock} onBack={goBack} />;
  return <CheckInApp onBack={goBack} onLogout={handleLogout} />;
}
