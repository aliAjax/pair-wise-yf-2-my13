import {
  MATERIAL_LABELS,
  ORIENTATION_LABELS,
} from '@/types';
import type {
  Bench,
  BenchVersion,
  MaterialType,
  OrientationType,
} from '@/types';

/** 本地时区下的 YYYY-MM-DD */
export function dateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function sortVersions(versions: BenchVersion[]): BenchVersion[] {
  return [...versions].sort((a, b) =>
    a.effectiveDate < b.effectiveDate
      ? -1
      : a.effectiveDate > b.effectiveDate
        ? 1
        : 0
  );
}

/**
 * 同一天只留一次：按日期去重，后出现的覆盖先出现的，
 * 再按生效日期升序排列，保证后一次不会早于上一次。
 */
export function dedupeVersions(versions: BenchVersion[]): BenchVersion[] {
  const byDate = new Map<string, BenchVersion>();
  for (const v of versions) {
    byDate.set(v.effectiveDate, v);
  }
  return sortVersions([...byDate.values()]);
}

export type VersionValidationError =
  | 'empty'
  | 'bad-date'
  | 'duplicate-date'
  | 'non-increasing'
  | 'first-in-future';

export function validateVersions(
  versions: Pick<BenchVersion, 'effectiveDate'>[],
  today: string = dateKey()
): VersionValidationError | null {
  if (versions.length === 0) return 'empty';

  const dates = versions.map((v) => v.effectiveDate);
  if (dates.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) return 'bad-date';
  if (new Set(dates).size !== dates.length) return 'duplicate-date';

  // 直接按录入顺序检查：后一次不能早于上一次
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] <= dates[i - 1]) return 'non-increasing';
  }
  if (dates[0] > today) return 'first-in-future';
  return null;
}

export const VERSION_ERROR_MESSAGES: Record<VersionValidationError, string> = {
  empty: '至少保留一个改造版本（初始配置）',
  'bad-date': '生效日期格式不正确',
  'duplicate-date': '同一天只能有一次改造记录',
  'non-increasing': '后一次改造的生效日期不能早于上一次',
  'first-in-future': '首个版本的生效日期不能晚于今天',
};

/** 当前日期下生效的版本：生效日期不晚于今天的最近一次 */
export function getEffectiveVersion(
  bench: Bench,
  today: string = dateKey()
): BenchVersion {
  const versions = sortVersions(bench.versions ?? []);
  const effective = [...versions].reverse().find((v) => v.effectiveDate <= today);
  if (effective) return effective;
  // 兼容尚未迁移的旧数据：材质/靠背/朝向回退到档案顶层字段
  return {
    id: 'legacy',
    effectiveDate: dateKey(new Date(bench.createdAt)) <= today
      ? dateKey(new Date(bench.createdAt))
      : today,
    material: bench.material,
    orientation: bench.orientation,
    hasBackrest: bench.hasBackrest,
  };
}

/** 尚未生效的版本，按生效日期升序，仅用于预告 */
export function getUpcomingVersions(
  bench: Bench,
  today: string = dateKey()
): BenchVersion[] {
  return sortVersions(bench.versions ?? []).filter((v) => v.effectiveDate > today);
}

export function getVersionById(bench: Bench, versionId?: string): BenchVersion | undefined {
  if (!versionId) return sortVersions(bench.versions ?? [])[0];
  return bench.versions?.find((v) => v.id === versionId);
}

/** 体验记录实际对应的版本：找不到时回退到最早的改前版本 */
export function resolveExperienceVersion(
  bench: Bench,
  versionId?: string
): BenchVersion {
  const versions = sortVersions(bench.versions ?? []);
  if (versionId) {
    const found = versions.find((v) => v.id === versionId);
    if (found) return found;
  }
  return versions[0] ?? getEffectiveVersion(bench);
}

export function describeVersion(version: Pick<BenchVersion, 'material' | 'orientation' | 'hasBackrest'>): string {
  return `${MATERIAL_LABELS[version.material]} · ${ORIENTATION_LABELS[version.orientation]} · ${version.hasBackrest ? '有靠背' : '无靠背'}`;
}

export function isMaterialType(value: string): value is MaterialType {
  return value in MATERIAL_LABELS;
}

export function isOrientationType(value: string): value is OrientationType {
  return value in ORIENTATION_LABELS;
}
