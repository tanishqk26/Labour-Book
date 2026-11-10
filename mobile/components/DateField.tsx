import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { C, R } from '../lib/theme';

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parse(v: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
}
function daysAgo(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); }

/**
 * Date field: tapping opens the system calendar. Today / Yesterday shortcuts sit
 * on their own line so nothing is cut off on narrow phones. Future dates are blocked.
 */
export default function DateField({ value, onChange }: { value: string; onChange: (isoDate: string) => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const isWeb = Platform.OS === 'web';

  function handle(e: DateTimePickerEvent, d?: Date) {
    if (Platform.OS === 'android') setOpen(false);
    if (e.type === 'set' && d) onChange(iso(d));
  }

  const pretty = parse(value).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View style={s.wrap}>
      {isWeb ? (
        <TextInput style={s.webInput} value={value} onChangeText={onChange} maxLength={10} keyboardType="numbers-and-punctuation" />
      ) : (
        <TouchableOpacity style={s.field} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
          <MaterialCommunityIcons name="calendar" size={20} color={C.primary} />
          <Text style={s.fieldText}>{pretty}</Text>
          <MaterialCommunityIcons name="chevron-down" size={22} color={C.onSurfaceVariant} />
        </TouchableOpacity>
      )}
      <View style={s.chips}>
        <TouchableOpacity style={[s.chip, value === daysAgo(0) && s.chipOn]} onPress={() => onChange(daysAgo(0))}>
          <Text style={[s.chipText, value === daysAgo(0) && s.chipTextOn]}>{t('today')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.chip, value === daysAgo(1) && s.chipOn]} onPress={() => onChange(daysAgo(1))}>
          <Text style={[s.chipText, value === daysAgo(1) && s.chipTextOn]}>{t('yesterday')}</Text>
        </TouchableOpacity>
      </View>
      {open && !isWeb && (
        <DateTimePicker
          value={parse(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          maximumDate={new Date()}
          onChange={handle}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 14, borderRadius: R.md, borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.surfaceLow },
  fieldText: { flex: 1, fontSize: 16, fontWeight: '700', color: C.onSurface },
  webInput: { minHeight: 50, paddingHorizontal: 14, borderRadius: R.md, borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.surfaceLow, fontSize: 16, color: C.onSurface },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: R.full, backgroundColor: C.surfaceHigh },
  chipOn: { backgroundColor: C.primaryContainer },
  chipText: { fontSize: 13, fontWeight: '700', color: C.onSurfaceVariant },
  chipTextOn: { color: C.onPrimary },
});
