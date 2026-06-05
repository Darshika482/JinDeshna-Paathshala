import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore.js';
import { useStudentStore } from '../../store/useStudentStore.js';
import { useTransactionStore } from '../../store/useTransactionStore.js';
import { usePointReasonsStore } from '../../store/usePointReasonsStore.js';
import { supabase } from '../../lib/supabase.js';
import LanguageToggle from '../../components/common/LanguageToggle.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import OfflineBanner from '../../components/common/OfflineBanner.jsx';
import QrScanner from '../../components/common/QrScanner.jsx';

const TABS = ['award', 'competitions', 'duties', 'log'];

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
  const {
    loading: reasonsLoading,
    fetch: fetchReasons,
    getGiveCategories,
    getTakeCategory,
    getReasonsForCategory,
  } = usePointReasonsStore();
  const [competitionOptions, setCompetitionOptions] = useState([]);
  const [competitionsLoading, setCompetitionsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('award');
  const [query, setQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [action, setAction] = useState(null); // 'give' | 'take'
  const [awardCategory, setAwardCategory] = useState(null); // category ID from DB
  const [selectedReason, setSelectedReason] = useState(null);
  const [otherText, setOtherText] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [step, setStep] = useState(1); // 1=search, 2=action, 3=reason
  const [showQr, setShowQr] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  // Competitions tab state
  const [compStep, setCompStep] = useState(1); // 1=select competition, 2=select students
  const [compSelectedStudents, setCompSelectedStudents] = useState([]);
  const [compQuery, setCompQuery] = useState('');
  const [compConfirmComp, setCompConfirmComp] = useState(null);
  const [compSuccess, setCompSuccess] = useState(null);
  const [compSubmitting, setCompSubmitting] = useState(false);

  const isHindi = i18n.language === 'hi';
  const pendingCount = pendingMentorEntries.length;

  const giveCategories = getGiveCategories();
  const takeCategory = getTakeCategory();
  const behaviourCategory = giveCategories.find(c => c.tx_type === 'Behaviour');
  const BEHAVIOUR_CAP = behaviourCategory?.behaviour_cap ?? 4;

  useEffect(() => { fetchReasons(); }, [fetchReasons]);

  // Competition list: Operations → Events where event_type = "competition" only.
  useEffect(() => {
    let cancelled = false;
    async function loadCompetitions() {
      setCompetitionsLoading(true);
      const { data } = await supabase
        .from('events')
        .select('id,name,time_slot,event_type,is_active,sort_order,points_per_coin')
        .eq('event_type', 'competition')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');

      if (cancelled) return;

      setCompetitionOptions(
        (data || []).map((ev) => ({
          id: ev.id,
          name: ev.name,
          name_hi: null,
          time_slot: ev.time_slot || '',
          points: Number(ev.points_per_coin) > 0 ? Number(ev.points_per_coin) : 10,
          sort_order: Number(ev.sort_order) || 0,
        })).sort(
          (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        )
      );
      setCompetitionsLoading(false);
    }
    loadCompetitions();
    return () => { cancelled = true; };
  }, []);

  // Set initial awardCategory to first give category once loaded
  useEffect(() => {
    if (giveCategories.length > 0 && !awardCategory) {
      setAwardCategory(giveCategories[0].id);
    }
  }, [giveCategories, awardCategory]);

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
    setAwardCategory(giveCategories[0]?.id || null);
    setSelectedReason(null);
    setOtherText('');
    setSuccessData(null);
  };

  const handleActionSelect = (a) => {
    setAction(a);
    setStep(3);
    setAwardCategory(giveCategories[0]?.id || null);
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
    if (!r.needs_text) setOtherText('');
  };

  const canSubmit = () => {
    if (!selectedReason) return false;
    if (selectedReason.needs_text && !otherText.trim()) return false;
    if (action === 'take' && !otherText.trim()) return false;
    return true;
  };

  const handleConfirm = () => {
    if (!selectedStudent || !selectedReason) return;
    const points = action === 'take' ? -selectedReason.pts : selectedReason.pts;
    const studentSnapshot = selectedStudent;
    const actionSnapshot = action;
    const selectedCat = giveCategories.find(c => c.id === awardCategory);
    const txType = action === 'take' ? 'Deduction' : (selectedCat?.tx_type || 'Digital');
    const activityLabel = selectedReason.label_en;
    const tx = {
      student_id: selectedStudent.id,
      student_name: selectedStudent.name,
      roll_no: selectedStudent.roll_no || null,
      volunteer_id: currentUser?.id,
      volunteer_name: currentUser?.name,
      activity: selectedReason.needs_text
        ? otherText
        : action === 'take' && otherText.trim()
          ? `${activityLabel}: ${otherText.trim()}`
          : activityLabel,
      type: txType,
      points,
      coin_count: txType === 'Coin' && action === 'give' ? 1 : 0,
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
    ? (takeCategory ? getReasonsForCategory(takeCategory.id) : [])
    : (awardCategory ? getReasonsForCategory(awardCategory) : []);

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
                        {giveCategories.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => handleCategorySelect(cat.id)}
                            className={`flex-1 py-2.5 px-2 text-xs font-semibold transition-colors text-center leading-tight
                              ${awardCategory === cat.id ? 'bg-forest-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            {isHindi && cat.label_hi ? cat.label_hi : cat.label_en}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Good Behaviour usage indicator */}
                    {action === 'give' && awardCategory === behaviourCategory?.id && (
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
                    {reasonsLoading && !currentReasons.length ? (
                      <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>
                    ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
                      {currentReasons.map(r => {
                        const blocked = action === 'give' && awardCategory === behaviourCategory?.id && behaviourCapped;
                        const selectedCatTxType = giveCategories.find(c => c.id === awardCategory)?.tx_type;
                        return (
                          <button
                            key={r.id}
                            onClick={() => !blocked && handleReasonSelect(r)}
                            disabled={blocked}
                            className={`rounded-2xl p-3 text-center border-2 transition-all active:scale-95
                              ${blocked
                                ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                                : selectedReason?.id === r.id
                                  ? 'border-saffron-500 bg-saffron-50'
                                  : 'border-gray-200 bg-white hover:border-gray-300'}`}
                          >
                            <div className="text-2xl mb-1">{r.emoji}</div>
                            <div className="font-semibold text-sm text-gray-900 leading-tight">{r.label_en}</div>
                            {r.label_hi && <div className="text-xs text-gray-500 mt-0.5">{r.label_hi}</div>}
                            <div className="flex items-center justify-center gap-1 mt-1">
                              <span className={`text-xs font-bold ${action === 'give' ? 'text-green-600' : 'text-red-600'}`}>
                                {action === 'give' ? '+' : '−'}{r.pts} {t('common.points')}
                              </span>
                              {selectedCatTxType && action === 'give' && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                                  ${selectedCatTxType === 'Coin'      ? 'bg-yellow-100 text-yellow-700'
                                  : selectedCatTxType === 'Behaviour' ? 'bg-purple-100 text-purple-700'
                                  :                                      'bg-blue-100 text-blue-700'}`}>
                                  {selectedCatTxType === 'Coin' ? '🪙' : selectedCatTxType === 'Behaviour' ? '⭐' : '💻'}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    )}

                    {(selectedReason?.needs_text || action === 'take') && selectedReason && (
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

        {activeTab === 'competitions' && (
          <div className="p-4 max-w-3xl mx-auto">
            {compSuccess && (
              <div className="bg-green-500 text-white px-4 py-3 flex items-center gap-3 rounded-2xl mb-4 fade-in">
                <span className="text-2xl">🥇</span>
                <div>
                  <div className="font-bold">Competition points awarded!</div>
                  <div className="text-sm opacity-90">+{compSuccess.points} pts each — {compSuccess.count} student{compSuccess.count !== 1 ? 's' : ''} — {compSuccess.compName}</div>
                </div>
              </div>
            )}

            {/* Step 1: Select competition */}
            {compStep === 1 && (
              <>
                <h2 className="section-header">Select Competition</h2>
                {competitionsLoading && (
                  <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-gray-200">
                    Loading competitions…
                  </div>
                )}
                {!competitionsLoading && competitionOptions.length === 0 && (
                  <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-gray-200">
                    No competition events found. Ask admin to add events with type <strong>Competition</strong> in Operations.
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {competitionOptions.map(comp => (
                    <button
                      key={comp.id}
                      onClick={() => {
                        setCompConfirmComp(comp);
                        setCompSelectedStudents([]);
                        setCompQuery('');
                        search('');
                        setCompSuccess(null);
                        setCompStep(2);
                      }}
                      className="rounded-2xl p-4 text-left border-2 border-gray-200 bg-white hover:border-saffron-400 hover:bg-saffron-50 active:scale-95 transition-all shadow-sm"
                    >
                      <div className="font-bold text-gray-900 text-base">🥇 {comp.name}</div>
                      {comp.name_hi && <div className="text-sm text-gray-500 mt-0.5">{comp.name_hi}</div>}
                      {comp.time_slot && <div className="text-xs text-gray-400 mt-0.5">{comp.time_slot}</div>}
                      <div className="font-bold text-green-600 mt-2">+{comp.points} points</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Step 2: Add students + confirm */}
            {compStep === 2 && compConfirmComp && (() => {
              const selectedIds = new Set(compSelectedStudents.map(s => s.id));
              const compSearchResults = compQuery.trim().length >= 2
                ? searchResults.filter(s => !selectedIds.has(s.id))
                : [];
              return (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      onClick={() => { setCompStep(1); setCompConfirmComp(null); setCompSelectedStudents([]); setCompQuery(''); search(''); }}
                      className="text-forest-600 font-medium text-sm"
                    >← Back</button>
                    <h2 className="section-header mb-0">Add Students</h2>
                  </div>

                  {/* Competition banner */}
                  <div className="bg-saffron-50 border-2 border-saffron-300 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-saffron-600 uppercase tracking-wide">Competition</div>
                      <div className="font-bold text-gray-900 mt-0.5">🥇 {compConfirmComp.name}</div>
                      {compConfirmComp.name_hi && <div className="text-xs text-gray-500">{compConfirmComp.name_hi}</div>}
                    </div>
                    <div className="font-bold text-green-600 text-lg">+{compConfirmComp.points} pts</div>
                  </div>

                  {/* Search input */}
                  <div className="relative mb-2">
                    <input
                      className="input-field pr-10"
                      placeholder="Search name or roll no…"
                      value={compQuery}
                      onChange={e => { setCompQuery(e.target.value); search(e.target.value); }}
                      autoComplete="off"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xl">🔍</span>
                  </div>

                  {/* Search results */}
                  {compSearchResults.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden mb-3">
                      {compSearchResults.map(s => (
                        <button
                          key={s.id}
                          onClick={() => { setCompSelectedStudents(prev => [...prev, s]); setCompQuery(''); search(''); }}
                          className="w-full text-left px-4 py-3 border-b last:border-0 border-gray-100 hover:bg-forest-50 transition-colors flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-gray-900">{s.name}</div>
                            <div className="text-xs text-gray-500 font-mono mt-0.5">{s.roll_no} • {s.batch || '—'}</div>
                          </div>
                          <span className="text-green-600 font-bold text-xl leading-none">+</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {compQuery.trim().length >= 2 && compSearchResults.length === 0 && searchResults.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-2 mb-2">No students found</p>
                  )}

                  {/* Selected students list */}
                  {compSelectedStudents.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        Selected ({compSelectedStudents.length})
                      </div>
                      <div className="space-y-1.5">
                        {compSelectedStudents.map(s => (
                          <div key={s.id} className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-900 text-sm">{s.name}</div>
                              <div className="text-xs text-gray-500 font-mono">{s.roll_no} • {s.batch || '—'}</div>
                            </div>
                            <button
                              onClick={() => setCompSelectedStudents(prev => prev.filter(x => x.id !== s.id))}
                              className="text-gray-400 hover:text-red-500 text-lg leading-none px-1 flex-shrink-0"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Award button */}
                  {compSelectedStudents.length > 0 && (
                    <button
                      disabled={compSubmitting}
                      onClick={async () => {
                        const comp = compConfirmComp;
                        const students = [...compSelectedStudents];
                        setCompSubmitting(true);
                        for (const student of students) {
                          await recordMentorEntry({
                            student_id: student.id,
                            student_name: student.name,
                            roll_no: student.roll_no || null,
                            volunteer_id: currentUser?.id,
                            volunteer_name: currentUser?.name,
                            activity: comp.name,
                            type: 'Competition',
                            points: comp.points,
                            coin_count: 0,
                            day: currentDay,
                            slot: currentSlot,
                            notes: null,
                          }, comp.points);
                        }
                        setCompSubmitting(false);
                        setCompStep(1);
                        setCompConfirmComp(null);
                        setCompSelectedStudents([]);
                        setCompSuccess({ points: comp.points, count: students.length, compName: comp.name });
                        setTimeout(() => setCompSuccess(null), 4000);
                        if (!isOnline) toast('Saved locally. Will sync when online.', { icon: '📡' });
                      }}
                      className="w-full py-4 rounded-2xl bg-saffron-500 text-white font-bold text-base active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
                    >
                      {compSubmitting
                        ? 'Saving…'
                        : `Award +${compConfirmComp.points} pts to ${compSelectedStudents.length} student${compSelectedStudents.length !== 1 ? 's' : ''}`}
                    </button>
                  )}
                </>
              );
            })()}
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
              <span className="text-xl">{tab === 'award' ? '🏆' : tab === 'competitions' ? '🥇' : tab === 'duties' ? '📌' : '📋'}</span>
              <span className="text-xs font-medium capitalize">
                {tab === 'duties' ? 'Duties' : tab === 'competitions' ? 'Competitions' : t(`nav.${tab}`)}
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
        message={`${action === 'give' ? t('volunteer.givingPoints') : t('volunteer.takingPoints')} ${selectedReason?.pts} ${t('common.points')} ${t('volunteer.from')} ${selectedStudent?.name} — ${selectedReason ? (isHindi && selectedReason.label_hi ? selectedReason.label_hi : selectedReason.label_en) : ''}${otherText ? ': ' + otherText : ''}`}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
      />
    </div>
  );
}
