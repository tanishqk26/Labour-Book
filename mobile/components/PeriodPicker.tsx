import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { TranslationKey } from '../lib/i18n';
import { C, R } from '../lib/theme';
import { currentFarmYear, farmYearLabel } from '../lib/expenseMeta';
import DateField from './DateField';

export type PeriodMode = 'week' | 'month' | 'last_month' | 'season' | 'custom' | 'all';

export interface Period {
  mode: PeriodMode;
  year: number;      // used when mode = season
  from: string;      // ISO, used when mode = custom
  to: string;
}

export function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function defaultPeriod(mode: PeriodMode): Period {
  const today = localISO(new Date());
  return { mode, year: currentFarmYear(), from: today, to: today };
}

/** Resolved date range ('' = open-ended) plus the API query params. */
export function resolvePeriod(p: Period): { from: string; to: string; params: Record<string, string> } {
  const now = new Date();
  const range = (from: Date | null, to: Date | null) => {
    const f = from ? localISO(from) : '';
    const t = to ? localISO(to) : '';
    const params: Record<string, string> = {};
    if (f) params.date_from = f;
    if (t) params.date_to = t;
    return { from: f, to: t, params };
  };
  switch (p.mode) {
    case 'week': {
      const mon = new Date(now);
      mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      return range(mon, now);
    }
    case 'month':
      return range(new Date(now.getFullYear(), now.getMonth(), 1), now);
    case 'last_month':
      return range(new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0));
    case 'season':
      return { from: `${p.year}-04-01`, to: `${p.year + 1}-03-31`, params: { year: String(p.year) } };
    case 'custom': {
      const [f, t] = p.from <= p.to ? [p.from, p.to] : [p.to, p.from];
      return { from: f, to: t, params: { date_from: f, date_to: t } };
    }
    default:
      return { from: '', to: '', params: {} };
  }
}

const LABEL: Record<PeriodMode, TranslationKey> = {
  week: 'st_this_week', month: 'st_this_month', last_month: 'st_last_month',
  season: 'st_season', custom: 'st_custom', all: 'st_all_time',
};

export default function PeriodPicker({ value, onChange, modes }: {
  value: Period;
  onChange: (p: Period) => void;
  modes: PeriodMode[];
}) {
  const { t } = useLanguage();
  const maxYear = currentFarmYear();

  return (
    <View style={s.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {modes.map((m) => {
          const on = value.mode === m;
          return (
            <TouchableOpacity key={m} style={[s.chip, on && s.chipOn]} onPress={() => onChange({ ...value, mode: m })}>
              <Text style={[s.chipText, on && s.chipTextOn]}>{t(LABEL[m])}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {value.mode === 'season' && (
        <View style={s.yearRow}>
          <TouchableOpacity hitSlop={10} onPress={() => onChange({ ...value, year: value.year - 1 })}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={C.primary} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.yearText}>{t('st_season')} {farmYearLabel(value.year)}</Text>
            <Text style={s.yearSub}>1 Apr {value.year} – 31 Mar {value.year + 1}</Text>
          </View>
          <TouchableOpacity hitSlop={10} disabled={value.year >= maxYear}
            style={{ opacity: value.year >= maxYear ? 0.3 : 1 }}
            onPress={() => onChange({ ...value, year: value.year + 1 })}>
            <MaterialCommunityIcons name="chevron-right" size={26} color={C.primary} />
          </TouchableOpacity>
        </View>
      )}

      {value.mode === 'custom' && (
        <View style={{ gap: 10 }}>
          <View>
            <Text style={s.label}>{t('st_from')}</Text>
            <DateField value={value.from} onChange={(v) => onChange({ ...value, from: v })} />
          </View>
          <View>
            <Text style={s.label}>{t('st_to')}</Text>
            <DateField value={value.to} onChange={(v) => onChange({ ...value, to: v })} />
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
  chips: { gap: 6, paddingRight: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.full, backgroundColor: C.surfaceLowest, borderWidth: 1, borderColor: C.outlineVariant },
  chipOn: { backgroundColor: C.primaryContainer, borderColor: C.primaryContainer },
  chipText: { fontSize: 13, fontWeight: '600', color: C.onSurfaceVariant },
  chipTextOn: { color: C.onPrimary, fontWeight: '700' },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surfaceLowest, borderRadius: R.lg, borderWidth: 1, borderColor: C.outlineVariant, paddingHorizontal: 12, paddingVertical: 10 },
  yearText: { fontSize: 15, fontWeight: '800', color: C.onSurface },
  yearSub: { fontSize: 11, color: C.onSurfaceVariant, marginTop: 2 },
  label: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, marginBottom: 4 },
});
