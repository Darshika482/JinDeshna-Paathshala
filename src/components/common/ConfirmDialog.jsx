import { useTranslation } from 'react-i18next';

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger = false, confirmLabel, cancelLabel }) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 fade-in">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title || t('common.areYouSure')}</h3>
        {message && <p className="text-gray-600 mb-6">{message}</p>}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 btn-outline text-base py-3"
          >
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 text-white font-semibold py-3 rounded-xl text-base active:scale-95 transition-all
              ${danger ? 'bg-red-600' : 'bg-saffron-500'}`}
          >
            {confirmLabel || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
