import { create } from 'zustand';
import type { Bench, BenchExperience, BenchVersion, MaterialType, OrientationType, ShadeLevelType, NoiseLevelType } from '@/types';
import { loadBenches, saveBenches, normalizeBench } from '@/utils/storage';
import { generateId } from '@/utils/comfort';
import {
  dateKey,
  dedupeVersions,
  getEffectiveVersion,
  validateVersions,
  type VersionValidationError,
} from '@/utils/version';
import { mockBenches } from '@/data/mockBenches';

interface BenchState {
  benches: Bench[];
  searchQuery: string;
  materialFilter: MaterialType | null;
  orientationFilter: OrientationType | null;
  shadeFilter: ShadeLevelType | null;
  noiseFilter: NoiseLevelType | null;
  initialized: boolean;
}

type BenchCore = Omit<Bench, 'id' | 'createdAt' | 'updatedAt' | 'experiences' | 'versions'> & {
  versions?: BenchVersion[];
};

interface BenchActions {
  initialize: () => void;
  setSearchQuery: (query: string) => void;
  setMaterialFilter: (material: MaterialType | null) => void;
  setOrientationFilter: (orientation: OrientationType | null) => void;
  setShadeFilter: (shade: ShadeLevelType | null) => void;
  setNoiseFilter: (noise: NoiseLevelType | null) => void;
  clearFilters: () => void;
  addBench: (bench: BenchCore) => void;
  updateBench: (id: string, updates: Partial<Bench>) => void;
  updateVersions: (id: string, versions: BenchVersion[]) => VersionValidationError | null;
  deleteBench: (id: string) => void;
  getBenchById: (id: string) => Bench | undefined;
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
      set({ benches: stored, initialized: true });
    } else {
      const seeded = mockBenches.map((bench, i) => normalizeBench(bench, i));
      set({ benches: seeded, initialized: true });
      saveBenches(seeded);
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
    // 新建档案时首版即为当前配置，同日只留一次
    const versions = dedupeVersions(
      (benchData.versions ?? []).length > 0
        ? benchData.versions
        : [
            {
              id: generateId(),
              effectiveDate: dateKey(),
              material: benchData.material,
              orientation: benchData.orientation,
              hasBackrest: benchData.hasBackrest,
            },
          ]
    );
    const first = versions[0];
    const newBench: Bench = {
      ...benchData,
      material: first.material,
      orientation: first.orientation,
      hasBackrest: first.hasBackrest,
      id: generateId(),
      versions,
      experiences: [],
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

  updateVersions: (id, incoming) => {
    const bench = get().benches.find((b) => b.id === id);
    if (!bench) return 'empty';

    // 同一天只留一次；后一次不能早于上一次；首版不能晚于今天
    const versions = dedupeVersions(incoming);
    const error = validateVersions(versions);
    if (error) return error;

    const remainingIds = new Set(versions.map((v) => v.id));
    const fallbackId = versions[0].id;
    const experiences = bench.experiences.map((exp) =>
      exp.versionId && remainingIds.has(exp.versionId)
        ? exp
        : { ...exp, versionId: fallbackId }
    );

    const effective = getEffectiveVersion({ ...bench, versions }, dateKey());

    const newBenches = get().benches.map((b) =>
      b.id === id
        ? {
            ...b,
            versions,
            experiences,
            // 顶层字段跟随当前生效版本，供旧界面与迁移兜底使用
            material: effective.material,
            orientation: effective.orientation,
            hasBackrest: effective.hasBackrest,
            updatedAt: new Date().toISOString(),
          }
        : b
    );
    set({ benches: newBenches });
    saveBenches(newBenches);
    return null;
  },

  deleteBench: (id) => {
    // 移走长椅时改造履历与体验一并清理，数据仅保存在浏览器本地
    const newBenches = get().benches.filter((bench) => bench.id !== id);
    set({ benches: newBenches });
    saveBenches(newBenches);
  },

  getBenchById: (id) => {
    return get().benches.find((bench) => bench.id === id);
  },

  addExperience: (benchId, experienceData) => {
    const bench = get().benches.find((b) => b.id === benchId);
    // 新体验默认记录在当前生效版本（当下的新配置）下
    const versionId =
      experienceData.versionId ??
      (bench ? getEffectiveVersion(bench, dateKey()).id : undefined);
    const newExperience: BenchExperience = {
      ...experienceData,
      versionId,
      id: generateId(),
      benchId,
    };
    const newBenches = get().benches.map((b) =>
      b.id === benchId
        ? {
            ...b,
            experiences: [...b.experiences, newExperience],
            updatedAt: new Date().toISOString(),
          }
        : b
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
    const today = dateKey();

    return benches.filter((bench) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = bench.name.toLowerCase().includes(query);
        const matchLocation = bench.location.toLowerCase().includes(query);
        const matchReview = bench.review.toLowerCase().includes(query);
        if (!matchName && !matchLocation && !matchReview) return false;
      }

      // 材质/朝向随改造履历变化，筛选按当前生效版本
      const effective = getEffectiveVersion(bench, today);
      if (materialFilter && effective.material !== materialFilter) return false;
      if (orientationFilter && effective.orientation !== orientationFilter) return false;
      if (shadeFilter && bench.shadeLevel !== shadeFilter) return false;
      if (noiseFilter && bench.noiseLevel !== noiseFilter) return false;

      return true;
    });
  },
}));
