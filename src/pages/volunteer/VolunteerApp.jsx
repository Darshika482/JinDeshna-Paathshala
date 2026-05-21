import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore.js';
import { useStudentStore } from '../../store/useStudentStore.js';
import { useTransactionStore } from '../../store/useTransactionStore.js';
import LanguageToggle from '../../components/common/LanguageToggle.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import OfflineBanner from '../../components/common/OfflineBanner.jsx';
import QrScanner from '../../components/common/QrScanner.jsx';

// Physical coin activities — each award adds 1 coin_count
const COIN_REASONS = [
  { key: 'early_riser',      emoji: '🌅', pts: 5,  type: 'Coin', hi: 'अर्ली राइजर (5 बजे से पहले)' },
  { key: 'yoga_qa',          emoji: '🧘', pts: 5,  type: 'Coin', hi: 'योग - Q&A / भागीदारी' },
  { key: 'yoga_sincerity',   emoji: '🧘', pts: 5,  type: 'Coin', hi: 'योग - लगन / ध्यान' },
  { key: 'poojan_qa',        emoji: '🙏', pts: 5,  type: 'Coin', hi: 'पूजन - Q&A / भागीदारी' },
  { key: 'poojan_sincerity', emoji: '🙏', pts: 5,  type: 'Coin', hi: 'पूजन - लगन' },
  { key: 'kaksha_qa',        emoji: '✋', pts: 5,  type: 'Coin', hi: 'कक्षा - Q&A / उत्तर' },
  { key: 'kaksha_sincerity', emoji: '⭐', pts: 10, type: 'Coin', hi: 'कक्षा - विशेष लगन (+10)' },
  { key: 'kaksha_question',  emoji: '🔍', pts: 5,  type: 'Coin', hi: 'कक्षा - अच्छा प्रश्न' },
  { key: 'samuhik_qa',       emoji: '🏛️', pts: 5,  type: 'Coin', hi: 'सामूहिक कक्षा - Q&A' },
  { key: 'bhakti_sincerity', emoji: '🎵', pts: 5,  type: 'Coin', hi: 'भक्ति - लगन' },
  { key: 'khojooge',         emoji: '🔎', pts: 5,  type: 'Coin', hi: 'खोजोगे तो पाओगे' },
];

// Good Behaviour — digital only, capped at 4 per student per day
const BEHAVIOUR_REASONS = [
  { key: 'self_study',         emoji: '📚', pts: 5, type: 'Behaviour', hi: 'स्वाध्याय' },
  { key: 'helping_others',     emoji: '🤝', pts: 5, type: 'Behaviour', hi: 'दूसरों की मदद' },
  { key: 'cleanliness',        emoji: '✨', pts: 5, type: 'Behaviour', hi: 'व्यक्तिगत साफ-सफाई' },
  { key: 'meal_discipline',    emoji: '🍽', pts: 5, type: 'Behaviour', hi: 'भोजन अनुशासन' },
  { key: 'morning_routine',    emoji: '🛏', pts: 5, type: 'Behaviour', hi: 'सुबह दिनचर्या' },
  { key: 'queue_discipline',   emoji: '🚶', pts: 5, type: 'Behaviour', hi: 'पंक्ति अनुशासन' },
  { key: 'first_ready',        emoji: '⚡', pts: 5, type: 'Behaviour', hi: 'सबसे पहले तैयार' },
  { key: 'diary_writing',      emoji: '📓', pts: 5, type: 'Behaviour', hi: 'सांध्य डायरी' },
  { key: 'wake_up_self',       emoji: '⏰', pts: 5, type: 'Behaviour', hi: 'खुद उठना' },
  { key: 'meditation_posture', emoji: '🕉️', pts: 5, type: 'Behaviour', hi: 'ध्यान मुद्रा' },
  { key: 'encouraging_peers',  emoji: '💪', pts: 5, type: 'Behaviour', hi: 'साथियों को प्रोत्साहन' },
];

