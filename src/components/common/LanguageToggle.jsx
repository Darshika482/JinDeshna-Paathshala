import { useTranslation } from 'react-i18next';

export default function LanguageToggle({ compact = false }) {
  const { i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';

  const toggle = () => {
    const next = isHindi ? 'en' : 'hi';
    i18n.changeLanguage(next);
    localStorage.setItem('shivir-lang', next);
  };

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1 font-semibold rounded-lg border-2 transition-all active:scale-95
        ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'}
        border-saffron-500 text-saffron-500 hover:bg-saffron-50`}
      aria-label="Toggle language"
    >
      <span className={isHindi ? 'font-bold' : 'opacity-50'}>हिं</span>
      <span className="text-gray-400">|</span>
      <span className={!isHindi ? 'font-bold' : 'opacity-50'}>EN</span>
    </button>
  );
}
