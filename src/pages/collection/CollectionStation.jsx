import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore.js';
import { useStudentStore } from '../../store/useStudentStore.js';
import { useTransactionStore } from '../../store/useTransactionStore.js';
import LanguageToggle from '../../components/common/LanguageToggle.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import OfflineBanner from '../../components/common/OfflineBanner.jsx';
import QrScanner from '../../components/common/QrScanner.jsx';

const SLOT_INFO = {
  1: { name: 'Slot 1', time: '12:30 PM', deadline: '13:00', hi: 'स्लॉट 1' },
  2: { name: 'Slot 2', time: '4:30 PM', deadline: '17:00', hi: 'स्लॉट 2' },
  3: { name: 'Slot 3', time: '9:00 PM', deadline: '22:00', hi: 'स्लॉट 3 (अंतिम)', final: true },
};

export default function CollectionStation() {
  const { t } = useTranslation();
  const { logout, currentUser } = useAuthStore();
  const { students, search, searchResults } = useStudentStore();
  const { addTransaction, currentDay, currentSlot } = useTransactionStore();
  const { addPoints: addStudentPoints } = useStudentStore();

  const [query, setQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [coins, setCoins] = useState({ 5: 0, 10: 0, 20: 0 });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [successStudent, setSuccessStudent] = useState(null);
  const [showQr, setShowQr] = useState(false);

  const slotInfo = SLOT_INFO[currentSlot];
  const totalCoins = coins[5] + coins[10] + coins[20];
  const points = coins[5] * 5 + coins[10] * 10 + coins[20] * 20;

  const adjustCoin = (denom, delta) =>
    setCoins(prev => ({ ...prev, [denom]: Math.max(0, prev[denom] + delta) }));

  const resetCoins = () => setCoins({ 5: 0, 10: 0, 20: 0 });

  const handleSearch = (val) => {
    setQuery(val);
    search(val);
  };

  const selectStudent = (s) => {
    setSelectedStudent(s);
    setQuery('');
    search('');
    resetCoins();
  };

  const handleQrScan = (text) => {
    setShowQr(false);
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

  const handleConfirm = () => {
    if (!selectedStudent || totalCoins <= 0) return;
    const tx = {
      student_id: selectedStudent.id,
      student_name: selectedStudent.name,
      volunteer_id: currentUser?.id,
      volunteer_name: currentUser?.name,
      activity: `Slot ${currentSlot} Submission`,
      type: 'Submission',
      points,
      coin_count: totalCoins,
      day: currentDay,
      slot: currentSlot,
      notes: `5pt×${coins[5]} 10pt×${coins[10]} 20pt×${coins[20]}`,
    };
    addTransaction(tx);
    addStudentPoints(selectedStudent.id, points, currentDay);
    setSubmissions(prev => [{ ...selectedStudent, coins: { ...coins }, totalCoins, points, time: new Date().toLocaleTimeString() }, ...prev]);
    setSuccessStudent({ ...selectedStudent, totalCoins, points });
    setConfirmOpen(false);
    setSelectedStudent(null);
    resetCoins();
    setTimeout(() => setSuccessStudent(null), 3000);
  };

  return (
    <div className="mobile-container flex flex-col">
      <OfflineBanner />

      {/* Header */}
      <div className="bg-forest-700 text-white px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs text-forest-300">{t('collection.title')}</div>
            <div className="font-bold text-lg">{slotInfo?.name} • {slotInfo?.time}</div>
          </div>
          <div className="flex gap-2 items-center">
            <LanguageToggle compact />
            <button onClick={logout} className="text-forest-300 text-xs px-2 py-1 rounded border border-forest-500">{t('auth.logout')}</button>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-forest-200">{t('collection.coinsCollected')}: <strong className="text-white">{submissions.length}</strong> submissions</span>
          {slotInfo?.final && <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">FINAL SLOT</span>}
        </div>
      </div>

      {/* Success banner */}
      {successStudent && (
        <div className="bg-green-500 text-white px-4 py-3 fade-in">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✅</span>
            <div>
              <div className="font-bold">{t('collection.successTitle')}</div>
              <div className="text-sm">{successStudent.name} — {successStudent.totalCoins} coins → +{successStudent.points} pts</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 max-w-4xl mx-auto w-full md:grid md:grid-cols-2 md:gap-6 md:items-start">
        {/* Search */}
        {!selectedStudent && (
          <div className="mb-4">
            <h2 className="section-header">{t('collection.scanWristband')}</h2>
            <button
              type="button"
              onClick={() => setShowQr(true)}
              className="card w-full text-center py-4 mb-3 border-2 border-dashed border-gray-300"
            >
              <div className="text-4xl mb-2">📷</div>
              <p className="text-gray-500 text-sm">QR Scanner (tap to activate)</p>
              <p className="text-gray-400 text-xs mt-1">QR स्कैनर (टैप करें)</p>
            </button>

            <div className="text-center text-gray-400 text-sm my-3">— or —</div>

            <label className="block text-sm font-semibold text-gray-600 mb-2">{t('collection.enterRoll')}</label>
            <div className="relative">
              <input
                className="input-field pr-10"
                placeholder="Roll number or name..."
                value={query}
                onChange={e => handleSearch(e.target.value)}
                autoComplete="off"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xl">🔍</span>
            </div>

            {searchResults.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-lg mt-2 overflow-hidden">
                {searchResults.map(s => (
                  <button
                    key={s.id}
                    onClick={() => selectStudent(s)}
                    className="w-full text-left px-4 py-3 border-b last:border-0 border-gray-100 hover:bg-forest-50 active:bg-forest-100"
                  >
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-sm text-gray-500">{s.roll_no} • Class {s.class}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Student selected: count coins */}
        {selectedStudent && (
          <div className="fade-in space-y-4">
            {/* Student card — no score shown */}
            <div className="bg-green-50 border-2 border-green-400 rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-green-600 font-semibold mb-1">✅ {t('collection.studentFound')}</div>
                  <div className="text-2xl font-bold text-gray-900">{selectedStudent.name}</div>
                  <div className="text-gray-600 mt-1">{selectedStudent.roll_no} • Class {selectedStudent.class}</div>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="text-gray-400 text-xl p-1">✕</button>
              </div>
            </div>

            {/* Coin counters — 3 denominations */}
            <div className="card">
              <h3 className="font-bold text-forest-700 text-lg mb-4 text-center">{t('collection.countCoins')}</h3>

              <div className="space-y-3 mb-4">
                {[
                  { denom: 5,  label: '5-pt Coin',  color: 'bg-amber-100 border-amber-300', textColor: 'text-amber-700', btnColor: 'bg-amber-500', emoji: '🟤' },
                  { denom: 10, label: '10-pt Coin', color: 'bg-slate-100 border-slate-300', textColor: 'text-slate-700', btnColor: 'bg-slate-500', emoji: '⚪' },
                  { denom: 20, label: '20-pt Coin', color: 'bg-yellow-100 border-yellow-300', textColor: 'text-yellow-700', btnColor: 'bg-yellow-500', emoji: '🟡' },
                ].map(({ denom, label, color, textColor, btnColor, emoji }) => (
                  <div key={denom} className={`flex items-center justify-between border-2 rounded-2xl px-4 py-3 ${color}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-2xl">{emoji}</span>
                      <div>
                        <div className={`font-bold text-sm ${textColor}`}>{label}</div>
                        <div className="text-xs text-gray-400">{denom} pts each</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => adjustCoin(denom, -1)}
                        className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 text-gray-600 text-xl font-bold active:scale-95 transition-all flex items-center justify-center"
                      >−</button>
                      <span className={`text-2xl font-bold w-8 text-center ${textColor}`}>{coins[denom]}</span>
                      <button
                        onClick={() => adjustCoin(denom, 1)}
                        className={`w-10 h-10 rounded-full text-white text-xl font-bold active:scale-95 transition-all flex items-center justify-center ${btnColor}`}
                      >+</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Points summary */}
              {totalCoins > 0 && (
                <div className="bg-saffron-50 border border-saffron-200 rounded-xl p-3 mb-4">
                  <div className="flex justify-between items-center text-sm text-gray-600 mb-1">
                    {coins[5]  > 0 && <span>🟤 {coins[5]}×5  = {coins[5]*5}pts</span>}
                    {coins[10] > 0 && <span>⚪ {coins[10]}×10 = {coins[10]*10}pts</span>}
                    {coins[20] > 0 && <span>🟡 {coins[20]}×20 = {coins[20]*20}pts</span>}
                  </div>
                  <div className="text-2xl font-bold text-saffron-600 text-center">
                    {totalCoins} coins → +{points} points
                  </div>
                </div>
              )}

              <button
                disabled={totalCoins <= 0}
                onClick={() => setConfirmOpen(true)}
                className={`w-full py-4 rounded-2xl font-bold text-xl text-white transition-all
                  ${totalCoins > 0 ? 'bg-saffron-500 active:scale-95 shadow-lg' : 'bg-gray-300 cursor-not-allowed'}`}
              >
                {t('collection.confirmAndTake')}
              </button>
            </div>
          </div>
        )}

        {/* Running tally */}
        {submissions.length > 0 && (
          <div className="mt-4">
            <h3 className="section-header">{t('collection.submissionsThisSlot')} ({submissions.length})</h3>
            <div className="space-y-2">
              {submissions.map((s, i) => (
                <div key={i} className="card p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.roll_no} • {s.time}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 space-x-1">
                      {s.coins[5]  > 0 && <span>🟤×{s.coins[5]}</span>}
                      {s.coins[10] > 0 && <span>⚪×{s.coins[10]}</span>}
                      {s.coins[20] > 0 && <span>🟡×{s.coins[20]}</span>}
                    </div>
                    <div className="font-bold text-saffron-600">{s.totalCoins} 🪙</div>
                    <div className="text-xs text-green-600">+{s.points} pts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t('collection.confirmAndTake')}
        message={`Taking ${totalCoins} coins from ${selectedStudent?.name} (🟤×${coins[5]} ⚪×${coins[10]} 🟡×${coins[20]}). This gives them +${points} points.`}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        confirmLabel={t('common.confirm')}
      />

      {showQr && (
        <QrScanner
          onScan={handleQrScan}
          onClose={() => setShowQr(false)}
        />
      )}
    </div>
  );
}