// Other digital awards — no physical coin issued
const DIGITAL_REASONS = [
  { key: 'room_discipline',       emoji: '🏠', pts: 5,  type: 'Digital', hi: 'कमरा अनुशासन' },
  { key: 'copy_notes',            emoji: '📝', pts: 5,  type: 'Digital', hi: 'नोट्स - सही' },
  { key: 'copy_decorated',        emoji: '🎨', pts: 10, type: 'Digital', hi: 'नोट्स + सजावट' },
  { key: 'kanth_half',            emoji: '🎤', pts: 10, type: 'Digital', hi: 'कंठ पाठ - आधा' },
  { key: 'kanth_full',            emoji: '🎤', pts: 20, type: 'Digital', hi: 'कंठ पाठ - पूर्ण' },
  { key: 'program_participation', emoji: '🎭', pts: 5,  type: 'Digital', hi: 'कार्यक्रम - भागीदारी' },
  { key: 'program_tough_qa',      emoji: '🏆', pts: 10, type: 'Digital', hi: 'कार्यक्रम - कठिन प्रश्न' },
  { key: 'program_winner',        emoji: '🥇', pts: 20, type: 'Digital', hi: 'कार्यक्रम - विजेता' },
  { key: 'drawing_consolation',   emoji: '🖼️', pts: 10, type: 'Digital', hi: 'चित्र/कहानी - सांत्वना' },
  { key: 'drawing_3rd',           emoji: '🥉', pts: 15, type: 'Digital', hi: 'चित्र/कहानी - तीसरा' },
  { key: 'drawing_2nd',           emoji: '🥈', pts: 20, type: 'Digital', hi: 'चित्र/कहानी - दूसरा' },
  { key: 'drawing_1st',           emoji: '🥇', pts: 25, type: 'Digital', hi: 'चित्र/कहानी - पहला' },
  { key: 'other',                 emoji: '➕', pts: 5,  type: 'Digital', hi: 'अन्य', needsText: true },
];

const DEDUCT_REASONS = [
  { key: 'misbehaviour',         emoji: '😤', pts: 5,  hi: 'दुर्व्यवहार / अशिष्टता' },
  { key: 'fighting',             emoji: '⚡', pts: 5,  hi: 'लड़ाई / विवाद' },
  { key: 'abusive_language',     emoji: '🚫', pts: 10, hi: 'अपशब्द' },
  { key: 'physical_altercation', emoji: '💥', pts: 10, hi: 'मारपीट' },
  { key: 'disrespect',           emoji: '🙅', pts: 5,  hi: 'अनादर' },
  { key: 'entry_mistake',        emoji: '↩️', pts: 5,  hi: 'गलत अंक सुधार', needsText: true },
  { key: 'other',                emoji: '➖', pts: 5,  hi: 'अन्य कारण', needsText: true },
];

const AWARD_CATEGORIES = [
  { key: 'coin',      label: '🪙 Physical Coin', hi: '🪙 सिक्का' },
  { key: 'behaviour', label: '⭐ Good Behaviour', hi: '⭐ व्यवहार' },
  { key: 'digital',   label: '📱 Other Digital',  hi: '📱 अन्य डिजिटल' },
];

const BEHAVIOUR_CAP = 4;
const TABS = ['award', 'duties', 'log'];

