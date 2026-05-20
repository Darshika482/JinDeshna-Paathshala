import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore.js';
import { useCoinStore } from '../../store/useCoinStore.js';
import LanguageToggle from '../../components/common/LanguageToggle.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import OfflineBanner from '../../components/common/OfflineBanner.jsx';

const ZONE_VOLUNTEERS = [
  { id: 'zv1', name: 'Dinesh Kumar' },
  { id: 'zv2', name: 'Naresh Singh' },
  { id: 'zv3', name: 'Kamlesh Joshi' },
  { id: 'zv4', name: 'Umesh Nair' },
];

export default function CoordinatorApp() {
  const { t } = useTranslation();
  const { logout, currentUser } = useAuthStore();
  const { distribute, recordReturn, distributions, returns, currentDay } = useCoinStore();

  const [sendForms, setSendForms] = useState({});
  const [collectForms, setCollectForms] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);
  const [success, setSuccess] = useState('');
  const [markedReturned, setMarkedReturned] = useState(false);

  const myActivity = currentUser?.assigned_activity || 'Activity';
  const myDists = distributions.filter(d => d.day === currentDay && d.activity === myActivity);
  const myReturns = returns.filter(r => r.day === currentDay);

  const myAllocation = 100; // from coin store ideally
  const totalDistributed = myDists.reduce((s, d) => s + d.coins_sent, 0);
  const totalCollected = myReturns.reduce((s, r) => s + r.coins_returned, 0);
  const netOut = totalDistributed - totalCollected;
  const toReturn = netOut;

  const handleSend = (vol) => {
    const coins = parseInt(sendForms[vol.id] || 0);
    if (!coins || coins <= 0) return;
    distribute(myActivity, vol.name, coins);
    setSendForms(f => ({ ...f, [vol.id]: '' }));
    setSuccess(`Sent ${coins} coins to ${vol.name}`);
    setTimeout(() => setSuccess(''), 2000);
  };

  const handleCollect = (vol) => {
    const coins = parseInt(collectForms[vol.id] || 0);
    if (!coins || coins <= 0) return;
    recordReturn(1, vol.name, coins);
    setCollectForms(f => ({ ...f, [vol.id]: '' }));
    setSuccess(`Collected ${coins} coins from ${vol.name}`);
    setTimeout(() => setSuccess(''), 2000);
  };

  const getVolNetOut = (vol) => {
    const sent = myDists.filter(d => d.volunteer_name === vol.name).reduce((s, d) => s + d.coins_sent, 0);
    const collected = myReturns.filter(r => r.volunteer_name === vol.name).reduce((s, r) => s + r.coins_returned, 0);
    return sent - collected;
  };

  return (
    <div className="mobile-container flex flex-col">
      <OfflineBanner />

      {/* Header */}
      <div className="bg-forest-700 text-white px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-forest-300">{t('coordinator.title')}</div>
            <div className="font-bold">{currentUser?.name}</div>
            <div className="text-xs text-forest-200">{myActivity}</div>
          </div>
          <div className="flex gap-2 items-center">
            <LanguageToggle compact />
            <button onClick={logout} className="text-forest-300 text-xs px-2 py-1 rounded border border-forest-500">{t('auth.logout')}</button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-1 text-center text-xs">
          {[
            { label: t('coordinator.myAllocation'), val: myAllocation, color: 'text-white' },
            { label: t('coordinator.distributed'), val: totalDistributed, color: 'text-yellow-300' },
            { label: t('coordinator.collectedBack'), val: totalCollected, color: 'text-green-300' },
            { label: t('coordinator.netOut'), val: netOut, color: 'text-orange-300' },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-lg p-1.5">
              <div className={`font-bold text-xl ${s.color}`}>{s.val}</div>
              <div className="text-forest-300 leading-tight" style={{ fontSize: '0.6rem' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {success && (
        <div className="bg-green-500 text-white px-4 py-2 text-center font-semibold fade-in">✅ {success}</div>
      )}

      <div className="flex-1 overflow-auto p-4 max-w-4xl mx-auto w-full">
        {/* Volunteer Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {ZONE_VOLUNTEERS.map(vol => {
          const netOut = getVolNetOut(vol);
          return (
            <div key={vol.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-bold text-gray-900">{vol.name}</div>
                  <div className="text-sm text-gray-500">Net Out: <span className="font-bold text-orange-600">{netOut} 🪙</span></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 font-semibold block mb-1">{t('coordinator.sendCoins')}</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      className="input-field flex-1 py-2 text-sm"
                      placeholder="0"
                      value={sendForms[vol.id] || ''}
                      onChange={e => setSendForms(f => ({ ...f, [vol.id]: e.target.value }))}
                    />
                    <button
                      onClick={() => handleSend(vol)}
                      className="bg-saffron-500 text-white px-3 py-2 rounded-xl font-bold text-sm active:scale-95"
                    >→</button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold block mb-1">{t('coordinator.collectBack')}</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      className="input-field flex-1 py-2 text-sm"
                      placeholder="0"
                      value={collectForms[vol.id] || ''}
                      onChange={e => setCollectForms(f => ({ ...f, [vol.id]: e.target.value }))}
                    />
                    <button
                      onClick={() => handleCollect(vol)}
                      className="bg-forest-700 text-white px-3 py-2 rounded-xl font-bold text-sm active:scale-95"
                    >←</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        </div>

        {/* Summary Card */}
        <div className="card border-2 border-forest-200 bg-forest-50">
          <h3 className="font-bold text-forest-700 mb-3">📊 {t('coordinator.summary')}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t('coordinator.receivedFromKeeper')}</span>
              <span className="font-bold">{myAllocation} 🪙</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('coordinator.distributed')}</span>
              <span className="font-bold text-yellow-600">{totalDistributed} 🪙</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('coordinator.collectedBack')}</span>
              <span className="font-bold text-green-600">{totalCollected} 🪙</span>
            </div>
            <div className="border-t border-forest-200 pt-2 flex justify-between">
              <span className="font-bold text-forest-700">{t('coordinator.toReturn')}</span>
              <span className="font-bold text-orange-600 text-lg">{toReturn} 🪙</span>
            </div>
          </div>
        </div>

        {/* Mark Returned Button */}
        {!markedReturned ? (
          <button
            onClick={() => setConfirmAction('return')}
            className="w-full btn-primary"
          >
            ✅ {t('coordinator.markReturnedToKeeper')}
          </button>
        ) : (
          <div className="card bg-green-50 border-green-300 text-center py-4">
            <div className="text-3xl mb-2">✅</div>
            <div className="font-bold text-green-700">Marked as returned to Keeper!</div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmAction === 'return'}
        title={t('coordinator.markReturnedToKeeper')}
        message={`You are confirming that ${toReturn} coins have been returned to the Master Coin Keeper.`}
        onConfirm={() => { setMarkedReturned(true); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
