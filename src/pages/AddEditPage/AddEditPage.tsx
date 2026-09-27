import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  CloudSun,
  History,
  CalendarClock,
} from 'lucide-react';
import { useBenchStore } from '@/store/useBenchStore';
import {
  MATERIAL_LABELS,
  ORIENTATION_LABELS,
  SHADE_LABELS,
  NOISE_LABELS,
  STAY_DURATION_LABELS,
  TIME_PERIOD_LABELS,
} from '@/types';
import type {
  ShadeLevelType,
  NoiseLevelType,
  StayDurationType,
  TimePeriodType,
  BenchExperience,
  BenchVersion,
} from '@/types';
import Rating from '@/components/Rating/Rating';
import { generateId } from '@/utils/comfort';
import {
  dateKey,
  describeVersion,
  getEffectiveVersion,
  validateVersions,
  VERSION_ERROR_MESSAGES,
} from '@/utils/version';

function shiftDate(date: string, deltaDays: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return dateKey(d);
}

export default function AddEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const today = dateKey();

  const { getBenchById, addBench, updateBench, updateVersions, initialize, initialized, addExperience, updateExperience, deleteExperience } = useBenchStore();
  const existingBench = id ? getBenchById(id) : undefined;

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    lat: 31.23,
    lng: 121.47,
    shadeLevel: 'partial' as ShadeLevelType,
    noiseLevel: 'moderate' as NoiseLevelType,
    stayDuration: 'medium' as StayDurationType,
    rating: 3,
    review: '',
  });

  const [versions, setVersions] = useState<BenchVersion[]>([
    {
      id: generateId(),
      effectiveDate: today,
      material: 'wood',
      orientation: 'south',
      hasBackrest: true,
    },
  ]);

  const [experiences, setExperiences] = useState<BenchExperience[]>([]);

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  useEffect(() => {
    if (isEdit && existingBench && initialized) {
      setFormData({
        name: existingBench.name,
        location: existingBench.location,
        lat: existingBench.lat,
        lng: existingBench.lng,
        shadeLevel: existingBench.shadeLevel,
        noiseLevel: existingBench.noiseLevel,
        stayDuration: existingBench.stayDuration,
        rating: existingBench.rating,
        review: existingBench.review,
      });
      setVersions(existingBench.versions.map((v) => ({ ...v })));
      setExperiences(existingBench.experiences || []);
    }
  }, [isEdit, existingBench, initialized]);

  const handleChange = (field: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleVersionChange = (versionId: string, field: keyof BenchVersion, value: string | boolean) => {
    setVersions((prev) =>
      prev.map((v) => (v.id === versionId ? { ...v, [field]: value } : v))
    );
  };

  const handleAddVersion = () => {
    setVersions((prev) => {
      const last = prev[prev.length - 1];
      const nextDate =
        last.effectiveDate >= today
          ? shiftDate(last.effectiveDate, 1)
          : today;
      return [
        ...prev,
        {
          id: generateId(),
          effectiveDate: nextDate,
          material: last.material,
          orientation: last.orientation,
          hasBackrest: last.hasBackrest,
        },
      ];
    });
  };

  const handleDeleteVersion = (versionId: string) => {
    if (versions.length <= 1) return;
    setVersions((prev) => prev.filter((v) => v.id !== versionId));
    setExperiences((prev) => {
      const remaining = versions.filter((v) => v.id !== versionId);
      const fallback = remaining[0]?.id;
      return prev.map((exp) =>
        exp.versionId === versionId ? { ...exp, versionId: fallback } : exp
      );
    });
  };

  const handleAddExperience = () => {
    const defaultVersion = existingBench
      ? getEffectiveVersion(existingBench, today).id
      : versions.find((v) => v.effectiveDate <= today)?.id ?? versions[0]?.id;
    const newExp: BenchExperience = {
      id: generateId(),
      benchId: id || 'temp',
      versionId: defaultVersion,
      timePeriod: 'morning',
      notes: '',
      rating: 3,
    };
    setExperiences([...experiences, newExp]);
  };

  const handleUpdateExperience = (expId: string, field: string, value: string | number) => {
    setExperiences(
      experiences.map((exp) =>
        exp.id === expId ? { ...exp, [field]: value } : exp
      )
    );
  };

  const handleDeleteExperience = (expId: string) => {
    setExperiences(experiences.filter((exp) => exp.id !== expId));
    if (isEdit && id) {
      deleteExperience(id, expId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('请输入长椅名称');
      return;
    }
    if (!formData.location.trim()) {
      alert('请输入位置描述');
      return;
    }

    // 同一天只留一次，后一次不能早于上一次，首版不能晚于今天
    const versionError = validateVersions(versions);
    if (versionError) {
      alert(VERSION_ERROR_MESSAGES[versionError]);
      return;
    }

    if (isEdit && id) {
      updateBench(id, formData);
      const saveError = updateVersions(id, versions);
      if (saveError) {
        alert(VERSION_ERROR_MESSAGES[saveError]);
        return;
      }
      const validVersionIds = new Set(versions.map((v) => v.id));
      const fallbackVersionId = versions[0].id;
      experiences.forEach((exp) => {
        // 版本被删除时，体验回挂到最早的改前版本
        const safeExp = validVersionIds.has(exp.versionId ?? '')
          ? exp
          : { ...exp, versionId: fallbackVersionId };
        const existingExp = existingBench?.experiences.find((e) => e.id === exp.id);
        if (existingExp) {
          updateExperience(id, exp.id, safeExp);
        } else {
          addExperience(id, safeExp);
        }
      });
    } else {
      addBench({
        ...formData,
        // 顶层字段跟随首版，保存后由履历接管
        material: versions[0].material,
        orientation: versions[0].orientation,
        hasBackrest: versions[0].hasBackrest,
        versions,
      });
    }

    navigate(-1);
  };

  const timePeriodIcons: Record<TimePeriodType, typeof Sunrise> = {
    morning: Sunrise,
    noon: Sun,
    afternoon: CloudSun,
    evening: Sunset,
    night: Moon,
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-ink-light hover:text-deep-brown mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">返回</span>
      </button>

      <div className="max-w-3xl mx-auto">
        <h1 className="font-serif text-2xl font-bold text-deep-brown mb-6">
          {isEdit ? '编辑长椅档案' : '添加长椅档案'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-1">
            <h2 className="font-serif text-lg font-semibold text-deep-brown mb-4">
              基本信息
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  长椅名称 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="给这张长椅起个名字"
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown placeholder:text-ink-light/60 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  位置描述 *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="例如：人民公园东门北侧"
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown placeholder:text-ink-light/60 focus:bg-white transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-deep-brown mb-1.5">
                    纬度
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.lat}
                    onChange={(e) => handleChange('lat', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-deep-brown mb-1.5">
                    经度
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.lng}
                    onChange={(e) => handleChange('lng', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-2">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-serif text-lg font-semibold text-deep-brown flex items-center gap-2">
                <History className="w-5 h-5 text-moss-green" />
                改造履历
              </h2>
              <button
                type="button"
                onClick={handleAddVersion}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-moss-green hover:bg-moss-green/10 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加改造
              </button>
            </div>
            <p className="text-xs text-ink-light mb-4">
              按生效日期记录材质、靠背和朝向；同一天只留一次，后一次不能早于上一次。晚于今天的记录仅作预告。
            </p>

            <div className="space-y-3">
              {versions.map((version, index) => {
                const isFirst = index === 0;
                const isFuture = version.effectiveDate > today;
                return (
                  <div
                    key={version.id}
                    className="p-4 bg-warm-cream/50 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-deep-brown bg-white/70 px-2 py-0.5 rounded">
                          {isFirst ? '初始版本' : `第 ${index + 1} 次改造`}
                        </span>
                        {isFuture && (
                          <span className="inline-flex items-center gap-1 text-xs text-ochre bg-ochre/10 px-2 py-0.5 rounded">
                            <CalendarClock className="w-3 h-3" />
                            尚未生效
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteVersion(version.id)}
                        disabled={versions.length <= 1}
                        className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:text-ink-light/30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                        title={versions.length <= 1 ? '至少保留一个版本' : '删除该版本'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-ink-light mb-1 block">
                          生效日期
                        </label>
                        <input
                          type="date"
                          value={version.effectiveDate}
                          max={isFirst ? today : undefined}
                          min={!isFirst && versions[index - 1] ? shiftDate(versions[index - 1].effectiveDate, 1) : undefined}
                          onChange={(e) => handleVersionChange(version.id, 'effectiveDate', e.target.value)}
                          className="w-full px-2.5 py-2 text-sm bg-white/60 border border-deep-brown/10 rounded-md text-deep-brown focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-ink-light mb-1 block">
                          材质
                        </label>
                        <select
                          value={version.material}
                          onChange={(e) => handleVersionChange(version.id, 'material', e.target.value)}
                          className="w-full px-2.5 py-2 text-sm bg-white/60 border border-deep-brown/10 rounded-md text-deep-brown focus:bg-white cursor-pointer"
                        >
                          {Object.entries(MATERIAL_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-ink-light mb-1 block">
                          朝向
                        </label>
                        <select
                          value={version.orientation}
                          onChange={(e) => handleVersionChange(version.id, 'orientation', e.target.value)}
                          className="w-full px-2.5 py-2 text-sm bg-white/60 border border-deep-brown/10 rounded-md text-deep-brown focus:bg-white cursor-pointer"
                        >
                          {Object.entries(ORIENTATION_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-ink-light mb-1 block">
                          靠背
                        </label>
                        <div className="flex items-center gap-3 h-[38px] px-1">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`backrest-${version.id}`}
                              checked={version.hasBackrest}
                              onChange={() => handleVersionChange(version.id, 'hasBackrest', true)}
                              className="text-moss-green focus:ring-moss-green"
                            />
                            <span className="text-sm text-deep-brown">有</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`backrest-${version.id}`}
                              checked={!version.hasBackrest}
                              onChange={() => handleVersionChange(version.id, 'hasBackrest', false)}
                              className="text-moss-green focus:ring-moss-green"
                            />
                            <span className="text-sm text-deep-brown">无</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-3">
            <h2 className="font-serif text-lg font-semibold text-deep-brown mb-4">
              环境属性
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  遮阴情况
                </label>
                <select
                  value={formData.shadeLevel}
                  onChange={(e) => handleChange('shadeLevel', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white cursor-pointer"
                >
                  {Object.entries(SHADE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  噪音等级
                </label>
                <select
                  value={formData.noiseLevel}
                  onChange={(e) => handleChange('noiseLevel', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white cursor-pointer"
                >
                  {Object.entries(NOISE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  适合停留时长
                </label>
                <select
                  value={formData.stayDuration}
                  onChange={(e) => handleChange('stayDuration', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white cursor-pointer"
                >
                  {Object.entries(STAY_DURATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-4">
            <h2 className="font-serif text-lg font-semibold text-deep-brown mb-4">
              个人评价
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  综合评分
                </label>
                <Rating
                  value={formData.rating}
                  onChange={(value) => handleChange('rating', value)}
                  size="lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  评价文字
                </label>
                <textarea
                  value={formData.review}
                  onChange={(e) => handleChange('review', e.target.value)}
                  placeholder="写下你对这张长椅的感受..."
                  rows={4}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown placeholder:text-ink-light/60 focus:bg-white transition-colors resize-none"
                />
              </div>
            </div>
          </div>

          <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-semibold text-deep-brown">
                分时段体验
              </h2>
              <button
                type="button"
                onClick={handleAddExperience}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-moss-green hover:bg-moss-green/10 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加时段
              </button>
            </div>

            {experiences.length > 0 ? (
              <div className="space-y-4">
                {experiences.map((exp) => {
                  const TimeIcon = timePeriodIcons[exp.timePeriod];
                  return (
                    <div
                      key={exp.id}
                      className="p-4 bg-warm-cream/50 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-3">
                            <TimeIcon className="w-5 h-5 text-ochre" />
                            <select
                              value={exp.timePeriod}
                              onChange={(e) =>
                                handleUpdateExperience(exp.id, 'timePeriod', e.target.value)
                              }
                              className="px-2 py-1 text-sm bg-white border border-deep-brown/10 rounded-md text-deep-brown cursor-pointer"
                            >
                              {Object.entries(TIME_PERIOD_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <select
                            value={exp.versionId ?? versions[0]?.id}
                            onChange={(e) =>
                              handleUpdateExperience(exp.id, 'versionId', e.target.value)
                            }
                            className="px-2 py-1 text-xs bg-white border border-deep-brown/10 rounded-md text-deep-brown cursor-pointer max-w-[220px]"
                            title="该体验对应的改造版本"
                          >
                            {versions.map((v, vIndex) => (
                              <option key={v.id} value={v.id}>
                                {v.effectiveDate}
                                {v.effectiveDate > today ? '（预告）' : vIndex === 0 ? '（改前）' : '（改后）'}
                                · {describeVersion(v)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteExperience(exp.id)}
                          className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mb-3">
                        <label className="text-xs text-ink-light mb-1 block">
                          时段评分
                        </label>
                        <Rating
                          value={exp.rating}
                          onChange={(value) =>
                            handleUpdateExperience(exp.id, 'rating', value)
                          }
                          size="sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-ink-light mb-1 block">
                          体验备注
                        </label>
                        <textarea
                          value={exp.notes}
                          onChange={(e) =>
                            handleUpdateExperience(exp.id, 'notes', e.target.value)
                          }
                          placeholder="记录这个时段的体验..."
                          rows={2}
                          className="w-full px-3 py-2 text-sm bg-white/60 border border-deep-brown/10 rounded-md text-deep-brown placeholder:text-ink-light/60 focus:bg-white resize-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-ink-light">
                  还没有添加时段体验
                </p>
                <p className="text-xs text-ink-light/60 mt-1">
                  可以记录早晨、中午、下午等不同时段的感受，并关联到对应改造版本
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-4 pb-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 px-6 py-3 bg-warm-beige text-deep-brown rounded-xl font-medium hover:bg-warm-beige/80 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-moss-green text-white rounded-xl font-medium hover:bg-moss-light transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isEdit ? '保存修改' : '添加档案'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
