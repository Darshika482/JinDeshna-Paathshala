import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useScheduleStore } from '../../store/useScheduleStore.js';
import { useVolunteerStore } from '../../store/useVolunteerStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';
import LanguageToggle from '../../components/common/LanguageToggle.jsx';
import OfflineBanner from '../../components/common/OfflineBanner.jsx';

const SESSION_ORDER = ['morning', 'afternoon', 'evening', 'night'];
const SESSION_ICONS = { morning: '🌅', afternoon: '☀️', evening: '🌆', night: '🌙' };

function slotToTime(slot) {
  if (!slot) return null;
  const m = String(slot).match(/^(\d{1,2}:\d{2})/);
  return m ? m[1] : null;
}

function slotToEndTime(slot) {
  if (!slot) return null;
  const m = String(slot).match(/[–\-](\d{1,2}:\d{2})/);
  return m ? m[1] : null;
}

function startToSession(start) {
  if (!start) return 'morning';
  const h = parseInt(start.split(':')[0], 10);
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 20) return 'evening';
  return 'night';
}

export default function DailySchedule() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { getActivitiesForDay } = useScheduleStore();
  const [selectedDay, setSelectedDay] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [dbEvents, setDbEvents] = useState([]);

  const campName = useConfigStore(s => s.campName) || import.meta.env.VITE_CAMP_NAME || '';
  const campCity = useConfigStore(s => s.campCity) || import.meta.env.VITE_CAMP_CITY || 'बाल संस्कार शिविर';

  useEffect(() => {
    supabase
      .from('events')
      .select('id,name,time_slot,event_type,notes,sort_order')
      .eq('is_active', true)
      .order('sort_order')
      .order('name')
      .then(({ data }) => setDbEvents(data || []));
  }, []);

  const volunteers = useVolunteerStore(s => s.volunteers);
  const isHindi = i18n.language === 'hi';
  const localActivities = getActivitiesForDay(selectedDay);

  // Convert DB events to the same activity shape used by the schedule store
  const dbMapped = dbEvents.map(ev => ({
    id: `db_${ev.id}`,
    name: ev.name,
    start_time: slotToTime(ev.time_slot) || '00:00',
    end_time: slotToEndTime(ev.time_slot) || '',
    session: startToSession(slotToTime(ev.time_slot)),
    type: ev.event_type || 'event',
    coins: 0,
    notes: ev.notes || '',
    _fromDB: true,
  }));

  // Merge: local activities take priority (dedup by name)
  const localNames = new Set(localActivities.map(a => a.name.toLowerCase()));
  const mergedExtra = dbMapped.filter(ev => !localNames.has(ev.name.toLowerCase()));
  const activities = [...localActivities, ...mergedExtra];

  // Map activity name → assigned volunteer name(s) from real backend data
  const coordinatorByActivity = useMemo(() => {
    const map = {};
    volunteers.forEach(v => {
      const act = v.assigned_activity;
      if (!act) return;
      if (!map[act]) map[act] = [];
      map[act].push(isHindi && v.name_hi ? v.name_hi : v.name);
    });
    return map;
  }, [volunteers, isHindi]);

  const grouped = SESSION_ORDER.reduce((acc, session) => {
    const items = activities.filter(a => a.session === session).sort((a, b) => a.start_time.localeCompare(b.start_time));
    if (items.length) acc[session] = items;
    return acc;
  }, {});

  return (
    <div className="mobile-container flex flex-col bg-gray-50">
      <OfflineBanner />

      {/* Header */}
      <div className="bg-forest-700 text-white px-4 py-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-xl font-bold">{campName || t('schedule.title')}</h1>
            <p className="text-forest-300 text-sm">{campCity}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle compact />
            <button
              onClick={() => navigate('/login')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-forest-400 text-forest-200 hover:bg-forest-600 transition-colors"
            >
              Staff Login
            </button>
          </div>
        </div>
      </div>

      {/* Day Selector */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <p className="text-xs text-gray-500 mb-2">{t('schedule.selectDay')}</p>
        <div className="flex gap-2">
          {[1,2,3,4,5,6].map(d => (
            <button
              key={d}
              onClick={() => { setSelectedDay(d); setExpanded(null); }}
              className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all active:scale-95
                ${selectedDay === d
                  ? 'bg-saffron-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600'}`}
            >
              {isHindi ? `दिन ${d}` : `Day ${d}`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {Object.entries(grouped).map(([session, items]) => (
          <div key={session}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{SESSION_ICONS[session]}</span>
              <h2 className="font-bold text-forest-700 text-base">{t(`schedule.${session}`)}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map(act => (
                <div key={act.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpanded(expanded === act.id ? null : act.id)}
                    className="w-full text-left p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900">
                            {isHindi && act.name_hi ? act.name_hi : act.name}
                          </span>
                          {act.type === 'special' && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold border border-yellow-300">
                              ⭐ {t('schedule.special')}
                            </span>
                          )}
                          {act.type === 'slot' && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                              📦 Submission
                            </span>
                          )}
                        </div>
                        {isHindi && act.name_hi && act.name_hi !== act.name && (
                          <div className="text-xs text-gray-500 mt-0.5">{act.name}</div>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                          <span>🕐 {act.start_time}{act.end_time && act.end_time !== act.start_time ? `–${act.end_time}` : ''}</span>
                          {act.venue && <span>📍 {act.venue}</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {act.coins > 0 && (
                          <div className="text-sm font-bold text-saffron-600">🪙 {act.coins}</div>
                        )}
                        <span className="text-gray-400 text-sm">{expanded === act.id ? '▲' : '▼'}</span>
                      </div>
                    </div>
                  </button>

                  {expanded === act.id && (
                    <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50 fade-in">
                      <div className="pt-3 space-y-2 text-sm text-gray-700">
                        {coordinatorByActivity[act.name]?.length > 0 && (
                          <div><span className="font-semibold">{t('schedule.coordinator')}:</span> {coordinatorByActivity[act.name].join(', ')}</div>
                        )}
                        {act.coins > 0 && (
                          <div><span className="font-semibold">{t('schedule.coinAllocation')}:</span> {act.coins} 🪙</div>
                        )}
                        {act.materials?.length > 0 && (
                          <div>
                            <div className="font-semibold mb-1">{t('schedule.materials')}:</div>
                            <ul className="list-disc list-inside space-y-0.5 text-gray-600">
                              {act.materials.map((m, i) => <li key={i}>{m}</li>)}
                            </ul>
                          </div>
                        )}
                        {act.notes && (
                          <div>
                            <span className="font-semibold">{t('common.notes')}:</span>
                            <p className="text-gray-600 mt-0.5">{act.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
