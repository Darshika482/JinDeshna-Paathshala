import { useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { usePathshalaStore } from '../../store/usePathshalaStore.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';

// ─── CSV helpers ─────────────────────────────────────────────────────────────
const STUDENT_CSV_HEADERS = ['Student Name', "Father/Mother's Name", 'Mobile Number'];

const STUDENT_TEMPLATE_ROWS = [
  ['Arham Jain', 'Vikram Jain', '9179105875'],
  ['Aarvi Jain', 'Sachin Jain', '7067514988'],
];

function buildCSV(headers, rows) {
  return [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function downloadCSV(filename, content) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PATHSHALA_TYPES = ['Daily', 'Weekly', 'Half-Yearly', 'Summer / Vacation-based'];
const CLASS_OPTIONS = ['Kids Group', 'Children Group', 'Senior Group'];

const EMPTY_FORM = {
  paathshala_name: '',
  address: '',
  teacher1_name: '',
  teacher1_mobile: '',
  teacher1_address: '',
  teacher2_name: '',
  teacher2_mobile: '',
  teacher2_address: '',
  mandal_president_name: '',
  mandal_president_mobile: '',
  mandal_secretary_name: '',
  mandal_secretary_mobile: '',
  description: '',
  pathshala_type: '',
  classes_conducted: [],
  students_2_5: '',
  students_6_10: '',
  students_11_15: '',
  students_15_21: '',
  other_details: '',
  special_activities: '',
};

const EMPTY_STUDENT = { name: '', parent_name: '', mobile: '' };

// ─── Sub-components ──────────────────────────────────────────────────────────

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500';
const textareaCls = inputCls + ' resize-none';

function PathshalaFormModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const toggleClass = cls =>
    setForm(f => ({
      ...f,
      classes_conducted: f.classes_conducted.includes(cls)
        ? f.classes_conducted.filter(c => c !== cls)
        : [...f.classes_conducted, cls],
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.paathshala_name.trim()) { toast.error('Pathshala name is required'); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-forest-700 text-white rounded-t-xl">
          <h2 className="font-bold text-lg">
            {initial ? 'Edit Pathshala' : 'Register New Pathshala'}
          </h2>
          <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* Section 1: Basic Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-forest-700 uppercase tracking-wide border-b pb-1">Basic Information</h3>
            <Field label="Pathshala Name" required>
              <input className={inputCls} value={form.paathshala_name} onChange={e => set('paathshala_name', e.target.value)} placeholder="Shri Veetraag Vigyan Pathshala" />
            </Field>
            <Field label="Address / Location">
              <textarea className={textareaCls} rows={2} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Village / Town, District, State" />
            </Field>
            <Field label="Pathshala Description">
              <textarea className={textareaCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
            </Field>
          </div>

          {/* Section 2: Teacher 1 */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-forest-700 uppercase tracking-wide border-b pb-1">Teacher / Instructor (Primary)</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Teacher Name">
                <input className={inputCls} value={form.teacher1_name} onChange={e => set('teacher1_name', e.target.value)} />
              </Field>
              <Field label="Mobile Number">
                <input className={inputCls} type="tel" value={form.teacher1_mobile} onChange={e => set('teacher1_mobile', e.target.value)} />
              </Field>
            </div>
            <Field label="Correspondence Address">
              <textarea className={textareaCls} rows={2} value={form.teacher1_address} onChange={e => set('teacher1_address', e.target.value)} />
            </Field>
          </div>

          {/* Section 3: Teacher 2 */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-forest-700 uppercase tracking-wide border-b pb-1">Teacher / Instructor (Secondary)</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Teacher Name">
                <input className={inputCls} value={form.teacher2_name} onChange={e => set('teacher2_name', e.target.value)} />
              </Field>
              <Field label="Mobile Number">
                <input className={inputCls} type="tel" value={form.teacher2_mobile} onChange={e => set('teacher2_mobile', e.target.value)} />
              </Field>
            </div>
            <Field label="Correspondence Address">
              <textarea className={textareaCls} rows={2} value={form.teacher2_address} onChange={e => set('teacher2_address', e.target.value)} />
            </Field>
          </div>

          {/* Section 4: Mandal */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-forest-700 uppercase tracking-wide border-b pb-1">Mandal Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mandal President Name">
                <input className={inputCls} value={form.mandal_president_name} onChange={e => set('mandal_president_name', e.target.value)} />
              </Field>
              <Field label="President Mobile">
                <input className={inputCls} type="tel" value={form.mandal_president_mobile} onChange={e => set('mandal_president_mobile', e.target.value)} />
              </Field>
              <Field label="Mandal Secretary Name">
                <input className={inputCls} value={form.mandal_secretary_name} onChange={e => set('mandal_secretary_name', e.target.value)} />
              </Field>
              <Field label="Secretary Mobile">
                <input className={inputCls} type="tel" value={form.mandal_secretary_mobile} onChange={e => set('mandal_secretary_mobile', e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Section 5: Type & Classes */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-forest-700 uppercase tracking-wide border-b pb-1">Type & Structure</h3>
            <Field label="Type of Pathshala">
              <select className={inputCls} value={form.pathshala_type} onChange={e => set('pathshala_type', e.target.value)}>
                <option value="">Select type...</option>
                {PATHSHALA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Classes Conducted">
              <div className="flex flex-wrap gap-3 mt-1">
                {CLASS_OPTIONS.map(cls => (
                  <label key={cls} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.classes_conducted.includes(cls)}
                      onChange={() => toggleClass(cls)}
                      className="rounded"
                    />
                    {cls}
                  </label>
                ))}
              </div>
            </Field>
          </div>

          {/* Section 6: Student Count */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-forest-700 uppercase tracking-wide border-b pb-1">Student Count (Age-wise)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[['students_2_5','2–5 yrs'], ['students_6_10','6–10 yrs'], ['students_11_15','11–15 yrs'], ['students_15_21','15–21 yrs']].map(([key, label]) => (
                <Field key={key} label={label}>
                  <input className={inputCls} type="number" min="0" value={form[key]} onChange={e => set(key, e.target.value)} placeholder="0" />
                </Field>
              ))}
            </div>
          </div>

          {/* Section 7: Other */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-forest-700 uppercase tracking-wide border-b pb-1">Additional Details</h3>
            <Field label="Other Details / Activities">
              <textarea className={textareaCls} rows={2} value={form.other_details} onChange={e => set('other_details', e.target.value)} />
            </Field>
            <Field label="Special Activities">
              <textarea className={textareaCls} rows={2} value={form.special_activities} onChange={e => set('special_activities', e.target.value)} />
            </Field>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 rounded border border-gray-300 text-sm hover:bg-gray-100">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 rounded bg-forest-700 text-white text-sm font-semibold hover:bg-forest-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : initial ? 'Update Pathshala' : 'Register Pathshala'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentFormModal({ pathshala, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY_STUDENT);
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Student name is required'); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-forest-700 text-white rounded-t-xl">
          <h2 className="font-bold">Add Student to {pathshala.paathshala_name}</h2>
          <button onClick={onClose} className="text-white text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field label="Student Name" required>
            <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
          </Field>
          <Field label="Father/Mother's Name">
            <input className={inputCls} value={form.parent_name} onChange={e => set('parent_name', e.target.value)} />
          </Field>
          <Field label="Mobile Number">
            <input className={inputCls} type="tel" value={form.mobile} onChange={e => set('mobile', e.target.value)} />
          </Field>
          <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
            Roll number will be auto-generated as <strong>{String(pathshala.paathshala_code).padStart(2,'0')}XX</strong>
          </div>
        </form>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded border border-gray-300 text-sm hover:bg-gray-100">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 rounded bg-forest-700 text-white text-sm font-semibold hover:bg-forest-800 disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add Student'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail View ─────────────────────────────────────────────────────────────
function PathshalaDetail({ pathshala, students, onBack, onEdit }) {
  const { addStudentToPathshala, importStudentsFromCSV, deleteStudent } = usePathshalaStore();
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const [deleteStudentId, setDeleteStudentId] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const fileRef = useRef();

  const myStudents = students
    .filter(s => s.paathshala_code === pathshala.paathshala_code)
    .sort((a, b) => String(a.roll_no).localeCompare(String(b.roll_no)));

  const handleAddStudent = async (form) => {
    const result = await addStudentToPathshala(pathshala, form);
    if (result.success) {
      toast.success(`Student added! Roll No: ${result.rollNo}`);
      setShowAddStudent(false);
    } else {
      toast.error(result.error || 'Failed to add student');
    }
  };

  const handleDownloadTemplate = () => {
    const csv = buildCSV(STUDENT_CSV_HEADERS, STUDENT_TEMPLATE_ROWS);
    downloadCSV(`pathshala-${pathshala.paathshala_code}-student-template.csv`, csv);
    toast.success('Template downloaded');
  };

  const handleExportStudents = () => {
    if (!myStudents.length) { toast.error('No students to export'); return; }
    const rows = myStudents.map(s => [s.roll_no, s.name, s.parent_name || s.father_name || '', s.mobile || '']);
    const csv = buildCSV(['Roll No', 'Student Name', "Father/Mother's Name", 'Mobile Number'], rows);
    downloadCSV(`pathshala-${pathshala.paathshala_code}-students.csv`, csv);
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvResult(null);
    setCsvUploading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async ({ data, errors: parseErrors }) => {
        if (parseErrors.length) {
          toast.error('CSV parse error: ' + parseErrors[0].message);
          setCsvUploading(false);
          return;
        }

        const rows = data.map(row => {
          // Flexible header matching
          const name =
            row['Student Name'] || row['Name'] || row['name'] || '';
          const parent_name =
            row["Father/Mother's Name"] || row['Father Name'] || row['Father/Mother Name'] ||
            row['parent_name'] || row['Parent Name'] || '';
          const mobile =
            row['Mobile Number'] || row['Mobile'] || row['mobile'] || '';
          return { name: name.trim(), parent_name: parent_name.trim(), mobile: mobile.trim() };
        }).filter(r => r.name);

        if (!rows.length) {
          toast.error('No valid student rows found in CSV');
          setCsvUploading(false);
          return;
        }

        const result = await importStudentsFromCSV(pathshala, rows);
        setCsvUploading(false);
        setCsvResult(result);
        if (result.success) {
          toast.success(`${result.count} students imported!`);
        } else {
          toast.error(result.error || 'Import failed');
        }
      },
    });

    e.target.value = '';
  };

  const handleDeleteStudent = async (id) => {
    const result = await deleteStudent(id);
    if (result.success) toast.success('Student removed');
    else toast.error(result.error || 'Delete failed');
    setDeleteStudentId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-forest-700 hover:text-forest-900 text-sm flex items-center gap-1">
          ← Back to list
        </button>
      </div>

      {/* Pathshala Info Card */}
      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="bg-forest-700 text-white text-lg font-bold rounded-lg w-12 h-12 flex items-center justify-center flex-shrink-0">
              {pathshala.paathshala_code}
            </span>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{pathshala.paathshala_name}</h2>
              {pathshala.address && <p className="text-sm text-gray-500">{pathshala.address}</p>}
            </div>
          </div>
          <button
            onClick={onEdit}
            className="px-3 py-1.5 text-sm border border-forest-600 text-forest-700 rounded hover:bg-forest-50"
          >
            Edit
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {pathshala.teacher1_name && (
            <div>
              <div className="text-gray-500 text-xs mb-0.5">Primary Teacher</div>
              <div className="font-medium">{pathshala.teacher1_name}</div>
              {pathshala.teacher1_mobile && <div className="text-gray-500">{pathshala.teacher1_mobile}</div>}
            </div>
          )}
          {pathshala.teacher2_name && (
            <div>
              <div className="text-gray-500 text-xs mb-0.5">Secondary Teacher</div>
              <div className="font-medium">{pathshala.teacher2_name}</div>
              {pathshala.teacher2_mobile && <div className="text-gray-500">{pathshala.teacher2_mobile}</div>}
            </div>
          )}
          {pathshala.mandal_president_name && (
            <div>
              <div className="text-gray-500 text-xs mb-0.5">Mandal President</div>
              <div className="font-medium">{pathshala.mandal_president_name}</div>
              {pathshala.mandal_president_mobile && <div className="text-gray-500">{pathshala.mandal_president_mobile}</div>}
            </div>
          )}
          {pathshala.pathshala_type && (
            <div>
              <div className="text-gray-500 text-xs mb-0.5">Type</div>
              <div className="font-medium">{pathshala.pathshala_type}</div>
            </div>
          )}
          {pathshala.classes_conducted?.length > 0 && (
            <div>
              <div className="text-gray-500 text-xs mb-0.5">Classes</div>
              <div className="font-medium">{pathshala.classes_conducted.join(', ')}</div>
            </div>
          )}
        </div>

        {/* Student count summary */}
        {(pathshala.students_2_5 || pathshala.students_6_10 || pathshala.students_11_15 || pathshala.students_15_21) ? (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-2">Registered Student Counts (Age-wise)</div>
            <div className="flex flex-wrap gap-3">
              {[['2–5 yrs', pathshala.students_2_5], ['6–10 yrs', pathshala.students_6_10], ['11–15 yrs', pathshala.students_11_15], ['15–21 yrs', pathshala.students_15_21]].map(([label, count]) => (
                count > 0 ? (
                  <div key={label} className="bg-saffron-50 border border-saffron-200 rounded px-3 py-1 text-sm">
                    <span className="font-semibold">{count}</span> <span className="text-gray-600">{label}</span>
                  </div>
                ) : null
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Students Section */}
      <div className="bg-white rounded-xl shadow">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-700">
            Students
            <span className="ml-2 bg-forest-100 text-forest-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {myStudents.length}
            </span>
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
            >
              ⬇ CSV Template
            </button>
            {myStudents.length > 0 && (
              <button
                onClick={handleExportStudents}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
              >
                ⬇ Export Students
              </button>
            )}
            <label className={`px-3 py-1.5 text-xs rounded cursor-pointer flex items-center gap-1 ${csvUploading ? 'bg-gray-100 text-gray-400' : 'bg-saffron-500 text-white hover:bg-saffron-600'}`}>
              {csvUploading ? '⏳ Uploading…' : '⬆ Upload CSV'}
              <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" disabled={csvUploading} />
            </label>
            <button
              onClick={() => setShowAddStudent(true)}
              className="px-3 py-1.5 text-xs bg-forest-700 text-white rounded hover:bg-forest-800 flex items-center gap-1"
            >
              + Add Student
            </button>
          </div>
        </div>

        {csvResult && (
          <div className={`mx-5 mt-4 px-4 py-2 rounded text-sm ${csvResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {csvResult.success ? `✓ ${csvResult.count} students imported successfully` : `✗ ${csvResult.error}`}
          </div>
        )}

        {myStudents.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <div className="text-4xl mb-2">👥</div>
            <div className="text-sm">No students yet. Add manually or upload CSV.</div>
            <div className="text-xs mt-1 text-gray-400">Roll numbers will be auto-generated as {String(pathshala.paathshala_code).padStart(2,'0')}01, {String(pathshala.paathshala_code).padStart(2,'0')}02…</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Roll No</th>
                  <th className="px-5 py-3 text-left">Student Name</th>
                  <th className="px-5 py-3 text-left">Father/Mother</th>
                  <th className="px-5 py-3 text-left">Mobile</th>
                  <th className="px-5 py-3 text-left">Pathshala</th>
                  <th className="px-5 py-3 text-left">Teacher</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {myStudents.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <span className="font-mono font-bold text-forest-700 bg-forest-50 px-2 py-0.5 rounded">
                        {s.roll_no}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium">{s.name}</td>
                    <td className="px-5 py-3 text-gray-600">{s.parent_name || s.father_name || '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{s.mobile || '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{s.pathshala || '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{s.group || '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setDeleteStudentId(s.id)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddStudent && (
        <StudentFormModal
          pathshala={pathshala}
          onSave={handleAddStudent}
          onClose={() => setShowAddStudent(false)}
        />
      )}

      {deleteStudentId && (
        <ConfirmDialog
          message="Remove this student from the pathshala?"
          onConfirm={() => handleDeleteStudent(deleteStudentId)}
          onCancel={() => setDeleteStudentId(null)}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminPathshala() {
  const { paathshalas, students, loading, fetchPathashalas, addPathshala, updatePathshala, deletePathshala } = usePathshalaStore();
  const [selected, setSelected] = useState(null);     // selected paathshala object
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // for editing
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchPathashalas(); }, []);

  // Keep selected in sync after store updates
  useEffect(() => {
    if (selected) {
      const updated = paathshalas.find(p => p.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [paathshalas]);

  const filtered = paathshalas.filter(p =>
    !search || p.paathshala_name.toLowerCase().includes(search.toLowerCase()) ||
    p.paathshala_code.includes(search) ||
    (p.teacher1_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (form) => {
    if (editTarget) {
      const result = await updatePathshala(editTarget.id, form);
      if (result.success) { toast.success('Pathshala updated'); setShowForm(false); setEditTarget(null); }
      else toast.error(result.error);
    } else {
      const result = await addPathshala(form);
      if (result.success) { toast.success(`Pathshala registered! Code: ${result.code}`); setShowForm(false); }
      else toast.error(result.error);
    }
  };

  const handleDelete = async (id) => {
    const result = await deletePathshala(id);
    if (result.success) { toast.success('Pathshala deleted'); setSelected(null); }
    else toast.error(result.error);
    setDeleteId(null);
  };

  const openEdit = (p) => {
    setEditTarget(p);
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <div className="text-3xl mb-2">⏳</div>
          <div>Loading Paathshalas…</div>
        </div>
      </div>
    );
  }

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selected && !showForm) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <PathshalaDetail
          pathshala={selected}
          students={students}
          onBack={() => setSelected(null)}
          onEdit={() => openEdit(selected)}
        />
        {showForm && (
          <PathshalaFormModal
            initial={editTarget}
            onSave={handleSave}
            onClose={() => { setShowForm(false); setEditTarget(null); }}
          />
        )}
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Paathshala Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {paathshalas.length} paathshala{paathshalas.length !== 1 ? 's' : ''} registered
            &nbsp;·&nbsp;
            {students.length} students enrolled
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true); }}
          className="px-4 py-2 bg-forest-700 text-white rounded-lg font-semibold text-sm hover:bg-forest-800"
        >
          + Register Pathshala
        </button>
      </div>

      {/* Search */}
      {paathshalas.length > 4 && (
        <input
          className="w-full mb-4 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
          placeholder="Search by name, code or teacher…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      )}

      {/* Empty state */}
      {paathshalas.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-3">🏫</div>
          <div className="font-semibold text-lg mb-1">No Paathshalas Registered</div>
          <div className="text-sm mb-4">Register the first paathshala to get started</div>
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2 bg-forest-700 text-white rounded-lg font-semibold text-sm hover:bg-forest-800"
          >
            Register First Pathshala
          </button>
        </div>
      )}

      {/* Grid of cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p => {
          const myStudents = students.filter(s => s.paathshala_code === p.paathshala_code);
          return (
            <div
              key={p.id}
              className="bg-white rounded-xl shadow hover:shadow-md transition-shadow cursor-pointer border border-gray-100"
              onClick={() => setSelected(p)}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <span className="bg-forest-700 text-white font-bold rounded-lg w-10 h-10 flex items-center justify-center text-sm flex-shrink-0">
                    {p.paathshala_code}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-800 truncate">{p.paathshala_name}</div>
                    {p.address && <div className="text-xs text-gray-500 truncate mt-0.5">{p.address}</div>}
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-xs text-gray-600">
                  {p.teacher1_name && (
                    <div className="flex items-center gap-1.5">
                      <span>👤</span>
                      <span className="truncate">{p.teacher1_name}</span>
                      {p.teacher1_mobile && <span className="text-gray-400">{p.teacher1_mobile}</span>}
                    </div>
                  )}
                  {p.pathshala_type && (
                    <div className="flex items-center gap-1.5">
                      <span>🕐</span>
                      <span>{p.pathshala_type}</span>
                    </div>
                  )}
                  {p.classes_conducted?.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span>📚</span>
                      <span className="truncate">{p.classes_conducted.join(', ')}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs bg-forest-50 text-forest-700 font-semibold px-2 py-1 rounded-full">
                    {myStudents.length} student{myStudents.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => openEdit(p)}
                      className="text-xs text-gray-500 hover:text-forest-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(p.id)}
                      className="text-xs text-gray-500 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <PathshalaFormModal
          initial={editTarget}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}

      {deleteId && (
        <ConfirmDialog
          message="Delete this pathshala? This will not delete enrolled students."
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
