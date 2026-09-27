import type { Bench, MaterialType, ShadeLevelType, NoiseLevelType } from '@/types';
import { getEffectiveVersion } from '@/utils/version';

const materialScores: Record<MaterialType, number> = {
  wood: 5,
  mixed: 4,
  stone: 3,
  metal: 2,
  plastic: 2,
};

const shadeScores: Record<ShadeLevelType, number> = {
  full: 5,
  partial: 3,
  none: 1,
};

const noiseScores: Record<NoiseLevelType, number> = {
  quiet: 5,
  moderate: 3,
  noisy: 1,
};

/**
 * 舒适度按当前日期生效的改造版本计分：
 * 材质与靠背取自最近生效版本，遮阴、噪音和个人评分仍取档案现值。
 */
export function calculateComfortScore(bench: Bench, today?: string): number {
  const version = getEffectiveVersion(bench, today);
  const backrestScore = version.hasBackrest ? 5 : 2;
  const shadeScore = shadeScores[bench.shadeLevel];
  const noiseScore = noiseScores[bench.noiseLevel];
  const materialScore = materialScores[version.material];
  const userRating = bench.rating;

  const comfort = backrestScore * 0.2 + shadeScore * 0.2 + noiseScore * 0.2 + materialScore * 0.15 + userRating * 0.25;

  return Math.round(comfort * 10) / 10;
}

export function getComfortLevel(score: number): string {
  if (score >= 4.5) return '极佳';
  if (score >= 3.8) return '优秀';
  if (score >= 3.0) return '良好';
  if (score >= 2.0) return '一般';
  return '较差';
}

export function getComfortColor(score: number): string {
  if (score >= 4.5) return 'text-moss-green';
  if (score >= 3.8) return 'text-moss-light';
  if (score >= 3.0) return 'text-ochre';
  if (score >= 2.0) return 'text-ink-light';
  return 'text-red-500';
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
