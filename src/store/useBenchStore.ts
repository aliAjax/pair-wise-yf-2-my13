import { create } from 'zustand';
import type { Bench, BenchExperience, BenchRevision, MaterialType, OrientationType, ShadeLevelType, NoiseLevelType } from '@/types';
import { loadBenches, saveBenches } from '@/utils/storage';
import { generateId } from '@/utils/comfort';
import { ensureRevisions, getEffectiveConfig, getEffectiveRevision, sortRevisions, todayString } from '@/utils/revisions';
import { mockBenches } from '@/data/mockBenches';

/** 迁移旧档案：补改造履历，并把档案字段同步为当前生效版本 */
function migrateBench(bench: Bench): Bench {
  const revisions = ensureRevisions(bench);
  const config = getEffectiveConfig({ ...bench, revisions });
  return { ...bench, ...config, revisions };
}

interface BenchState {
  benches: Bench[];
  searchQuery: string;
  materialFilter: MaterialType | null;
  orientationFilter: OrientationType | null;
  shadeFilter: ShadeLevelType | null;
  noiseFilter: NoiseLevelType | null;
  initialized: boolean;
}

interface BenchActions {
  initialize: () => void;
  setSearchQuery: (query: string) => void;
  setMaterialFilter: (material: MaterialType | null) => void;
  setOrientationFilter: (orientation: OrientationType | null) => void;
  setShadeFilter: (shade: ShadeLevelType | null) => void;
  setNoiseFilter: (noise: NoiseLevelType | null) => void;
  clearFilters: () => void;
  addBench: (bench: Omit<Bench, 'id' | 'createdAt' | 'updatedAt' | 'experiences' | 'revisions'>) => void;
  updateBench: (id: string, updates: Partial<Bench>) => void;
  deleteBench: (id: string) => void;
  getBenchById: (id: string) => Bench | undefined;
  addRevision: (benchId: string, revision: Omit<BenchRevision, 'id'>) => boolean;
  addExperience: (benchId: string, experience: Omit<BenchExperience, 'id' | 'benchId'>) => void;
  updateExperience: (benchId: string, expId: string, updates: Partial<BenchExperience>) => void;
  deleteExperience: (benchId: string, expId: string) => void;
  getFilteredBenches: () => Bench[];
}

const initialState: BenchState = {
  benches: [],
  searchQuery: '',
  materialFilter: null,
  orientationFilter: null,
  shadeFilter: null,
  noiseFilter: null,
  initialized: false,
};

export const useBenchStore = create<BenchState & BenchActions>((set, get) => ({
  ...initialState,

  initialize: () => {
    const stored = loadBenches();
    if (stored.length > 0) {
      const migrated = stored.map(migrateBench);
      set({ benches: migrated, initialized: true });
      saveBenches(migrated);
    } else {
      const migrated = mockBenches.map(migrateBench);
      set({ benches: migrated, initialized: true });
      saveBenches(migrated);
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setMaterialFilter: (material) => set({ materialFilter: material }),
  setOrientationFilter: (orientation) => set({ orientationFilter: orientation }),
  setShadeFilter: (shade) => set({ shadeFilter: shade }),
  setNoiseFilter: (noise) => set({ noiseFilter: noise }),

  clearFilters: () => set({
    searchQuery: '',
    materialFilter: null,
    orientationFilter: null,
    shadeFilter: null,
    noiseFilter: null,
  }),

  addBench: (benchData) => {
    const now = new Date().toISOString();
    const initialRevision: BenchRevision = {
      id: generateId(),
      effectiveDate: todayString(),
      material: benchData.material,
      hasBackrest: benchData.hasBackrest,
      orientation: benchData.orientation,
    };
    const newBench: Bench = {
      ...benchData,
      id: generateId(),
      experiences: [],
      revisions: [initialRevision],
      createdAt: now,
      updatedAt: now,
    };
    const newBenches = [newBench, ...get().benches];
    set({ benches: newBenches });
    saveBenches(newBenches);
  },

  updateBench: (id, updates) => {
    const newBenches = get().benches.map((bench) =>
      bench.id === id
        ? { ...bench, ...updates, updatedAt: new Date().toISOString() }
        : bench
    );
    set({ benches: newBenches });
    saveBenches(newBenches);
  },

  deleteBench: (id) => {
    const newBenches = get().benches.filter((bench) => bench.id !== id);
    set({ benches: newBenches });
    saveBenches(newBenches);
  },

  getBenchById: (id) => {
    return get().benches.find((bench) => bench.id === id);
  },

  addRevision: (benchId, revisionData) => {
    const bench = get().benches.find((item) => item.id === benchId);
    if (!bench) return false;

    const sorted = sortRevisions(ensureRevisions(bench));
    const last = sorted[sorted.length - 1];
    // 后一次不能早于上一次
    if (last && revisionData.effectiveDate < last.effectiveDate) return false;

    const revision: BenchRevision = { ...revisionData, id: generateId() };
    // 同一天只留一次：与上一条同日则覆盖
    const revisions =
      last && revisionData.effectiveDate === last.effectiveDate
        ? [...sorted.slice(0, -1), revision]
        : [...sorted, revision];

    const config = getEffectiveConfig({ ...bench, revisions });
    const newBenches = get().benches.map((item) =>
      item.id === benchId
        ? { ...item, ...config, revisions, updatedAt: new Date().toISOString() }
        : item
    );
    set({ benches: newBenches });
    saveBenches(newBenches);
    return true;
  },

  addExperience: (benchId, experienceData) => {
    const bench = get().benches.find((item) => item.id === benchId);
    const revisionId = bench ? getEffectiveRevision(bench).id : undefined;
    const newExperience: BenchExperience = {
      ...experienceData,
      id: generateId(),
      benchId,
      revisionId,
    };
    const newBenches = get().benches.map((bench) =>
      bench.id === benchId
        ? {
            ...bench,
            experiences: [...bench.experiences, newExperience],
            updatedAt: new Date().toISOString(),
          }
        : bench
    );
    set({ benches: newBenches });
    saveBenches(newBenches);
  },

  updateExperience: (benchId, expId, updates) => {
    const newBenches = get().benches.map((bench) =>
      bench.id === benchId
        ? {
            ...bench,
            experiences: bench.experiences.map((exp) =>
              exp.id === expId ? { ...exp, ...updates } : exp
            ),
            updatedAt: new Date().toISOString(),
          }
        : bench
    );
    set({ benches: newBenches });
    saveBenches(newBenches);
  },

  deleteExperience: (benchId, expId) => {
    const newBenches = get().benches.map((bench) =>
      bench.id === benchId
        ? {
            ...bench,
            experiences: bench.experiences.filter((exp) => exp.id !== expId),
            updatedAt: new Date().toISOString(),
          }
        : bench
    );
    set({ benches: newBenches });
    saveBenches(newBenches);
  },

  getFilteredBenches: () => {
    const { benches, searchQuery, materialFilter, orientationFilter, shadeFilter, noiseFilter } = get();
    
    return benches.filter((bench) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = bench.name.toLowerCase().includes(query);
        const matchLocation = bench.location.toLowerCase().includes(query);
        const matchReview = bench.review.toLowerCase().includes(query);
        if (!matchName && !matchLocation && !matchReview) return false;
      }

      const config = getEffectiveConfig(bench);
      if (materialFilter && config.material !== materialFilter) return false;
      if (orientationFilter && config.orientation !== orientationFilter) return false;
      if (shadeFilter && bench.shadeLevel !== shadeFilter) return false;
      if (noiseFilter && bench.noiseLevel !== noiseFilter) return false;

      return true;
    });
  },
}));
