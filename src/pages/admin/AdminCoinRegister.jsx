import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCoinStore } from '../../store/useCoinStore.js';

export default function AdminCoinRegister() {
  const { t } = useTranslation();
  const { distributions, returns } = useCoinStore();
  const [selectedDay, setSelectedDay] = useState(1);
  const [activeTab, setActiveTab] = useState('distribution');

  const dayDists = distributions.filter(d => d.day === selectedDay);
  const dayReturns = returns.filter(r => r.day === selectedDay);

  // Group distributions by activity
  const byActivity = dayDists.reduce((acc, d) => {
    if (!acc[d.activity]) acc[d.activity] = [];
    acc[d.activity].push(d);
    return acc;
  }, {});

  // Group returns by slot
  const bySlot = dayReturns.reduce((acc, r) => {
    if (!acc[r.slot]) acc[r.slot] = [];
    acc[r.slot].push(r);
    return acc;
  }, {});

  return (
    <div className="p-6">
      {/* Day selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[1,2,3,4,5,6].map(d => (
          <button
            key={d}
            onClick={() => setSelectedDay(d)}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all
              ${selectedDay === d ? 'bg-saffron-500 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Day {d}
          </button>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-0 mb-4 border-2 border-gray-200 rounded-xl overflow-hidden w-fit">
        <button
          onClick={() => setActiveTab('distribution')}
          className={`px-5 py-2 font-semibold text-sm transition-colors
            ${activeTab === 'distribution' ? 'bg-forest-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          📤 {t('coinkeeper.distributionRegister')}
        </button>
        <button
          onClick={() => setActiveTab('returns')}
          className={`px-5 py-2 font-semibold text-sm transition-colors
            ${activeTab === 'returns' ? 'bg-forest-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          📥 {t('coinkeeper.returnsRegister')}
        </button>
      </div>

      {activeTab === 'distribution' && (
        <div className="space-y-4">
          {Object.entries(byActivity).length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">{t('common.noResults')}</div>
          ) : (
            Object.entries(byActivity).map(([activity, dists]) => (
              <div key={activity} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="bg-forest-50 border-b border-forest-100 px-5 py-3 flex justify-between items-center">
                  <h3 className="font-bold text-forest-700">{activity}</h3>
                  <span className="text-saffron-600 font-bold">
                    Total: {dists.reduce((s, d) => s + d.coins_sent, 0)} 🪙
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b bg-gray-50">
                      <th className="px-5 py-2 text-left">Mentor Name</th>
                      <th className="px-5 py-2 text-right">Coins Sent</th>
                      <th className="px-5 py-2 text-left">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dists.map(d => (
                      <tr key={d.id} className="border-b last:border-0">
                        <td className="px-5 py-2 font-medium text-gray-900">{d.volunteer_name}</td>
                        <td className="px-5 py-2 text-right font-bold text-saffron-600">{d.coins_sent}</td>
                        <td className="px-5 py-2 text-xs text-gray-400 font-mono">
                          {new Date(d.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'returns' && (
        <div className="space-y-4">
          {Object.entries(bySlot).length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">{t('common.noResults')}</div>
          ) : (
            Object.entries(bySlot).map(([slot, rets]) => (
              <div key={slot} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="bg-forest-50 border-b border-forest-100 px-5 py-3 flex justify-between items-center">
                  <h3 className="font-bold text-forest-700">After Slot {slot}</h3>
                  <span className="text-green-600 font-bold">
                    Total returned: {rets.reduce((s, r) => s + r.coins_returned, 0)} 🪙
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b bg-gray-50">
                      <th className="px-5 py-2 text-left">Mentor Name</th>
                      <th className="px-5 py-2 text-right">Coins Returned</th>
                      <th className="px-5 py-2 text-left">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rets.map(r => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="px-5 py-2 font-medium text-gray-900">{r.volunteer_name}</td>
                        <td className="px-5 py-2 text-right font-bold text-green-600">{r.coins_returned}</td>
                        <td className="px-5 py-2 text-xs text-gray-400 font-mono">
                          {new Date(r.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
