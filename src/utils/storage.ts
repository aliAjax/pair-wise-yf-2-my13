import type { Bench, BenchExperience, BenchVersion } from '@/types';
import {
  dateKey,
  dedupeVersions,
  getEffectiveVersion,
  isMaterialType,
  isOrientationType,
} from '@/utils/version';
import type { MaterialType, OrientationType } from '@/types';

const STORAGE_KEY = 'bench-archive-data';

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function material(value: unknown, fallback: MaterialType): MaterialType {
  return typeof value === 'string' && isMaterialType(value) ? value : fallback;
}

function orientation(value: unknown, fallback: OrientationType): OrientationType {
  return typeof value === 'string' && isOrientationType(value) ? value : fallback;
}

/**
 * 兼容旧档案：没有改造履历的长椅补一条首版（生效日期取创建日期），
 * 旧体验默认对应改前的最早版本；顶层材质/靠背/朝向同步为当前生效版本。
 */
export function normalizeBench(raw: unknown, indexKey = 0): Bench {
  const record = isRecord(raw) ? raw : {};
  const today = dateKey();
  const id = str(record.id) ?? `bench-${Date.now()}-${indexKey}`;

  let versions: BenchVersion[] = [];
  if (Array.isArray(record.versions)) {
    for (const item of record.versions) {
      if (!isRecord(item)) continue;
      const effectiveDate = str(item.effectiveDate);
      const mat = str(item.material);
      const ori = str(item.orientation);
      const hasBack = bool(item.hasBackrest);
      if (
        !effectiveDate ||
        !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ||
        !mat ||
        !isMaterialType(mat) ||
        !ori ||
        !isOrientationType(ori) ||
        hasBack === undefined
      ) {
        continue;
      }
      versions.push({
        id: str(item.id) ?? `${id}-v${versions.length}`,
        effectiveDate,
        material: mat,
        orientation: ori,
        hasBackrest: hasBack,
      });
    }
  }

  if (versions.length === 0) {
    const createdRaw = str(record.createdAt);
    const created = createdRaw ? dateKey(new Date(createdRaw)) : today;
    versions = [
      {
        id: `${id}-v0`,
        effectiveDate: created <= today ? created : today,
        material: material(record.material, 'wood'),
        orientation: orientation(record.orientation, 'south'),
        hasBackrest: bool(record.hasBackrest) ?? true,
      },
    ];
  }
  versions = dedupeVersions(versions);

  const firstVersionId = versions[0].id;
  const validIds = new Set(versions.map((v) => v.id));
  const experiences: BenchExperience[] = [];
  if (Array.isArray(record.experiences)) {
    for (const item of record.experiences) {
      if (!isRecord(item)) continue;
      const versionId = str(item.versionId);
      experiences.push({
        id: str(item.id) ?? `${id}-exp-${Math.random().toString(36).slice(2)}`,
        benchId: id,
        versionId: versionId && validIds.has(versionId) ? versionId : firstVersionId,
        timePeriod: (str(item.timePeriod) as BenchExperience['timePeriod']) ?? 'morning',
        notes: str(item.notes) ?? '',
        rating: num(item.rating) ?? 3,
      });
    }
  }

  // 构造一个临时对象以复用生效版本选择逻辑
  const draft = {
    ...record,
    id,
    name: str(record.name) ?? '未命名长椅',
    location: str(record.location) ?? '',
    lat: num(record.lat) ?? 31.23,
    lng: num(record.lng) ?? 121.47,
    material: material(record.material, versions[0].material),
    orientation: orientation(record.orientation, versions[0].orientation),
    hasBackrest: bool(record.hasBackrest) ?? versions[0].hasBackrest,
    versions,
  } as unknown as Bench;
  const effective = getEffectiveVersion(draft, today);

  return {
    ...draft,
    material: effective.material,
    orientation: effective.orientation,
    hasBackrest: effective.hasBackrest,
    shadeLevel: (str(record.shadeLevel) as Bench['shadeLevel']) ?? 'partial',
    noiseLevel: (str(record.noiseLevel) as Bench['noiseLevel']) ?? 'moderate',
    stayDuration: (str(record.stayDuration) as Bench['stayDuration']) ?? 'medium',
    rating: num(record.rating) ?? 3,
    review: str(record.review) ?? '',
    experiences,
    createdAt: str(record.createdAt) ?? new Date().toISOString(),
    updatedAt:
      str(record.updatedAt) ?? str(record.createdAt) ?? new Date().toISOString(),
  };
}

export function loadBenches(): Bench[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed: unknown = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.map((raw, i) => normalizeBench(raw, i));
      }
    }
  } catch (error) {
    console.error('Failed to load benches from localStorage:', error);
  }
  return [];
}

export function saveBenches(benches: Bench[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(benches));
  } catch (error) {
    console.error('Failed to save benches to localStorage:', error);
  }
}

export function clearBenches(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear benches from localStorage:', error);
  }
}
