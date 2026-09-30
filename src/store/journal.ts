import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { MilestoneId } from '../services/milestones';
import type { JournalEntry } from '../types';
import { createSampleEntries } from '../data/sampleEntries';
import { confirmRemoteJournalEntry, correctRemoteBristolType, type RemoteAnalysisQueueItem } from '../data/journalRepository';
import { ensureCollectibleIdentities } from '../services/collectibles';
import { getBristolOption, type BristolType } from '../services/bristol';

export const CONSENT_VERSION = '2026-09-02';
const STORE_VERSION = 7;

export type JournalDataScope = 'public_preview' | 'device_local' | 'authenticated';
export type RemoteSyncStatus = 'idle' | 'loading' | 'ready' | 'error';

function createPublicPreviewEntries() {
  return Platform.OS === 'web'
    ? ensureCollectibleIdentities(createSampleEntries().slice(0, 3))
    : [];
}

export type ConsentRecord = {
  version: string;
  acceptedAt: string;
  acceptedPrivacy: true;
  acceptedSensitiveProcessing: true;
  acceptedNonMedicalUse: true;
};

type JournalState = {
  hasHydrated: boolean;
  hasOnboarded: boolean;
  consent: ConsentRecord | null;
  entries: JournalEntry[];
  localEntries: JournalEntry[];
  dataScope: JournalDataScope;
  remoteUserId: string | null;
  remoteSyncStatus: RemoteSyncStatus;
  remoteSyncError: string | null;
  remotePendingAnalysisCount: number;
  remoteAnalysisQueue: RemoteAnalysisQueueItem[];
  seenMilestoneIds: MilestoneId[];
  setHasHydrated: (value: boolean) => void;
  completeOnboarding: () => void;
  acceptConsent: () => void;
  withdrawConsent: () => void;
  addEntry: (entry: JournalEntry) => void;
  addSampleEntries: () => void;
  activateRemoteScope: (userId: string) => void;
  replaceRemoteEntries: (userId: string, entries: JournalEntry[], pendingAnalysisCount: number, analysisQueue?: RemoteAnalysisQueueItem[]) => void;
  setRemoteSyncError: (userId: string, message: string) => void;
  activateLocalScope: () => void;
  confirmEntry: (id: string) => Promise<void>;
  updateBristolType: (id: string, type: BristolType) => Promise<void>;
  markMilestoneSeen: (id: MilestoneId) => void;
  markOriginalDeleted: (id: string) => void;
  deleteEntry: (id: string) => void;
};

