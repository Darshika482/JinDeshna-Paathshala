import { useEffect, useState } from 'react';
import { useCompetitionsStore } from '../../store/useCompetitionsStore.js';

const EMPTY_FORM = { name: '', name_hi: '', points: 10, sort_order: 0, is_active: true };

export default function AdminCompetitions() {
  const { competitions, loading, fetch, add, update, remove } = useCompetitionsStore();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => { fetch(); }, [fetch]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sort_order: competitions.length });
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({ name: c.name, name_hi: c.name_hi || '', points: c.points, sort_order: c.sort_order ?? 0, is_active: c.is_active });
    setErrors({});
    setShowModal(true);
  };

  const handleSave = async () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.points || isNaN(parseInt(form.points)) || parseInt(form.points) < 1) e.points = 'Must be a positive number';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      name_hi: form.name_hi.trim() || null,
      points: parseInt(form.points),
      sort_order: parseInt(form.sort_order) || 0,
      is_active: form.is_active,
    };
    const res = editingId ? await update(editingId, payload) : await add(payload);
    setSaving(false);
    if (!res.success) { setErrors({ _db: res.error }); return; }
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    setSaving(true);
    const res = await remove(confirmDel.id);
    setSaving(false);
    setConfirmDel(null);
    if (!res.success) alert(res.error);
  };

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-400';

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-bold text-xl text-forest-800">Competitions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage competitions and their point values</p>
        </div>
        <button onClick={openAdd} className="btn-primary text-sm px-4 py-2">+ Add Competition</button>
      </div>

      {loading && <div className="text-center py-12 text-gray-400">Loading…</div>}

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-forest-700 text-white">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Competition Name</th>
              <th className="px-4 py-3 text-left">Hindi Name</th>
              <th className="px-4 py-3 text-left">Points</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {competitions.map((c, i) => (
              <tr key={c.id} className={`border-b last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${!c.is_active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 text-gray-400 text-xs">{c.sort_order}</td>
                <td className="px-4 py-3 font-semibold text-gray-900">🥇 {c.name}</td>
                <td className="px-4 py-3 text-gray-600">{c.name_hi || '—'}</td>
                <td className="px-4 py-3">
                  <span className="font-bold text-saffron-600">+{c.points} pts</span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => update(c.id, { is_active: !c.is_active })}
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {c.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button onClick={() => openEdit(c)} className="text-blue-600 hover:underline text-xs font-semibold">Edit</button>
                    <button onClick={() => setConfirmDel(c)} className="text-red-500 hover:underline text-xs font-semibold">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && competitions.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No competitions yet. Click "+ Add Competition".</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2.5">
        {competitions.map(c => (
          <div key={c.id} className={`bg-white border border-gray-200 rounded-2xl p-4 shadow-sm ${!c.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-gray-900">🥇 {c.name}</div>
                {c.name_hi && <div className="text-sm text-gray-500 mt-0.5">{c.name_hi}</div>}
                <div className="font-bold text-saffron-600 mt-1">+{c.points} points</div>
              </div>
              <button
                onClick={() => update(c.id, { is_active: !c.is_active })}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {c.is_active ? 'Active' : 'Off'}
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => openEdit(c)} className="flex-1 py-2 rounded-xl border border-blue-200 text-blue-700 text-xs font-semibold">Edit</button>
              <button onClick={() => setConfirmDel(c)} className="flex-1 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-semibold">Delete</button>
            </div>
          </div>
        ))}
        {!loading && competitions.length === 0 && (
          <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-200">No competitions yet.</div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b">
              <h3 className="font-bold text-forest-700 text-lg">{editingId ? 'Edit Competition' : 'Add Competition'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-2xl leading-none">✕</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Competition Name (English) *</label>
                <input className={`${inp} ${errors.name ? 'border-red-400' : ''}`} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Drawing Competition – 1st Place" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name (Hindi)</label>
                <input className={inp} value={form.name_hi} onChange={e => setForm(p => ({ ...p, name_hi: e.target.value }))} placeholder="e.g. चित्र प्रतियोगिता – प्रथम" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Points Awarded *</label>
                  <input className={`${inp} ${errors.points ? 'border-red-400' : ''}`} type="number" min="1" value={form.points} onChange={e => setForm(p => ({ ...p, points: e.target.value }))} />
                  {errors.points && <p className="text-red-500 text-xs mt-1">{errors.points}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Sort Order</label>
                  <input className={inp} type="number" min="0" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))} />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                <span className="text-sm font-medium text-gray-700">Active (visible to volunteers)</span>
              </label>
              {errors._db && <p className="text-red-600 text-sm">{errors._db}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm px-5 py-2 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setShowModal(false)} className="btn-outline text-sm px-5 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-2">Delete "{confirmDel.name}"?</h3>
            <p className="text-sm text-gray-500 mb-4">This cannot be undone. Past transactions using this competition will be unaffected.</p>
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm disabled:opacity-50">{saving ? 'Deleting…' : 'Delete'}</button>
              <button onClick={() => setConfirmDel(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
