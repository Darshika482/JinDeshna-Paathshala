import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStudentStore } from '../../store/useStudentStore.js';
import { usePathshalaStore } from '../../store/usePathshalaStore.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import Papa from 'papaparse';
import { getTeacherNameForClass } from '../../lib/classTeachers.js';

const EMPTY_STUDENT = {
  roll_no: '', name: '', mobile: '', gender: '', batch: '', class: '', room_no: '', group: '',
  parent_name: '', mother_name: '', age: '', reg_id: '', city: '', pin_code: '', address: '',
  pathshala: '', achievements: '', teacher1_name: '', teacher2_name: '', teacher_mobile: '',
};

const CSV_HEADERS = [
  'Roll Number', 'Reg ID', 'Child Name',
  'Gender', 'Age', 'DOB',
  'Allotted Book', 'Class', 'Room No.',
  'Father Name', 'Mother Name', 'Mobile', 'WhatsApp',
  'City', 'Pin Code', 'Address',
  'Pathshala', 'Achievements',
  'Class Teacher',
];

const TEMPLATE_ROWS = [
  ['B001', 'CAMP-2026-XXXXX', 'Arham Jain', 'Boy',  '9', '2016-06-26', 'Bhag-1', '1A', 'D1', 'Vikram Jain', 'Preeti Jain', '9179105875', '9179105875', 'Indore', '452001', '12 MG Road, Indore',      'Indore Pathshala', 'State Quiz Winner', 'Teacher 1A'],
  ['G001', 'CAMP-2026-YYYYY', 'Aarvi Jain', 'Girl', '9', '2016-07-03', 'Bhag-1', '1B', 'F3', 'Sachin Jain', 'Ritu Jain',   '7067514988', '7067514988', 'Bhopal', '462001', '45 Arera Colony, Bhopal', '',                 '',                  'Teacher 1B'],
];

const STUDENT_FILTERS = [
  { key: 'not_checked_in', label: 'Not Checked In' },
  { key: 'missing_roll', label: 'No Roll No' },
  { key: 'missing_class', label: 'No Class' },
  { key: 'missing_reg', label: 'No Reg ID' },
  { key: 'boy', label: 'Boys' },
  { key: 'girl', label: 'Girls' },
];

