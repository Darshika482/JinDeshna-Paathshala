import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function OfflineBanner() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const go = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', go);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', go); window.removeEventListener('offline', off); };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-sm py-2 px-4 text-center">
      📡 {t('common.offline')}
    </div>
  );
}