export default function VolunteerApp() {
  const { t, i18n } = useTranslation();
  const { currentUser, logout, refreshCurrentUser } = useAuthStore();
  const { search, searchResults } = useStudentStore();
  const {
    recordMentorEntry,
    syncPendingMentorEntries,
    syncingPendingMentorEntries,
    pendingMentorEntries,
    lastSyncError,
    clearPendingMentorEntries,
    currentDay,
    currentSlot,
    transactions,
  } = useTransactionStore();

  const [activeTab, setActiveTab] = useState('award');
  const [query, setQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [action, setAction] = useState(null); // 'give' | 'take'
  const [awardCategory, setAwardCategory] = useState('coin');
  const [selectedReason, setSelectedReason] = useState(null);
  const [otherText, setOtherText] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [step, setStep] = useState(1); // 1=search, 2=action, 3=reason
  const [showQr, setShowQr] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  const isHindi = i18n.language === 'hi';
  const pendingCount = pendingMentorEntries.length;

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    refreshCurrentUser?.();
  }, [refreshCurrentUser]);

  const getBehaviourCountToday = (studentId) =>
    transactions.filter(tx =>
      tx.student_id === studentId &&
      tx.day === currentDay &&
      tx.type === 'Behaviour'
    ).length;

  const behaviourUsed = selectedStudent ? getBehaviourCountToday(selectedStudent.id) : 0;
  const behaviourCapped = behaviourUsed >= BEHAVIOUR_CAP;

  const handleSearch = (val) => {
    setQuery(val);
    search(val);
  };

  const handleQrScan = (text) => {
    setShowQr(false);
    const { students } = useStudentStore.getState();
    const found = students.find(
      s => s.roll_no === text || s.id === text || s.name.toLowerCase() === text.toLowerCase()
    );
    if (found) {
      selectStudent(found);
    } else {
      setQuery(text);
      search(text);
    }
  };

  const selectStudent = (s) => {
    setSelectedStudent(s);
    setQuery('');
    search('');
    setStep(2);
    setAction(null);
    setAwardCategory('coin');
    setSelectedReason(null);
    setOtherText('');
    setSuccessData(null);
  };

  const handleActionSelect = (a) => {
    setAction(a);
    setStep(3);
    setAwardCategory('coin');
    setSelectedReason(null);
    setOtherText('');
  };

  const handleCategorySelect = (cat) => {
    setAwardCategory(cat);
    setSelectedReason(null);
    setOtherText('');
  };

  const handleReasonSelect = (r) => {
    setSelectedReason(r);
    if (!r.needsText) setOtherText('');
  };

  const canSubmit = () => {
    if (!selectedReason) return false;
    if (selectedReason.needsText && !otherText.trim()) return false;
    if (action === 'take' && !otherText.trim()) return false;
    return true;
  };

  const handleConfirm = () => {
    if (!selectedStudent || !selectedReason) return;
    const points = action === 'take' ? -selectedReason.pts : selectedReason.pts;
    const studentSnapshot = selectedStudent;
    const actionSnapshot = action;
    const tx = {
      student_id: selectedStudent.id,
      student_name: selectedStudent.name,
      roll_no: selectedStudent.roll_no || null,
      volunteer_id: currentUser?.id,
      volunteer_name: currentUser?.name,
      activity: selectedReason.needsText
        ? otherText
        : action === 'take' && otherText.trim()
          ? `${t(`reasons.${selectedReason.key}`)}: ${otherText.trim()}`
          : t(`reasons.${selectedReason.key}`),
      type: action === 'take' ? 'Deduction' : selectedReason.type,
      points,
      coin_count: selectedReason.type === 'Coin' && action === 'give' ? 1 : 0,
      day: currentDay,
      slot: currentSlot,
      notes: otherText,
    };

    // Close and reset UI immediately so mobile users can't double-tap confirm
    // while the network call is in flight. Sync happens in the background.
    setConfirmOpen(false);
    setStep(1);
    setSelectedStudent(null);
    setAction(null);
    setSelectedReason(null);
    setOtherText('');
    setSuccessData({ student: studentSnapshot, points, reason: tx.activity, action: actionSnapshot });
    setTimeout(() => setSuccessData(null), 3000);

    recordMentorEntry(tx, points)
      .then(result => {
        if (result?.pending) {
          toast('Saved locally. Will sync when online.', { icon: '📡' });
        }
      })
      .catch(err => {
        console.error('[mentor confirm] failed', err);
        toast.error('Could not record entry. Saved locally.');
      });
  };

  const currentReasons = action === 'take'
    ? DEDUCT_REASONS
    : awardCategory === 'coin'
      ? COIN_REASONS
      : awardCategory === 'behaviour'
        ? BEHAVIOUR_REASONS
        : DIGITAL_REASONS;

  const myLog = (() => {
    const uid = String(currentUser?.id || '');
    const mine = transactions.filter(tx => String(tx.volunteer_id || '') === uid);
    const source = mine.length > 0 || !uid ? mine : transactions;
    return [...source]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 30);
  })();

  const handleClearPending = () => {
    if (pendingMentorEntries.length === 0) return;
    const ok = window.confirm(
      `Permanently delete ${pendingMentorEntries.length} unsynced entries? Points already added locally will be removed. This cannot be undone.`
    );
    if (!ok) return;
    const n = clearPendingMentorEntries();
    toast.success(`Cleared ${n} pending entries locally.`);
  };

  const handleSubmitPending = async () => {
    if (!isOnline) {
      toast.error('No network. Connect to internet and try again.');
      return;
    }
    const before = pendingMentorEntries.length;
    await syncPendingMentorEntries();
    const after = useTransactionStore.getState().pendingMentorEntries.length;
    if (before === 0) return;
    if (after === 0) {
      toast.success('All pending entries synced.');
      return;
    }
    if (after < before) {
      toast.success(`Synced ${before - after} entries. ${after} still pending.`);
      return;
    }
    toast.error(lastSyncError ? `Sync failed: ${lastSyncError}` : 'Could not sync pending entries right now.');
  };

  return (
    <div className="mobile-container flex flex-col">
      <OfflineBanner />

      {/* Header */}
      <div className="bg-forest-700 text-white px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <div>
            <div className="font-bold text-lg leading-tight">{currentUser?.name}</div>
            {currentUser?.assigned_activity && (
              <div className="text-xs text-forest-300 mt-0.5">📌 {currentUser.assigned_activity}</div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${isOnline ? 'bg-green-500/20 border-green-300 text-green-100' : 'bg-red-500/20 border-red-300 text-red-100'}`}>
                {isOnline ? '🟢 Online' : '🔴 Offline'}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${pendingCount > 0 ? 'bg-amber-500/20 border-amber-300 text-amber-100' : 'bg-forest-500/30 border-forest-300 text-forest-100'}`}>
                {pendingCount > 0 ? `⏳ ${pendingCount} pending` : '✓ Synced'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <button
                onClick={handleSubmitPending}
                disabled={syncingPendingMentorEntries || !isOnline}
                className="text-forest-100 text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-500/30 disabled:opacity-50"
              >
                {syncingPendingMentorEntries ? 'Syncing…' : 'Submit Pending'}
              </button>
            )}
            <LanguageToggle compact />
            <button onClick={logout} className="text-forest-300 text-sm px-2 py-1 rounded-lg border border-forest-500">
              {t('auth.logout')}
            </button>
          </div>
        </div>
        {currentUser?.roles?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {currentUser.roles.map(r => (
              <span key={r} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white">{r}</span>
            ))}
            {currentUser.has_deduction_rights && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-400/80 text-white">⚡ Can Deduct</span>
            )}
          </div>
        )}
      </div>

      {/* Success Banner */}
      {successData && (
        <div className={`text-white px-4 py-3 flex items-center gap-3 fade-in ${successData.action === 'give' ? 'bg-green-500' : 'bg-orange-500'}`}>
          <span className="text-2xl">{successData.action === 'give' ? '✅' : '⚠️'}</span>
          <div>
            <div className="font-bold">
              {successData.action === 'give' ? t('volunteer.pointsAwarded') : t('volunteer.pointsDeducted')}
            </div>
            <div className="text-sm opacity-90">
              {`${Math.abs(successData.points)} ${t('common.points')} — ${successData.student.name}`}
            </div>
          </div>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-auto pb-28">
        {activeTab === 'award' && (
          <div className="p-4 max-w-3xl mx-auto">

            {/* Step 1: Search */}
            {step === 1 && (
              <>
                <h2 className="section-header">{t('volunteer.searchStudent')}</h2>

                <button
                  onClick={() => setShowQr(true)}
                  className="w-full mb-3 flex items-center justify-center gap-3 bg-forest-700 text-white rounded-2xl py-4 font-bold text-base active:scale-95 transition-all shadow-md"
                >
                  <span className="text-2xl">📷</span>
                  <span>{t('volunteer.scanQr')}</span>
                  <span className="text-forest-300 text-sm font-normal">QR स्कैन करें</span>
                </button>

                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-medium">OR / या</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <div className="relative mb-2">
                  <input
                    className="input-field pr-10"
                    placeholder={t('volunteer.searchPlaceholder')}
                    value={query}
                    onChange={e => handleSearch(e.target.value)}
                    autoComplete="off"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xl">🔍</span>
                </div>
                {searchResults.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                    {searchResults.map(s => (
                      <button
                        key={s.id}
                        onClick={() => selectStudent(s)}
                        className="w-full text-left px-4 py-3 border-b last:border-0 border-gray-100 hover:bg-forest-50 active:bg-forest-100 transition-colors"
                      >
                        <div className="font-semibold text-gray-900">
                          {isHindi && s.name_hi ? s.name_hi : s.name}
                        </div>
                        {isHindi && s.name_hi && s.name_hi !== s.name && (
                          <div className="text-xs text-gray-400">{s.name}</div>
                        )}
                        <div className="text-sm text-gray-500">
                          {s.roll_no} • {s.batch}{s.class ? ` · ${s.class}` : ''}{s.room_no ? ` · 🏠 ${s.room_no}` : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {query.length >= 2 && searchResults.length === 0 && (
                  <div className="text-center py-8 text-gray-400">{t('common.noResults')}</div>
                )}
              </>
            )}

            {/* Step 2 & 3: Student selected */}
            {step >= 2 && selectedStudent && (
              <>
                <div className="bg-green-50 border-2 border-green-400 rounded-2xl p-4 mb-4 fade-in">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-green-600 font-semibold mb-1">✅ {t('volunteer.studentFound')}</div>
                      <div className="text-xl font-bold text-gray-900">
                        {isHindi && selectedStudent.name_hi ? selectedStudent.name_hi : selectedStudent.name}
                      </div>
                      {isHindi && selectedStudent.name_hi && selectedStudent.name_hi !== selectedStudent.name && (
                        <div className="text-sm text-gray-400">{selectedStudent.name}</div>
                      )}
                      <div className="text-sm text-gray-600 mt-1">
                        {selectedStudent.roll_no} • {selectedStudent.batch}{selectedStudent.class ? ` · ${selectedStudent.class}` : ''}
                        {selectedStudent.room_no && <span className="ml-1 text-amber-600 font-semibold">· 🏠 {selectedStudent.room_no}</span>}
                      </div>
                      <div className="mt-2 text-sm text-gray-500 font-medium">{t('common.scoreHidden')}</div>
                    </div>
                    <button
                      onClick={() => { setStep(1); setSelectedStudent(null); setAction(null); setSelectedReason(null); }}
                      className="text-gray-400 text-lg p-1"
                    >✕</button>
                  </div>
                </div>

                {step === 2 && (
                  <>
                    <h2 className="section-header">{t('volunteer.selectAction')}</h2>
                    <div className="grid grid-cols-2 gap-3 sm:max-w-lg">
                      <button
                        onClick={() => handleActionSelect('give')}
                        className="bg-green-500 text-white rounded-2xl p-6 text-center active:scale-95 transition-all shadow-md"
                      >
                        <div className="text-3xl mb-2">🏆</div>
                        <div className="font-bold text-lg">{t('volunteer.givePoints')}</div>
                        <div className="text-sm opacity-80">पुरस्कार</div>
                      </button>
                      <button
                        onClick={() => handleActionSelect('take')}
                        className="bg-red-500 text-white rounded-2xl p-6 text-center active:scale-95 transition-all shadow-md"
                      >
                        <div className="text-3xl mb-2">⬇️</div>
                        <div className="font-bold text-lg">{t('volunteer.takeAway')}</div>
                        <div className="text-sm opacity-80">कटौती</div>
                      </button>
                    </div>
                  </>
                )}

                {/* Step 3: Reason selection */}
                {step === 3 && action && (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={() => { setStep(2); setAction(null); setSelectedReason(null); }}
                        className="text-forest-600 font-medium text-sm"
                      >
                        ← {t('common.back')}
                      </button>
                      <h2 className="section-header mb-0">
                        {action === 'give' ? t('volunteer.givePoints') : t('volunteer.takeAway')} — {t('volunteer.selectReason')}
                      </h2>
                    </div>

                    {/* Category tabs (give only) */}
                    {action === 'give' && (
                      <div className="flex gap-0 mb-4 border-2 border-gray-200 rounded-xl overflow-hidden">
                        {AWARD_CATEGORIES.map(cat => (
                          <button
                            key={cat.key}
                            onClick={() => handleCategorySelect(cat.key)}
                            className={`flex-1 py-2.5 px-2 text-xs font-semibold transition-colors text-center leading-tight
                              ${awardCategory === cat.key ? 'bg-forest-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            {isHindi ? cat.hi : cat.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Good Behaviour usage indicator */}
                    {action === 'give' && awardCategory === 'behaviour' && (
                      <div className={`mb-3 rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2
                        ${behaviourCapped
                          ? 'bg-orange-100 border border-orange-300 text-orange-700'
                          : 'bg-blue-50 border border-blue-200 text-blue-700'}`}
                      >
                        <span>{behaviourCapped ? '⚠️' : 'ℹ️'}</span>
                        <span>
                          {behaviourCapped
                            ? `Daily cap reached (${BEHAVIOUR_CAP}/${BEHAVIOUR_CAP}). No more Good Behaviour today.`
                            : `Good Behaviour used today: ${behaviourUsed}/${BEHAVIOUR_CAP}`
                          }
                        </span>
                      </div>
                    )}

                    {/* Reason grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
                      {currentReasons.map(r => {
                        const blocked = action === 'give' && r.type === 'Behaviour' && behaviourCapped;
                        return (
                          <button
                            key={r.key}
                            onClick={() => !blocked && handleReasonSelect(r)}
                            disabled={blocked}
                            className={`rounded-2xl p-3 text-center border-2 transition-all active:scale-95
                              ${blocked
                                ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                                : selectedReason?.key === r.key
                                  ? 'border-saffron-500 bg-saffron-50'
                                  : 'border-gray-200 bg-white hover:border-gray-300'}`}
                          >
                            <div className="text-2xl mb-1">{r.emoji}</div>
                            <div className="font-semibold text-sm text-gray-900 leading-tight">{t(`reasons.${r.key}`)}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{r.hi}</div>
                            <div className="flex items-center justify-center gap-1 mt-1">
                              <span className={`text-xs font-bold ${action === 'give' ? 'text-green-600' : 'text-red-600'}`}>
                                {action === 'give' ? '+' : '−'}{r.pts} {t('common.points')}
                              </span>
                              {r.type && action === 'give' && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                                  ${r.type === 'Coin'      ? 'bg-yellow-100 text-yellow-700'
                                  : r.type === 'Behaviour' ? 'bg-purple-100 text-purple-700'
                                  :                          'bg-blue-100 text-blue-700'}`}>
                                  {r.type === 'Coin' ? '🪙' : r.type === 'Behaviour' ? '⭐' : '💻'}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {(selectedReason?.needsText || action === 'take') && selectedReason && (
                      <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {action === 'take'
                            ? <>{t('volunteer.reason')} <span className="text-red-500">*</span></>
                            : <>{t('volunteer.otherReason')} <span className="text-red-500">*</span></>
                          }
                        </label>
                        <textarea
                          className={`input-field resize-none ${action === 'take' && !otherText.trim() ? 'border-red-300' : ''}`}
                          rows={3}
                          placeholder={t('volunteer.otherReasonPlaceholder')}
                          value={otherText}
                          onChange={e => setOtherText(e.target.value)}
                        />
                        {action === 'take' && !otherText.trim() && (
                          <p className="text-red-500 text-xs mt-1">{t('volunteer.reasonRequired')}</p>
                        )}
                      </div>
                    )}

                    <button
                      disabled={!canSubmit()}
                      onClick={() => setConfirmOpen(true)}
                      className={`w-full py-4 rounded-2xl font-bold text-xl text-white transition-all
                        ${canSubmit()
                          ? 'bg-saffron-500 active:scale-95 shadow-lg'
                          : 'bg-gray-300 cursor-not-allowed'}`}
                    >
                      {t('volunteer.confirmAction')} →
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'duties' && (
          <div className="p-4 max-w-3xl mx-auto space-y-4">
            <div className="bg-forest-700 text-white rounded-2xl p-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold flex-shrink-0">
                  {currentUser?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xl leading-tight">{currentUser?.name}</div>
                  {currentUser?.mobile && (
                    <div className="text-forest-300 text-sm mt-0.5">📱 {currentUser.mobile}</div>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(currentUser?.roles || []).map(r => (
                      <span key={r} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20">{r}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {currentUser?.assigned_activity && (
              <div className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-saffron-100 flex items-center justify-center text-xl flex-shrink-0">📌</div>
                <div>
                  <div className="text-xs text-gray-400 font-medium">Assigned Activity</div>
                  <div className="font-bold text-gray-900">{currentUser.assigned_activity}</div>
                </div>
              </div>
            )}

            <div>
              <h3 className="section-header">My Responsibilities</h3>
              {currentUser?.responsibilities?.length > 0 ? (
                <div className="space-y-2">
                  {currentUser.responsibilities.map((r, i) => (
                    <div key={i} className="card p-4 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-saffron-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div className="text-sm text-gray-800 font-medium leading-snug">{r}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card text-center py-8 text-gray-400">
                  <div className="text-3xl mb-2">📋</div>
                  <p className="text-sm">No responsibilities assigned yet.</p>
                  <p className="text-xs mt-1">Contact admin to update your duties.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'log' && (
          <div className="p-4 max-w-3xl mx-auto">
            <h2 className="section-header">{t('nav.log')}</h2>
            {pendingMentorEntries.length > 0 && (
              <div className="mb-3 bg-amber-50 border border-amber-300 rounded-2xl p-3 space-y-2">
                <div className="text-sm text-amber-800 font-medium">
                  {pendingMentorEntries.length} entries pending sync
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSubmitPending}
                    disabled={syncingPendingMentorEntries || !navigator.onLine}
                    className="flex-1 text-xs font-semibold px-3 py-2 rounded-xl bg-amber-600 text-white disabled:opacity-50"
                  >
                    {syncingPendingMentorEntries ? 'Submitting…' : 'Submit now'}
                  </button>
                  <button
                    onClick={handleClearPending}
                    disabled={syncingPendingMentorEntries}
                    className="text-xs font-semibold px-3 py-2 rounded-xl border border-red-300 text-red-600 disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
            {lastSyncError && (
              <div className="mb-3 bg-red-50 border border-red-300 rounded-2xl p-3">
                <div className="text-xs font-semibold text-red-700">Last sync error</div>
                <div className="text-xs text-red-600 mt-1 break-words">{lastSyncError}</div>
              </div>
            )}
            {myLog.length === 0 ? (
              <div className="card text-center py-8 text-gray-400">{t('common.noResults')}</div>
            ) : (
              <div className="space-y-2">
                {myLog.map(tx => (
                  <div key={tx.id} className="card p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{tx.student_name}</div>
                        <div className="text-sm text-gray-500">{tx.activity}</div>
                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                          <span>{new Date(tx.timestamp).toLocaleTimeString()}</span>
                          {tx.sync_status !== 'synced' && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                              Pending sync
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`font-bold text-lg ${tx.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.points > 0 ? '+' : ''}{tx.points}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1rem)] max-w-md">
        <div className="flex rounded-full border border-white/40 bg-white/35 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.18)] px-1.5 py-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-full flex flex-col items-center gap-0.5 transition-all
                ${activeTab === tab
                  ? 'bg-white/70 text-saffron-600 shadow-sm'
                  : 'text-gray-700/80 hover:bg-white/30'}`}
            >
              <span className="text-xl">{tab === 'award' ? '🏆' : tab === 'duties' ? '📌' : '📋'}</span>
              <span className="text-xs font-medium capitalize">
                {tab === 'duties' ? 'Duties' : t(`nav.${tab}`)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {showQr && (
        <QrScanner
          onScan={handleQrScan}
          onClose={() => setShowQr(false)}
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={t('volunteer.confirmAction')}
        message={`${action === 'give' ? t('volunteer.givingPoints') : t('volunteer.takingPoints')} ${selectedReason?.pts} ${t('common.points')} ${t('volunteer.from')} ${selectedStudent?.name} — ${selectedReason ? t(`reasons.${selectedReason.key}`) : ''}${otherText ? ': ' + otherText : ''}`}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
      />
    </div>
  );
}