export const useJournalStore = create<JournalState>()(
  persist(
    (set, get) => {
      const initialEntries = createPublicPreviewEntries();
      return {
      hasHydrated: false,
      hasOnboarded: false,
      consent: null,
      entries: initialEntries,
      localEntries: initialEntries,
      dataScope: Platform.OS === 'web' ? 'public_preview' : 'device_local',
      remoteUserId: null,
      remoteSyncStatus: 'idle',
      remoteSyncError: null,
      remotePendingAnalysisCount: 0,
      remoteAnalysisQueue: [],
      seenMilestoneIds: [],
      setHasHydrated: (value) => set({ hasHydrated: value }),
      completeOnboarding: () => set({ hasOnboarded: true }),
      acceptConsent: () => set({ consent: {
        version: CONSENT_VERSION,
        acceptedAt: new Date().toISOString(),
        acceptedPrivacy: true,
        acceptedSensitiveProcessing: true,
        acceptedNonMedicalUse: true,
      } }),
      withdrawConsent: () => set({ consent: null }),
      addEntry: (entry) => set((state) => {
        if (state.dataScope === 'authenticated') return state;
        const entries = ensureCollectibleIdentities([entry, ...state.localEntries]);
        return { entries, localEntries: entries };
      }),
      addSampleEntries: () => set((state) => {
        if (state.dataScope === 'authenticated') return state;
        const existingIds = new Set(state.localEntries.map((entry) => entry.id));
        const samples = createSampleEntries().filter((entry) => !existingIds.has(entry.id));
        const entries = ensureCollectibleIdentities([...samples, ...state.localEntries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        return { entries, localEntries: entries };
      }),
      activateRemoteScope: (userId) => set((state) => ({
        dataScope: 'authenticated',
        remoteUserId: userId,
        remoteSyncStatus: 'loading',
        remoteSyncError: null,
        entries: state.remoteUserId === userId ? state.entries : [],
        remotePendingAnalysisCount: state.remoteUserId === userId ? state.remotePendingAnalysisCount : 0,
        remoteAnalysisQueue: state.remoteUserId === userId ? state.remoteAnalysisQueue : [],
      })),
      replaceRemoteEntries: (userId, entries, pendingAnalysisCount, analysisQueue = []) => set((state) => state.remoteUserId === userId ? {
        entries,
        remoteSyncStatus: 'ready',
        remoteSyncError: null,
        remotePendingAnalysisCount: pendingAnalysisCount,
        remoteAnalysisQueue: analysisQueue,
      } : state),
      setRemoteSyncError: (userId, message) => set((state) => state.remoteUserId === userId ? {
        entries: [],
        remoteSyncStatus: 'error',
        remoteSyncError: message,
        remotePendingAnalysisCount: 0,
        remoteAnalysisQueue: [],
      } : state),
      activateLocalScope: () => set((state) => ({
        dataScope: Platform.OS === 'web' ? 'public_preview' : 'device_local',
        remoteUserId: null,
        remoteSyncStatus: 'idle',
        remoteSyncError: null,
        remotePendingAnalysisCount: 0,
        remoteAnalysisQueue: [],
        entries: state.localEntries,
      })),
      confirmEntry: async (id) => {
        const state = get();
        if (state.dataScope === 'authenticated') await confirmRemoteJournalEntry(id);
        set((current) => {
          const entries = current.entries.map((entry) => entry.id === id ? { ...entry, userConfirmed: true } : entry);
          return current.dataScope === 'authenticated' ? { entries } : { entries, localEntries: entries };
        });
      },
      updateBristolType: async (id, type) => {
        const state = get();
        if (state.dataScope === 'authenticated') {
          if (!state.remoteUserId) throw new Error('Authenticated journal owner is missing.');
          await correctRemoteBristolType(id, state.remoteUserId, type);
        }
        set((current) => {
        const option = getBristolOption(type);
        const entries = current.entries.map((entry) => entry.id === id ? {
          ...entry,
          userConfirmed: true,
          analysis: {
            ...entry.analysis,
            bristolType: type,
            shape: option.shape,
            texture: option.texture,
            correctedByUser: true,
            originalBristolType: entry.analysis.originalBristolType ?? entry.analysis.bristolType,
          },
        } : entry);
        return current.dataScope === 'authenticated' ? { entries } : { entries, localEntries: entries };
        });
      },
      markMilestoneSeen: (id) => set((state) => ({
        seenMilestoneIds: (state.seenMilestoneIds ?? []).includes(id)
          ? state.seenMilestoneIds
          : [...(state.seenMilestoneIds ?? []), id],
      })),
      markOriginalDeleted: (id) => set((state) => ({
        entries: state.entries.map((entry) => entry.id === id
          ? { ...entry, originalImageUri: undefined, originalImageStatus: 'deleted' }
          : entry),
      })),
      deleteEntry: (id) => set((state) => {
        if (state.dataScope === 'authenticated') return state;
        const entries = state.localEntries.filter((entry) => entry.id !== id);
        return { entries, localEntries: entries };
      }),
    };
    },
    {
      name: 'visual-gut-journal',
      storage: createJSONStorage(() => AsyncStorage),
      version: STORE_VERSION,
      migrate: (persistedState, version) => {
        const previous = persistedState as Partial<JournalState>;
        const previousEntries = previous.localEntries ?? previous.entries ?? [];
        const localEntries = ensureCollectibleIdentities(
          version < STORE_VERSION && previousEntries.length === 0
            ? createPublicPreviewEntries()
            : previousEntries,
        );
        return {
          ...previous,
          consent: version < 1 ? null : previous.consent,
          entries: localEntries,
          localEntries,
          dataScope: Platform.OS === 'web' ? 'public_preview' : 'device_local',
          remoteUserId: null,
          remoteSyncStatus: 'idle',
          remoteSyncError: null,
          remotePendingAnalysisCount: 0,
          remoteAnalysisQueue: [],
        };
      },
      partialize: ({ hasHydrated: _hasHydrated, ...state }) => ({
        ...state,
        entries: state.localEntries,
        dataScope: Platform.OS === 'web' ? 'public_preview' as const : 'device_local' as const,
        remoteUserId: null,
        remoteSyncStatus: 'idle' as const,
        remoteSyncError: null,
        remotePendingAnalysisCount: 0,
        remoteAnalysisQueue: [],
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
