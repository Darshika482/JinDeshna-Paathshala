import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_BATCH_CLASSES = {
  'Bhag-1': ['1A', '1B', '1C', '1D', '1E', '1F', '1G', '1H'],
  'Bhag-2': ['2A', '2B', '2C'],
  'Bhag-3': ['3A', '3B'],
  'Bhag-4': ['4A'],
};

export const useConfigStore = create(
  persist(
    (set) => ({
      campName: 'JinDeshna Paathshala',
      campCity: '',
      campStartDate: '',
      campEndDate: '',
      campTotalDays: 7,
      adminPassword: '',
      coinkeeperPin: '',
      isSetupComplete: true,
      batchClasses: null, // null = use DEFAULT_BATCH_CLASSES

      saveCampConfig: (cfg) => set(cfg),
      saveBatchClasses: (batchClasses) => set({ batchClasses }),
      resetConfig: () => set({ campName: 'JinDeshna Paathshala', isSetupComplete: true, batchClasses: null }),
    }),
    { name: 'shiviros-config' }
  )
);