function toTitleCase(str) {
  if (!str) return '';
  return str.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function getFatherName(student) {
  return String(student?.parent_name || student?.father_name || '').trim();
}

function getTeacherMeta(student, fallbackTeacherName, pathshalaMap) {
  const pathshala = pathshalaMap.get(String(student?.paathshala_code || '').trim());
  const teacher1 = String(
    student?.teacher1_name ||
    student?.teacher_1 ||
    pathshala?.teacher1_name ||
    fallbackTeacherName ||
    ''
  ).trim();
  const teacher2 = String(
    student?.teacher2_name ||
    student?.teacher_2 ||
    pathshala?.teacher2_name ||
    ''
  ).trim();
  const teacherMobile = String(
    student?.teacher_mobile ||
    student?.teacher1_mobile ||
    student?.teacher_mobile_no ||
    pathshala?.teacher1_mobile ||
    ''
  ).trim();

  return {
    teacher1: teacher1 || '—',
    teacher2: teacher2 || '—',
    teacherMobile: teacherMobile || '—',
  };
}

function buildCSV(rows) {
  return [CSV_HEADERS, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function downloadCSV(filename, csvContent) {
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AdminStudents() {
  const { t, i18n } = useTranslation();
  const { students, addStudent, updateStudent, deleteStudent, importFromCSV } = useStudentStore();
  const paathshalas = usePathshalaStore(s => s.paathshalas || []);
  const isHindi = i18n.language === 'hi';

  const [searchQ, setSearchQ] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_STUDENT);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [errors, setErrors] = useState({});
  const [importResult, setImportResult] = useState(null); // { count, errors[] }
  const [csvPanelOpen, setCsvPanelOpen] = useState(window.innerWidth >= 768);
  const [activeFilters, setActiveFilters] = useState([]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const fileRef = useRef();

  const availableClasses = useMemo(() => {
    return [...new Set(
      students
        .map(s => String(s.class || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students]);

  const classCounts = useMemo(() => {
    return students.reduce((acc, student) => {
      const className = String(student.class || '').trim();
      if (!className) return acc;
      acc[className] = (acc[className] || 0) + 1;
      return acc;
    }, {});
  }, [students]);

  const pathshalaByCode = useMemo(() => {
    return new Map(
      paathshalas
        .filter(p => String(p?.paathshala_code || '').trim())
        .map(p => [String(p.paathshala_code).trim(), p])
    );
  }, [paathshalas]);

  const filterCounts = useMemo(() => ({
    not_checked_in: students.filter(s => !s.checked_in).length,
    missing_roll: students.filter(s => !String(s.roll_no || '').trim()).length,
    missing_class: students.filter(s => !String(s.class || '').trim()).length,
    missing_reg: students.filter(s => !String(s.reg_id || '').trim()).length,
    boy: students.filter(s => String(s.gender || '').toLowerCase() === 'boy').length,
    girl: students.filter(s => String(s.gender || '').toLowerCase() === 'girl').length,
  }), [students]);

  const filtered = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return students.filter(s => {
      const matchesSearch = !q ||
        s.name.toLowerCase().includes(q) ||
        (s.roll_no && s.roll_no.toLowerCase().includes(q)) ||
        (s.mobile && s.mobile.includes(q)) ||
        (s.class && s.class.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      return activeFilters.every(filterKey => {
        if (filterKey === 'not_checked_in') return !s.checked_in;
        if (filterKey === 'missing_roll') return !String(s.roll_no || '').trim();
        if (filterKey === 'missing_class') return !String(s.class || '').trim();
        if (filterKey === 'missing_reg') return !String(s.reg_id || '').trim();
        if (filterKey === 'boy') return String(s.gender || '').toLowerCase() === 'boy';
        if (filterKey === 'girl') return String(s.gender || '').toLowerCase() === 'girl';
        return true;
      }) && (selectedClass === 'all' || String(s.class || '').trim() === selectedClass);
    });
  }, [students, searchQ, activeFilters, selectedClass]);

  const toggleFilter = (filterKey) => {
    setActiveFilters((prev) =>
      prev.includes(filterKey)
        ? prev.filter(f => f !== filterKey)
        : [...prev, filterKey]
    );
  };

  const validate = () => {
    const e = {};
    if (!form.roll_no.trim()) e.roll_no = 'Roll number is required';
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.batch.trim()) e.batch = 'Book/Batch is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const { teacher1_name, teacher2_name, teacher_mobile, ...studentFields } = form;
    const normalized = {
      ...studentFields,
      name: toTitleCase(studentFields.name),
      parent_name: toTitleCase(studentFields.parent_name),
      mother_name: toTitleCase(studentFields.mother_name),
      age: studentFields.age ? (parseInt(studentFields.age) || null) : null,
    };
    const friendlyError = (msg) => {
      if (msg?.includes('duplicate key') || msg?.includes('unique constraint'))
        return `Roll No. "${form.roll_no}" already exists. Use a different Roll No.`;
      return msg;
    };
    if (editingId) {
      const result = await updateStudent(editingId, normalized);
      if (result && !result.success) {
        setErrors({ _db: friendlyError(result.error) });
        return;
      }
    } else {
      const result = await addStudent(normalized);
      if (result && !result.success) {
        setErrors({ _db: friendlyError(result.error) });
        return;
      }
    }
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_STUDENT);
    setErrors({});
  };

  const handleEdit = (s) => {
    setEditingId(s.id);
    setForm({
      roll_no: s.roll_no, name: s.name,
      mobile: s.mobile || '', gender: s.gender || '', batch: s.batch || '',
      class: s.class || '', room_no: s.room_no || '', group: s.group || '',
      parent_name: getFatherName(s), mother_name: s.mother_name || '',
      age: s.age || '', reg_id: s.reg_id || '',
      city: s.city || '', pin_code: s.pin_code || '', address: s.address || '',
      pathshala: s.pathshala || '', achievements: s.achievements || '',
      teacher1_name: s.teacher1_name || s.teacher_1 || '',
      teacher2_name: s.teacher2_name || s.teacher_2 || '',
      teacher_mobile: s.teacher_mobile || s.teacher1_mobile || s.teacher_mobile_no || '',
    });
    setShowForm(true);
    setErrors({});
  };

  const handleCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportResult(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const valid = results.data.filter(r => r['Child Name'] || r.Name || r.name);
        const rowErrors = results.data
          .filter(r => !r['Child Name'] && !r.Name && !r.name)
          .map((_, i) => `Row ${i + 1}: missing name`);

        if (valid.length === 0) {
          setImportResult({ count: 0, rowErrors: ['No valid rows found. Make sure column headers match the template.'] });
          return;
        }

        await importFromCSV(valid);
        setImportResult({ count: valid.length, rowErrors });
      },
    });
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    downloadCSV('shivir_students_template.csv', buildCSV(TEMPLATE_ROWS));
  };

  const handleExportAll = () => {
    const exportHeaders = ['Roll Number', 'Reg ID', 'Child Name', 'Gender', 'Age', 'DOB', 'Allotted Book', 'Class', 'Room No.', 'Class Teacher', 'Father Name', 'Mother Name', 'Mobile', 'WhatsApp', 'City', 'Pin Code', 'Address', 'Pathshala', 'Achievements', 'Checked In', 'Total Points'];
    const rows = students.map(s => [
      s.roll_no, s.reg_id || '', s.name, s.gender || '', s.age || '', s.dob || '',
      s.batch || '', s.class || '', s.room_no || '', s.group || '', getFatherName(s), s.mother_name || '', s.mobile || '',
      s.whatsapp || '', s.city || '', s.pin_code || '', s.address || '',
      s.pathshala || '', s.achievements || '',
      s.checked_in ? 'Yes' : 'No', s.total_points,
    ]);
    const csvContent = [exportHeaders, ...rows]
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    downloadCSV(`shivir_students_${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
  };

  return (
    <div className="p-3 sm:p-6">
      {/* Actions */}
      <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
        <input
          className="border-2 border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-saffron-500 w-full sm:w-64"
          placeholder="Search by name, roll or mobile..."
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
        />
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_STUDENT); setErrors({}); }}
          className="btn-secondary text-sm px-4 py-2 text-base"
        >
          + {t('admin.addStudent')}
        </button>
        <span className="text-sm text-gray-500 self-center ml-1">
          Showing {filtered.length} of {students.length} students
        </span>
      </div>

      <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(v => !v)}
            className="px-3 py-1.5 rounded-full border text-xs sm:text-sm font-semibold bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'} ({activeFilters.length + (selectedClass === 'all' ? 0 : 1)} active)
          </button>
          <span className="text-xs text-gray-500">
            Quick counts: 👦 {filterCounts.boy} • 👧 {filterCounts.girl} • ⏳ {filterCounts.not_checked_in} not checked in
          </span>
          {(activeFilters.length > 0 || selectedClass !== 'all') && (
            <button
              type="button"
              onClick={() => { setActiveFilters([]); setSelectedClass('all'); }}
              className="px-3 py-1.5 rounded-full border text-xs sm:text-sm font-semibold bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
            >
              Clear Filters
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 p-3">
              <div className="text-xs font-semibold text-gray-500 mb-2">Student Filters</div>
              <div className="space-y-2">
                {STUDENT_FILTERS.map((filter) => {
                  const checked = activeFilters.includes(filter.key);
                  const count = filterCounts[filter.key] || 0;
                  return (
                    <label key={filter.key} className="flex items-center justify-between gap-3 text-sm cursor-pointer">
                      <span className="text-gray-700">{filter.label}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">({count})</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFilter(filter.key)}
                          className="h-4 w-4 accent-forest-700"
                        />
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-3">
              <div className="text-xs font-semibold text-gray-500 mb-2">Class Allotted</div>
              <select
                className="input-field"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="all">All Classes</option>
                {availableClasses.map(className => (
                  <option key={className} value={className}>
                    {className} ({classCounts[className] || 0})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* CSV panel */}
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
        <button
          type="button"
          onClick={() => setCsvPanelOpen(v => !v)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="font-semibold text-blue-800 text-sm">Bulk Import / Export</span>
          <span className="text-blue-700 text-sm">{csvPanelOpen ? 'Hide' : 'Show'}</span>
        </button>

        {csvPanelOpen && (
          <>
            <p className="text-xs text-blue-600 mt-2 mb-3">
              Download the template, fill it in Excel or Google Sheets, then upload. Required columns:
              <span className="font-mono font-bold"> Roll Number, Child Name, Allotted Book</span> (others optional)
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-blue-300 text-blue-700 font-semibold text-sm rounded-xl hover:bg-blue-100 transition-colors"
              >
                📥 Download Template
              </button>
              <button
                onClick={() => { setImportResult(null); fileRef.current?.click(); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition-colors"
              >
                📤 Upload CSV
              </button>
              {students.length > 0 && (
                <button
                  onClick={handleExportAll}
                  className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 font-semibold text-sm rounded-xl hover:bg-gray-100 transition-colors"
                >
                  📊 Export All Students
                </button>
              )}
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
            </div>

            {/* Import result feedback */}
            {importResult && (
              <div className={`mt-3 p-3 rounded-xl text-sm ${importResult.count > 0 ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                {importResult.count > 0 && (
                  <div className="font-semibold">✅ {importResult.count} student{importResult.count > 1 ? 's' : ''} imported successfully</div>
                )}
                {importResult.rowErrors?.length > 0 && (
                  <div className="mt-1">
                    {importResult.rowErrors.map((err, i) => (
                      <div key={i} className="text-xs">⚠️ {err}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setEditingId(null); setErrors({}); } }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl fade-in">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
              <h3 className="font-bold text-forest-700 text-lg">{editingId ? t('admin.editStudent') : t('admin.addStudent')}</h3>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); setErrors({}); }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
              >✕</button>
            </div>
            <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-3 gap-3">
              {/* Reg ID — auto-generated by Supabase, read-only */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Reg ID</label>
                <div className="input-field bg-gray-50 text-gray-500 font-mono text-xs flex items-center min-h-[38px]">
                  {form.reg_id || <span className="italic text-gray-400">Auto-generated on save</span>}
                </div>
              </div>
              {[
                { key: 'roll_no',      label: 'Roll No.',             required: true  },
                { key: 'name',         label: 'Name (English)',        required: true  },
                { key: 'mobile',       label: "Parent's Mobile",       required: false },
                { key: 'age',          label: 'Age',                   required: false },
                { key: 'batch',        label: 'Age Group',             required: false },
                { key: 'group',        label: 'Class Group',           required: false },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    className={`input-field ${errors[f.key] ? 'border-red-400' : ''}`}
                    value={form[f.key]}
                    placeholder={f.key === 'batch' ? 'e.g. Bhag-1' : f.key === 'group' ? 'e.g. Children Group' : ''}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  />
                  {errors[f.key] && <p className="text-red-500 text-xs mt-1">{errors[f.key]}</p>}
                </div>
              ))}

              {/* Gender dropdown */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Gender</label>
                <select
                  className="input-field"
                  value={form.gender}
                  onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}
                >
                  <option value="">Select…</option>
                  <option value="Boy">Boy</option>
                  <option value="Girl">Girl</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Teacher 1</label>
                <input
                  className="input-field"
                  value={form.teacher1_name || ''}
                  placeholder="Teacher name"
                  onChange={e => setForm(p => ({ ...p, teacher1_name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Teacher 2</label>
                <input
                  className="input-field"
                  value={form.teacher2_name || ''}
                  placeholder="Teacher name"
                  onChange={e => setForm(p => ({ ...p, teacher2_name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Teacher Mobile</label>
                <input
                  className="input-field"
                  value={form.teacher_mobile || ''}
                  placeholder="Teacher mobile"
                  onChange={e => setForm(p => ({ ...p, teacher_mobile: e.target.value }))}
                />
              </div>
            </div>
            {errors._db && (
              <p className="px-6 pb-2 text-red-600 text-sm font-medium">{errors._db}</p>
            )}
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={handleSave} className="btn-primary text-base px-6 py-2">{t('common.save')}</button>
              <button onClick={() => { setShowForm(false); setEditingId(null); setErrors({}); }} className="btn-outline text-base px-6 py-2">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile cards */}
      <div className="md:hidden space-y-2.5">
        {filtered.map((s) => {
          const displayTeacher = isHindi
            ? (getTeacherNameForClass(s.class, true) || s.group || '—')
            : (s.group || getTeacherNameForClass(s.class, false) || '—');
          const teacherMeta = getTeacherMeta(s, displayTeacher, pathshalaByCode);
          return (
          <div key={s.id} className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-gray-500 font-mono">{s.roll_no}</div>
                <div className="font-semibold text-gray-900 truncate">{s.name}</div>
                {s.reg_id && <div className="text-[11px] text-gray-400 font-mono mt-0.5">Reg: {s.reg_id}</div>}
              </div>
              <div className="text-right">
                <div className="text-[11px] text-gray-500">Points</div>
                <div className="font-bold text-saffron-600">{s.total_points}</div>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-forest-100 text-forest-700 font-semibold">
                Age Group: {s.batch || '—'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-saffron-100 text-saffron-700 font-semibold">
                Class Group: {s.group || '—'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700">
                {s.gender || 'No Gender'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700">
                Age {s.age || '—'}
              </span>
            </div>
            <div className="mt-1 text-xs text-gray-500 truncate">Teacher 1: {teacherMeta.teacher1}</div>
            <div className="text-xs text-gray-500 truncate">Teacher 2: {teacherMeta.teacher2}</div>
            <div className="text-xs text-gray-500 truncate">Teacher Mobile: {teacherMeta.teacherMobile}</div>

            <div className="mt-2 text-xs text-gray-600 truncate">
              Parent's Mobile: {s.mobile || '—'}
            </div>

            <div className="mt-3 flex gap-2">
              <button onClick={() => handleEdit(s)} className="flex-1 py-2 rounded-xl border border-blue-200 text-blue-700 text-xs font-semibold">
                {t('common.edit')}
              </button>
              <button onClick={() => setDeleteId(s.id)} className="flex-1 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-semibold">
                {t('common.delete')}
              </button>
            </div>
          </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-gray-200">
            {t('common.noResults')}
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-forest-700 text-white">
              <tr>
                <th className="px-4 py-3 text-left">Roll</th>
                <th className="px-4 py-3 text-left">Reg ID</th>
                <th className="px-4 py-3 text-left">Name (English)</th>
                <th className="px-4 py-3 text-left">Parent's Mobile</th>
                <th className="px-4 py-3 text-left">Gender</th>
                <th className="px-4 py-3 text-left">Age</th>
                <th className="px-4 py-3 text-left">Age Group</th>
                <th className="px-4 py-3 text-left">Class Group</th>
                <th className="px-4 py-3 text-left">Teacher 1</th>
                <th className="px-4 py-3 text-left">Teacher 2</th>
                <th className="px-4 py-3 text-left">Teacher Mobile</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const displayTeacher = isHindi
                  ? (s.group_hi || getTeacherNameForClass(s.class, true) || s.group || '—')
                  : (s.group || getTeacherNameForClass(s.class, false) || s.group_hi || '—');
                const teacherMeta = getTeacherMeta(s, displayTeacher, pathshalaByCode);
                return (
                <tr key={s.id} className={`border-b last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.roll_no}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.reg_id || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{s.mobile || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{s.gender || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{s.age || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="bg-forest-100 text-forest-700 px-2 py-0.5 rounded-full text-xs font-semibold">{s.batch || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {s.group
                      ? <span className="bg-saffron-100 text-saffron-700 px-2 py-0.5 rounded-full text-xs font-semibold">{s.group}</span>
                      : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{teacherMeta.teacher1}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{teacherMeta.teacher2}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{teacherMeta.teacherMobile}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(s)} className="text-blue-600 hover:underline text-xs font-semibold">{t('common.edit')}</button>
                      <button onClick={() => setDeleteId(s.id)} className="text-red-500 hover:underline text-xs font-semibold">{t('common.delete')}</button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">{t('common.noResults')}</div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title={t('admin.deleteStudent')}
        message={t('admin.confirmDelete')}
        danger
        onConfirm={() => { deleteStudent(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
        confirmLabel={t('common.delete')}
      />
    </div>
  );
}
