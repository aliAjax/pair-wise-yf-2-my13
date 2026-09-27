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
  MaterialType,
  OrientationType,
  ShadeLevelType,
  NoiseLevelType,
  StayDurationType,
  TimePeriodType,
  BenchExperience,
} from '@/types';
import Rating from '@/components/Rating/Rating';
import { generateId } from '@/utils/comfort';
import {
  describeRevision,
  ensureRevisions,
  getEffectiveRevision,
  sortRevisions,
  todayString,
} from '@/utils/revisions';

export default function AddEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { getBenchById, addBench, updateBench, initialize, initialized, addExperience, updateExperience, deleteExperience, addRevision } = useBenchStore();
  const existingBench = id ? getBenchById(id) : undefined;

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    lat: 31.23,
    lng: 121.47,
    material: 'wood' as MaterialType,
    orientation: 'south' as OrientationType,
    hasBackrest: true,
    shadeLevel: 'partial' as ShadeLevelType,
    noiseLevel: 'moderate' as NoiseLevelType,
    stayDuration: 'medium' as StayDurationType,
    rating: 3,
    review: '',
  });

  const [experiences, setExperiences] = useState<BenchExperience[]>([]);

  const [revisionForm, setRevisionForm] = useState({
    effectiveDate: todayString(),
    material: 'wood' as MaterialType,
    hasBackrest: true,
    orientation: 'south' as OrientationType,
    note: '',
  });

  const sortedRevisions = existingBench ? sortRevisions(ensureRevisions(existingBench)) : [];
  const lastRevision = sortedRevisions[sortedRevisions.length - 1];
  const minRevisionDate = lastRevision ? lastRevision.effectiveDate : todayString();
  const effectiveRevision = existingBench ? getEffectiveRevision(existingBench) : undefined;
  const today = todayString();

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
        material: existingBench.material,
        orientation: existingBench.orientation,
        hasBackrest: existingBench.hasBackrest,
        shadeLevel: existingBench.shadeLevel,
        noiseLevel: existingBench.noiseLevel,
        stayDuration: existingBench.stayDuration,
        rating: existingBench.rating,
        review: existingBench.review,
      });
      setExperiences(existingBench.experiences || []);

      const revisions = sortRevisions(ensureRevisions(existingBench));
      const latest = revisions[revisions.length - 1];
      if (latest) {
        const today = todayString();
        setRevisionForm({
          effectiveDate: today < latest.effectiveDate ? latest.effectiveDate : today,
          material: latest.material,
          hasBackrest: latest.hasBackrest,
          orientation: latest.orientation,
          note: '',
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, initialized, id]);

  const handleChange = (field: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddExperience = () => {
    const newExp: BenchExperience = {
      id: generateId(),
      benchId: id || 'temp',
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

  const handleAddRevision = () => {
    if (!isEdit || !id) return;
    if (!revisionForm.effectiveDate) {
      alert('请选择生效日期');
      return;
    }
    if (revisionForm.effectiveDate < minRevisionDate) {
      alert('生效日期不能早于上一次改造记录');
      return;
    }
    const ok = addRevision(id, {
      effectiveDate: revisionForm.effectiveDate,
      material: revisionForm.material,
      hasBackrest: revisionForm.hasBackrest,
      orientation: revisionForm.orientation,
      note: revisionForm.note.trim() || undefined,
    });
    if (!ok) {
      alert('生效日期不能早于上一次改造记录');
      return;
    }
    const today = todayString();
    setRevisionForm({
      effectiveDate: today < revisionForm.effectiveDate ? revisionForm.effectiveDate : today,
      material: revisionForm.material,
      hasBackrest: revisionForm.hasBackrest,
      orientation: revisionForm.orientation,
      note: '',
    });
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

    if (isEdit && id) {
      // 材质、靠背、朝向由改造履历管理，这里只保存其余档案信息
      const { name, location, lat, lng, shadeLevel, noiseLevel, stayDuration, rating, review } = formData;
      updateBench(id, { name, location, lat, lng, shadeLevel, noiseLevel, stayDuration, rating, review });
      experiences.forEach((exp) => {
        const existingExp = existingBench?.experiences.find((item) => item.id === exp.id);
        if (existingExp) {
          updateExperience(id, exp.id, exp);
        } else {
          addExperience(id, exp);
        }
      });
    } else {
      addBench({
        ...formData,
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
            <h2 className="font-serif text-lg font-semibold text-deep-brown mb-4">
              特征属性
            </h2>

            <div className="grid grid-cols-2 gap-4">
              {isEdit && effectiveRevision && (
                <div className="col-span-2 flex flex-wrap items-center gap-2 p-3 bg-moss-green/5 rounded-lg">
                  <History className="w-4 h-4 text-moss-green flex-shrink-0" />
                  <span className="text-sm text-ink-light">当前生效配置</span>
                  <span className="text-sm font-medium text-deep-brown">
                    {describeRevision(effectiveRevision)}
                  </span>
                  <span className="text-xs text-ink-light/60 ml-auto">
                    材质、靠背、朝向请在下方「改造履历」中变更
                  </span>
                </div>
              )}

              {!isEdit && (
              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  材质
                </label>
                <select
                  value={formData.material}
                  onChange={(e) => handleChange('material', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white cursor-pointer"
                >
                  {Object.entries(MATERIAL_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              )}

              {!isEdit && (
              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  朝向
                </label>
                <select
                  value={formData.orientation}
                  onChange={(e) => handleChange('orientation', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white cursor-pointer"
                >
                  {Object.entries(ORIENTATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              )}

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

              {!isEdit && (
              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  是否有靠背
                </label>
                <div className="flex items-center gap-4 h-[42px]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="hasBackrest"
                      checked={formData.hasBackrest}
                      onChange={() => handleChange('hasBackrest', true)}
                      className="text-moss-green focus:ring-moss-green"
                    />
                    <span className="text-sm text-deep-brown">有</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="hasBackrest"
                      checked={!formData.hasBackrest}
                      onChange={() => handleChange('hasBackrest', false)}
                      className="text-moss-green focus:ring-moss-green"
                    />
                    <span className="text-sm text-deep-brown">无</span>
                  </label>
                </div>
              </div>
              )}
            </div>
          </div>

          {isEdit && existingBench && (
            <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-3">
              <h2 className="font-serif text-lg font-semibold text-deep-brown mb-1">
                改造履历
              </h2>
              <p className="text-xs text-ink-light mb-4">
                按生效日期记录材质、靠背和朝向；同一天只保留一条记录，新记录不能早于上一条。
              </p>

              <div className="space-y-3 mb-5">
                {sortedRevisions.map((revision, index) => {
                  const isEffective = effectiveRevision?.id === revision.id;
                  const isUpcoming = revision.effectiveDate > today;
                  return (
                    <div
                      key={revision.id}
                      className={`p-3 rounded-lg border ${
                        isUpcoming
                          ? 'border-dashed border-ochre/50 bg-ochre/5'
                          : isEffective
                            ? 'border-moss-green/30 bg-moss-green/5'
                            : 'border-deep-brown/5 bg-warm-cream/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-ink-light">{revision.effectiveDate}</span>
                        {isUpcoming ? (
                          <span className="inline-flex items-center gap-1 text-xs text-ochre">
                            <CalendarClock className="w-3 h-3" />
                            预告 · 尚未生效
                          </span>
                        ) : isEffective ? (
                          <span className="text-xs font-medium text-moss-green">当前生效</span>
                        ) : index === 0 ? (
                          <span className="text-xs text-ink-light/60">初始配置</span>
                        ) : null}
                      </div>
                      <p className="text-sm text-deep-brown">{describeRevision(revision)}</p>
                      {revision.note && (
                        <p className="text-xs text-ink-light mt-1">{revision.note}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="p-4 bg-warm-cream/50 rounded-lg">
                <h3 className="text-sm font-medium text-deep-brown mb-3">记录一次改造</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-ink-light mb-1 block">生效日期</label>
                    <input
                      type="date"
                      min={minRevisionDate}
                      value={revisionForm.effectiveDate}
                      onChange={(e) =>
                        setRevisionForm((prev) => ({ ...prev, effectiveDate: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm bg-white/60 border border-deep-brown/10 rounded-md text-deep-brown focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ink-light mb-1 block">材质</label>
                    <select
                      value={revisionForm.material}
                      onChange={(e) =>
                        setRevisionForm((prev) => ({ ...prev, material: e.target.value as MaterialType }))
                      }
                      className="w-full px-3 py-2 text-sm bg-white/60 border border-deep-brown/10 rounded-md text-deep-brown cursor-pointer"
                    >
                      {Object.entries(MATERIAL_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-ink-light mb-1 block">朝向</label>
                    <select
                      value={revisionForm.orientation}
                      onChange={(e) =>
                        setRevisionForm((prev) => ({ ...prev, orientation: e.target.value as OrientationType }))
                      }
                      className="w-full px-3 py-2 text-sm bg-white/60 border border-deep-brown/10 rounded-md text-deep-brown cursor-pointer"
                    >
                      {Object.entries(ORIENTATION_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-ink-light mb-1 block">靠背</label>
                    <div className="flex items-center gap-4 h-[38px]">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="revisionHasBackrest"
                          checked={revisionForm.hasBackrest}
                          onChange={() => setRevisionForm((prev) => ({ ...prev, hasBackrest: true }))}
                          className="text-moss-green focus:ring-moss-green"
                        />
                        <span className="text-sm text-deep-brown">有</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="revisionHasBackrest"
                          checked={!revisionForm.hasBackrest}
                          onChange={() => setRevisionForm((prev) => ({ ...prev, hasBackrest: false }))}
                          className="text-moss-green focus:ring-moss-green"
                        />
                        <span className="text-sm text-deep-brown">无</span>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-xs text-ink-light mb-1 block">备注（可选）</label>
                  <input
                    type="text"
                    value={revisionForm.note}
                    onChange={(e) =>
                      setRevisionForm((prev) => ({ ...prev, note: e.target.value }))
                    }
                    placeholder="例如：更换为金属座椅"
                    className="w-full px-3 py-2 text-sm bg-white/60 border border-deep-brown/10 rounded-md text-deep-brown placeholder:text-ink-light/60 focus:bg-white"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-ink-light/70">
                    {revisionForm.effectiveDate === minRevisionDate && sortedRevisions.length > 0
                      ? '该日期已有记录，保存后将覆盖同一天的旧记录'
                      : '生效日期不能早于上一次记录'}
                  </p>
                  <button
                    type="button"
                    onClick={handleAddRevision}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-moss-green hover:bg-moss-light rounded-lg transition-colors flex-shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    记录改造
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-3">
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

          <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-4">
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
                  可以记录早晨、中午、下午等不同时段的感受
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
