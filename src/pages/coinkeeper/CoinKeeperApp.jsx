import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore.js';
import { useCoinStore } from '../../store/useCoinStore.js';
import LanguageToggle from '../../components/common/LanguageToggle.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import OfflineBanner from '../../components/common/OfflineBanner.jsx';
import Select from '../../components/common/Select.jsx';

const SLOT_ACTIVITIES = {
  1: ['Early Riser', 'Yoga', 'Morning Puja', 'Class Session'],
  2: ['Afternoon Bhakti', 'Afternoon Class'],
  3: ['Games', 'Evening Program'],
};

export default function CoinKeeperApp() {
  const { t } = useTranslation();
  const { logout, currentUser } = useAuthStore();
  const { distributions, returns, slotStatus, getStats, distribute, recordReturn, closeSlot, currentDay } = useCoinStore();

  const [activeTab, setActiveTab] = useState('distribute');
  const [distForm, setDistForm] = useState({ activity: '', volunteerName: '', coins: '' });
  const [returnForm, setReturnForm] = useState({ slot: 1, volunteerName: '', coins: '' });
  const [confirmClose, setConfirmClose] = useState(null);
  const [success, setSuccess] = useState('');

  const stats = getStats();

  const handleDistribute = () => {
    if (!distForm.activity || !distForm.volunteerName || !distForm.coins) return;
    distribute(distForm.activity, distForm.volunteerName, parseInt(distForm.coins));
    setDistForm({ activity: '', volunteerName: '', coins: '' });
    setSuccess('Coins distributed!');
    setTimeout(() => setSuccess(''), 2000);
  };

  const handleReturn = () => {
    if (!returnForm.volunteerName || !returnForm.coins) return;
    recordReturn(returnForm.slot, returnForm.volunteerName, parseInt(returnForm.coins));
    setReturnForm(prev => ({ ...prev, volunteerName: '', coins: '' }));
    setSuccess('Return recorded!');
    setTimeout(() => setSuccess(''), 2000);
  };

  const handleCloseSlot = (slot) => {
    closeSlot(slot);
    setConfirmClose(null);
    setSuccess(`Slot ${slot} closed!`);
    setTimeout(() => setSuccess(''), 2000);
  };

  const todayDists = distributions.filter(d => d.day === currentDay);
  const todayReturns = returns.filter(r => r.day === currentDay);

  const poolPct = Math.min(100, (stats.availableNow / stats.totalPool) * 100);

  return (
    <div className="mobile-container flex flex-col">
      <OfflineBanner />

      {/* Header */}
      <div className="bg-forest-700 text-white px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-forest-300">{t('coinkeeper.title')}</div>
            <div className="font-bold">{currentUser?.name}</div>
          </div>
          <div className="flex gap-2 items-center">
            <LanguageToggle compact />
            <button onClick={logout} className="text-forest-300 text-xs px-2 py-1 rounded border border-forest-500">{t('auth.logout')}</button>
          </div>
        </div>

        {/* Pool stats */}
        <div className="grid grid-cols-5 gap-1 text-center text-xs">
          {[
            { label: t('coinkeeper.totalPool'), val: stats.totalPool, color: 'text-white' },
            { label: t('coinkeeper.distributed'), val: stats.distributed, color: 'text-yellow-300' },
            { label: t('coinkeeper.returned'), val: stats.returned, color: 'text-green-300' },
            { label: t('coinkeeper.inCirculation'), val: stats.inCirculation, color: 'text-orange-300' },
            { label: t('coinkeeper.availableNow'), val: stats.availableNow, color: 'text-blue-300' },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-lg p-1">
              <div className={`font-bold text-lg ${s.color}`}>{s.val}</div>
              <div className="text-forest-300 leading-tight" style={{ fontSize: '0.6rem' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Pool health bar */}
        <div className="mt-2">
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${poolPct}%`,
                background: poolPct > 50 ? '#22c55e' : poolPct > 25 ? '#f59e0b' : '#ef4444'
              }}
            />
          </div>
          <div className="text-xs text-forest-300 mt-1 text-right">{stats.availableNow} available</div>
        </div>
      </div>

      {success && (
        <div className="bg-green-500 text-white px-4 py-2 text-center font-semibold fade-in">✅ {success}</div>
      )}

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-200">
        {[
          { key: 'distribute', label: t('coinkeeper.distribute'), icon: '📤' },
          { key: 'returns', label: t('coinkeeper.collectReturns'), icon: '📥' },
          { key: 'register', label: t('coinkeeper.dailyRegister'), icon: '📋' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 text-xs font-semibold flex flex-col items-center gap-0.5 transition-colors
              ${activeTab === tab.key ? 'text-saffron-500 border-b-2 border-saffron-500' : 'text-gray-500'}`}
          >
            <span className="text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4 max-w-5xl mx-auto w-full">
        {/* Distribute Tab */}
        {activeTab === 'distribute' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(slot => {
              const status = slotStatus[slot];
              const isLocked = status === 'locked';
              const isClosed = status === 'closed';
              const slotDists = todayDists.filter(d => {
                const activities = SLOT_ACTIVITIES[slot];
                return activities?.includes(d.activity);
              });

              return (
                <div key={slot} className={`card ${isLocked ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-forest-700">
                      {isLocked ? '🔒 ' : isClosed ? '✅ ' : '📤 '}
                      {t('common.slot')} {slot}
                      {slot === 1 ? ' — Morning' : slot === 2 ? ' — Afternoon' : ' — Evening'}
                    </h3>
                    {isClosed && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">{t('coinkeeper.slotClosed')}</span>}
                    {isLocked && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{t('coinkeeper.slotLocked')}</span>}
                  </div>

                  {!isLocked && !isClosed && (
                    <div className="space-y-2 mb-3">
                      <Select
                        value={distForm.activity}
                        onChange={val => setDistForm(f => ({ ...f, activity: val }))}
                        placeholder="Select Activity..."
                        options={[
                          { value: '', label: 'Select Activity...' },
                          ...SLOT_ACTIVITIES[slot].map(a => ({ value: a, label: a })),
                        ]}
                      />
                      <input
                        className="input-field"
                        placeholder={t('coinkeeper.volunteerName')}
                        value={distForm.volunteerName}
                        onChange={e => setDistForm(f => ({ ...f, volunteerName: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          className="input-field flex-1"
                          placeholder={t('coinkeeper.coinCount')}
                          value={distForm.coins}
                          onChange={e => setDistForm(f => ({ ...f, coins: e.target.value }))}
                        />
                        <button onClick={handleDistribute} className="btn-secondary px-6 py-3">
                          {t('coinkeeper.send')}
                        </button>
                      </div>
                    </div>
                  )}

                  {slotDists.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                      <div className="text-xs font-semibold text-gray-500 mb-2">{t('coinkeeper.givenTo')}:</div>
                      {slotDists.map(d => (
                        <div key={d.id} className="flex justify-between text-sm">
                          <span className="font-medium">{d.volunteer_name}</span>
                          <span className="text-saffron-600 font-bold">{d.coins_sent} 🪙</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Returns Tab */}
        {activeTab === 'returns' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(slot => {
              const status = slotStatus[slot];
              const isOpen = status === 'open' || status === 'closed';
              const slotRets = todayReturns.filter(r => r.slot === slot);

              return (
                <div key={slot} className={`card ${!isOpen ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-forest-700">
                      After {t('common.slot')} {slot}
                    </h3>
                    {status === 'closed' && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">{t('coinkeeper.slotClosed')}</span>}
                  </div>

                  {isOpen && (
                    <div className="space-y-2 mb-3">
                      <input
                        className="input-field"
                        placeholder={t('coinkeeper.volunteerName')}
                        value={returnForm.slot === slot ? returnForm.volunteerName : ''}
                        onChange={e => setReturnForm({ slot, volunteerName: e.target.value, coins: returnForm.slot === slot ? returnForm.coins : '' })}
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          className="input-field flex-1"
                          placeholder={t('coinkeeper.coinCount')}
                          value={returnForm.slot === slot ? returnForm.coins : ''}
                          onChange={e => setReturnForm(prev => ({ ...prev, coins: e.target.value, slot }))}
                        />
                        <button onClick={handleReturn} className="btn-secondary px-4 py-3 text-sm">
                          {t('coinkeeper.record')}
                        </button>
                      </div>
                    </div>
                  )}

                  {slotRets.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-1">
                      <div className="text-xs font-semibold text-gray-500 mb-2">{t('coinkeeper.returnedBy')}:</div>
                      {slotRets.map(r => (
                        <div key={r.id} className="flex justify-between text-sm">
                          <span className="font-medium">{r.volunteer_name}</span>
                          <span className="text-green-600 font-bold">{r.coins_returned} 🪙</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isOpen && status !== 'closed' && (
                    <button
                      onClick={() => setConfirmClose(slot)}
                      className="w-full btn-secondary text-base"
                    >
                      🔒 {t('coinkeeper.closeSlot')} {slot}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Daily Register Tab */}
        {activeTab === 'register' && (
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-bold text-forest-700 mb-3">📤 {t('coinkeeper.distributionRegister')}</h3>
              {todayDists.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">{t('common.noResults')}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2">Activity</th>
                      <th className="pb-2">Mentor</th>
                      <th className="pb-2 text-right">Coins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayDists.map(d => (
                      <tr key={d.id} className="border-b last:border-0">
                        <td className="py-2 text-forest-700 font-medium">{d.activity}</td>
                        <td className="py-2 text-gray-700">{d.volunteer_name}</td>
                        <td className="py-2 text-right font-bold text-saffron-600">{d.coins_sent}</td>
                      </tr>
                    ))}
                    <tr className="font-bold text-forest-700 bg-forest-50">
                      <td className="pt-2" colSpan={2}>Total</td>
                      <td className="pt-2 text-right">{todayDists.reduce((s, d) => s + d.coins_sent, 0)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            <div className="card">
              <h3 className="font-bold text-forest-700 mb-3">📥 {t('coinkeeper.returnsRegister')}</h3>
              {todayReturns.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">{t('common.noResults')}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2">Slot</th>
                      <th className="pb-2">Mentor</th>
                      <th className="pb-2 text-right">Coins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayReturns.map(r => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 text-forest-700 font-medium">Slot {r.slot}</td>
                        <td className="py-2 text-gray-700">{r.volunteer_name}</td>
                        <td className="py-2 text-right font-bold text-green-600">{r.coins_returned}</td>
                      </tr>
                    ))}
                    <tr className="font-bold text-forest-700 bg-forest-50">
                      <td className="pt-2" colSpan={2}>Total</td>
                      <td className="pt-2 text-right">{todayReturns.reduce((s, r) => s + r.coins_returned, 0)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmClose !== null}
        title={`Close Slot ${confirmClose}?`}
        message={`This will lock Slot ${confirmClose} and unlock the next slot's distribution. This cannot be undone.`}
        onConfirm={() => handleCloseSlot(confirmClose)}
        onCancel={() => setConfirmClose(null)}
        danger
        confirmLabel={t('coinkeeper.closeSlot')}
      />
    </div>
  );
}
