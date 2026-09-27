import type { Bench, BenchRevision, MaterialType, OrientationType } from '@/types';
import { MATERIAL_LABELS, ORIENTATION_LABELS } from '@/types';

/** 本地当前日期，格式 YYYY-MM-DD */
export function todayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function sortRevisions(revisions: BenchRevision[]): BenchRevision[] {
  return [...revisions].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
}

/** 旧档案没有履历时，用档案现有字段补一条初始版本 */
export function ensureRevisions(bench: Bench): BenchRevision[] {
  if (bench.revisions && bench.revisions.length > 0) {
    return sortRevisions(bench.revisions);
  }
  return [
    {
      id: `${bench.id}-rev-initial`,
      effectiveDate: bench.createdAt ? bench.createdAt.slice(0, 10) : todayString(),
      material: bench.material,
      hasBackrest: bench.hasBackrest,
      orientation: bench.orientation,
    },
  ];
}

/** 按当前日期选用最近生效的版本 */
export function getEffectiveRevision(bench: Bench, date: string = todayString()): BenchRevision {
  const sorted = ensureRevisions(bench);
  let current = sorted[0];
  for (const revision of sorted) {
    if (revision.effectiveDate <= date) {
      current = revision;
    } else {
      break;
    }
  }
  return current;
}

/** 尚未生效的版本（只显示预告） */
export function getUpcomingRevisions(bench: Bench, date: string = todayString()): BenchRevision[] {
  return ensureRevisions(bench).filter((revision) => revision.effectiveDate > date);
}

export interface EffectiveConfig {
  material: MaterialType;
  hasBackrest: boolean;
  orientation: OrientationType;
}

export function getEffectiveConfig(bench: Bench, date?: string): EffectiveConfig {
  const revision = getEffectiveRevision(bench, date);
  return {
    material: revision.material,
    hasBackrest: revision.hasBackrest,
    orientation: revision.orientation,
  };
}

export function describeRevision(revision: BenchRevision): string {
  const backrest = revision.hasBackrest ? '有靠背' : '无靠背';
  return `${MATERIAL_LABELS[revision.material]} · ${backrest} · 朝${ORIENTATION_LABELS[revision.orientation]}`;
}
