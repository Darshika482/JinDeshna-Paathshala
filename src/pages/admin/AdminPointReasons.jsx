import { useEffect, useState } from 'react';
import { usePointReasonsStore } from '../../store/usePointReasonsStore.js';

const TX_TYPES = ['Coin', 'Behaviour', 'Digital', 'Deduction'];

const EMPTY_CAT = { label_en: '', label_hi: '', tx_type: 'Coin', mode: 'give', behaviour_cap: '', sort_order: 0, is_active: true };
const EMPTY_REASON = { label_en: '', label_hi: '', emoji: '⭐', pts: 5, needs_text: false, sort_order: 0, is_active: true };

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function TypeBadge({ type }) {
  const color = type === 'Coin' ? 'bg-yellow-100 text-yellow-700'
    : type === 'Behaviour' ? 'bg-purple-100 text-purple-700'
    : type === 'Deduction' ? 'bg-red-100 text-red-700'
    : 'bg-blue-100 text-blue-700';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${color}`}>{type}</span>;
}

export default function AdminPointReasons() {
  const { categories, reasons, loading, fetch, addCategory, updateCategory, deleteCategory, addReason, updateReason, deleteReason } = usePointReasonsStore();

  const [expandedId, setExpandedId] = useState(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [editingReason, setEditingReason] = useState(null);
  const [targetCatId, setTargetCatId] = useState(null);
  const [catForm, setCatForm] = useState(EMPTY_CAT);
  const [reasonForm, setReasonForm] = useState(EMPTY_REASON);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [confirmDel, setConfirmDel] = useState(null); // { type, id, label }

  useEffect(() => { fetch(); }, [fetch]);

  const reasonsFor = (catId) => reasons.filter(r => r.category_id === catId);

  // ── Category modal ──────────────────────────────────────────────
  const openAddCat = () => {
    setEditingCat(null);
    setCatForm(EMPTY_CAT);
    setErrors({});
    setShowCatModal(true);
  };

  const openEditCat = (cat) => {
    setEditingCat(cat);
    setCatForm({
      label_en: cat.label_en,
      label_hi: cat.label_hi || '',
      tx_type: cat.tx_type,
      mode: cat.mode,
      behaviour_cap: cat.behaviour_cap ?? '',
      sort_order: cat.sort_order ?? 0,
      is_active: cat.is_active,
    });
    setErrors({});
    setShowCatModal(true);
  };

  const handleSaveCat = async () => {
    const e = {};
    if (!catForm.label_en.trim()) e.label_en = 'Required';
    if (!catForm.tx_type) e.tx_type = 'Required';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    const payload = {
      label_en: catForm.label_en.trim(),
      label_hi: catForm.label_hi.trim() || null,
      tx_type: catForm.tx_type,
      mode: catForm.mode,
      behaviour_cap: catForm.behaviour_cap !== '' ? parseInt(catForm.behaviour_cap) : null,
      sort_order: parseInt(catForm.sort_order) || 0,
      is_active: catForm.is_active,
    };
    if (!editingCat) payload.key = slugify(catForm.label_en);

    const res = editingCat
      ? await updateCategory(editingCat.id, payload)
      : await addCategory(payload);
    setSaving(false);
    if (!res.success) { setErrors({ _db: res.error }); return; }
    setShowCatModal(false);
  };

  // ── Reason modal ────────────────────────────────────────────────
  const openAddReason = (catId) => {
    setEditingReason(null);
    setTargetCatId(catId);
    setReasonForm({ ...EMPTY_REASON, sort_order: reasonsFor(catId).length });
    setErrors({});
    setShowReasonModal(true);
  };

  const openEditReason = (r) => {
    setEditingReason(r);
    setTargetCatId(r.category_id);
    setReasonForm({
      label_en: r.label_en,
      label_hi: r.label_hi || '',
      emoji: r.emoji || '⭐',
      pts: r.pts,
      needs_text: r.needs_text,
      sort_order: r.sort_order ?? 0,
      is_active: r.is_active,
    });
    setErrors({});
    setShowReasonModal(true);
  };

  const handleSaveReason = async () => {
    const e = {};
    if (!reasonForm.label_en.trim()) e.label_en = 'Required';
    if (!reasonForm.pts || isNaN(parseInt(reasonForm.pts))) e.pts = 'Must be a number';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    const payload = {
      category_id: targetCatId,
      label_en: reasonForm.label_en.trim(),
      label_hi: reasonForm.label_hi.trim() || null,
      emoji: reasonForm.emoji.trim() || '⭐',
      pts: parseInt(reasonForm.pts),
      needs_text: reasonForm.needs_text,
      sort_order: parseInt(reasonForm.sort_order) || 0,
      is_active: reasonForm.is_active,
    };
    if (!editingReason) payload.key = slugify(reasonForm.label_en);

    const res = editingReason
      ? await updateReason(editingReason.id, payload)
      : await addReason(payload);
    setSaving(false);
    if (!res.success) { setErrors({ _db: res.error }); return; }
    setShowReasonModal(false);
  };

  // ── Delete ──────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDel) return;
    setSaving(true);
    const res = confirmDel.type === 'category'
      ? await deleteCategory(confirmDel.id)
      : await deleteReason(confirmDel.id);
    setSaving(false);
    setConfirmDel(null);
    if (!res.success) alert(res.error);
  };

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-400';

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-bold text-xl text-forest-800">Point Categories</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage award & deduction categories and their reasons</p>
        </div>
        <button onClick={openAddCat} className="btn-primary text-sm px-4 py-2">+ Add Category</button>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      )}

      <div className="space-y-3">
        {categories.map(cat => {
          const catReasons = reasonsFor(cat.id);
          const isExpanded = expandedId === cat.id;
          return (
            <div key={cat.id} className={`bg-white rounded-2xl border shadow-sm transition-all ${!cat.is_active ? 'opacity-50' : ''}`}>
              {/* Category header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : cat.id)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  <span className={`text-sm transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900">{cat.label_en}</span>
                      {cat.label_hi && <span className="text-sm text-gray-500">{cat.label_hi}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <TypeBadge type={cat.tx_type} />
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.mode === 'give' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {cat.mode === 'give' ? 'Award' : 'Deduct'}
                      </span>
                      {cat.behaviour_cap && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Cap: {cat.behaviour_cap}/day</span>
                      )}
                      <span className="text-xs text-gray-400">{catReasons.length} reasons</span>
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => updateCategory(cat.id, { is_active: !cat.is_active })}
                    className={`text-xs px-2 py-1 rounded-lg border font-medium ${cat.is_active ? 'border-green-200 text-green-600' : 'border-gray-200 text-gray-400'}`}
                  >
                    {cat.is_active ? 'Active' : 'Off'}
                  </button>
                  <button onClick={() => openEditCat(cat)} className="text-blue-600 text-xs font-semibold hover:underline">Edit</button>
                  <button onClick={() => setConfirmDel({ type: 'category', id: cat.id, label: cat.label_en })} className="text-red-500 text-xs font-semibold hover:underline">Del</button>
                </div>
              </div>

              {/* Reasons list */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-4 pb-3">
                  <div className="pt-3 space-y-2">
                    {catReasons.length === 0 && (
                      <p className="text-sm text-gray-400 py-2">No reasons yet.</p>
                    )}
                    {catReasons.map(r => (
                      <div key={r.id} className={`flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2 ${!r.is_active ? 'opacity-40' : ''}`}>
                        <span className="text-2xl w-8 text-center flex-shrink-0">{r.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-gray-900">{r.label_en}</span>
                            {r.label_hi && <span className="text-xs text-gray-500">{r.label_hi}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-bold text-saffron-600">+{r.pts} pts</span>
                            {r.needs_text && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">Needs note</span>}
                            <span className="text-xs text-gray-400">#{r.sort_order}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => updateReason(r.id, { is_active: !r.is_active })}
                            className={`text-xs px-2 py-0.5 rounded-lg border ${r.is_active ? 'border-green-200 text-green-600' : 'border-gray-200 text-gray-400'}`}
                          >
                            {r.is_active ? 'On' : 'Off'}
                          </button>
                          <button onClick={() => openEditReason(r)} className="text-blue-600 text-xs font-semibold hover:underline">Edit</button>
                          <button onClick={() => setConfirmDel({ type: 'reason', id: r.id, label: r.label_en })} className="text-red-500 text-xs font-semibold hover:underline">Del</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => openAddReason(cat.id)}
                    className="mt-3 w-full py-2 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-forest-400 hover:text-forest-600 transition-colors"
                  >
                    + Add Reason
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {!loading && categories.length === 0 && (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border">
            No categories yet. Click "Add Category" to get started.
          </div>
        )}
      </div>

      {/* Category modal */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowCatModal(false); }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b">
              <h3 className="font-bold text-forest-700 text-lg">{editingCat ? 'Edit Category' : 'Add Category'}</h3>
              <button onClick={() => setShowCatModal(false)} className="text-gray-400 text-2xl leading-none">✕</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Name (English) *</label>
                  <input className={`${inp} ${errors.label_en ? 'border-red-400' : ''}`} value={catForm.label_en} onChange={e => setCatForm(p => ({ ...p, label_en: e.target.value }))} />
                  {errors.label_en && <p className="text-red-500 text-xs mt-1">{errors.label_en}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Name (Hindi)</label>
                  <input className={inp} value={catForm.label_hi} onChange={e => setCatForm(p => ({ ...p, label_hi: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Transaction Type *</label>
                  <select className={`${inp} ${errors.tx_type ? 'border-red-400' : ''}`} value={catForm.tx_type} onChange={e => setCatForm(p => ({ ...p, tx_type: e.target.value }))}>
                    {TX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Mode</label>
                  <select className={inp} value={catForm.mode} onChange={e => setCatForm(p => ({ ...p, mode: e.target.value }))}>
                    <option value="give">Award (Give)</option>
                    <option value="take">Deduct (Take)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Daily Cap (optional)</label>
                  <input className={inp} type="number" min="1" placeholder="e.g. 4" value={catForm.behaviour_cap} onChange={e => setCatForm(p => ({ ...p, behaviour_cap: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Sort Order</label>
                  <input className={inp} type="number" min="0" value={catForm.sort_order} onChange={e => setCatForm(p => ({ ...p, sort_order: e.target.value }))} />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4" checked={catForm.is_active} onChange={e => setCatForm(p => ({ ...p, is_active: e.target.checked }))} />
                <span className="text-sm font-medium text-gray-700">Active (visible to volunteers)</span>
              </label>
              {errors._db && <p className="text-red-600 text-sm">{errors._db}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={handleSaveCat} disabled={saving} className="btn-primary text-sm px-5 py-2 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setShowCatModal(false)} className="btn-outline text-sm px-5 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reason modal */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowReasonModal(false); }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b">
              <h3 className="font-bold text-forest-700 text-lg">{editingReason ? 'Edit Reason' : 'Add Reason'}</h3>
              <button onClick={() => setShowReasonModal(false)} className="text-gray-400 text-2xl leading-none">✕</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-[56px_1fr] gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Emoji</label>
                  <input className={`${inp} text-center text-xl`} value={reasonForm.emoji} onChange={e => setReasonForm(p => ({ ...p, emoji: e.target.value }))} maxLength={4} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Name (English) *</label>
                  <input className={`${inp} ${errors.label_en ? 'border-red-400' : ''}`} value={reasonForm.label_en} onChange={e => setReasonForm(p => ({ ...p, label_en: e.target.value }))} />
                  {errors.label_en && <p className="text-red-500 text-xs mt-1">{errors.label_en}</p>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name (Hindi)</label>
                <input className={inp} value={reasonForm.label_hi} onChange={e => setReasonForm(p => ({ ...p, label_hi: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Points *</label>
                  <input className={`${inp} ${errors.pts ? 'border-red-400' : ''}`} type="number" min="1" value={reasonForm.pts} onChange={e => setReasonForm(p => ({ ...p, pts: e.target.value }))} />
                  {errors.pts && <p className="text-red-500 text-xs mt-1">{errors.pts}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Sort Order</label>
                  <input className={inp} type="number" min="0" value={reasonForm.sort_order} onChange={e => setReasonForm(p => ({ ...p, sort_order: e.target.value }))} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4" checked={reasonForm.needs_text} onChange={e => setReasonForm(p => ({ ...p, needs_text: e.target.checked }))} />
                  <span className="text-sm font-medium text-gray-700">Requires note (volunteer must type a reason)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4" checked={reasonForm.is_active} onChange={e => setReasonForm(p => ({ ...p, is_active: e.target.checked }))} />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
              </div>
              {errors._db && <p className="text-red-600 text-sm">{errors._db}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={handleSaveReason} disabled={saving} className="btn-primary text-sm px-5 py-2 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setShowReasonModal(false)} className="btn-outline text-sm px-5 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-2">Delete "{confirmDel.label}"?</h3>
            {confirmDel.type === 'category' && (
              <p className="text-sm text-gray-500 mb-4">This will also delete all reasons inside this category.</p>
            )}
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm disabled:opacity-50">
                {saving ? 'Deleting…' : 'Delete'}
              </button>
              <button onClick={() => setConfirmDel(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
