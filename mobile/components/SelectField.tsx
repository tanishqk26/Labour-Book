import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { C, R } from '../lib/theme';

export interface SelectOption { id: string; label: string; icon?: string }

/**
 * Dropdown: a field that opens a list. The `detectedId` option (what the voice
 * model picked) is listed first and tagged, so fixing a wrong guess is one tap.
 */
export default function SelectField({ value, options, detectedId, placeholder, title, warn, onChange }: {
  value: string | null;
  options: SelectOption[];
  detectedId?: string | null;
  placeholder: string;
  title: string;
  warn?: boolean;
  onChange: (id: string) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  const detected = detectedId ? options.find((o) => o.id === detectedId) : undefined;
  const ordered = detected ? [detected, ...options.filter((o) => o.id !== detected.id)] : options;

  return (
    <>
      <TouchableOpacity style={[s.field, warn && !selected && s.fieldWarn]} onPress={() => setOpen(true)} activeOpacity={0.8}>
        {selected?.icon ? <MaterialCommunityIcons name={selected.icon as never} size={18} color={C.primary} /> : null}
        <Text style={[s.fieldText, !selected && { color: C.outline, fontWeight: '600' }]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={22} color={C.onSurfaceVariant} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle}>{title}</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {ordered.map((o) => {
                const on = o.id === value;
                return (
                  <TouchableOpacity key={o.id} style={[s.row, on && s.rowOn]} onPress={() => { onChange(o.id); setOpen(false); }}>
                    {o.icon ? <MaterialCommunityIcons name={o.icon as never} size={20} color={C.onSurfaceVariant} /> : null}
                    <Text style={[s.rowText, on && { color: C.primary }]} numberOfLines={1}>{o.label}</Text>
                    {detected && o.id === detected.id ? (
                      <View style={s.tag}><Text style={s.tagText}>{t('voice_detected')}</Text></View>
                    ) : null}
                    {on ? <MaterialCommunityIcons name="check" size={20} color={C.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, paddingHorizontal: 14, borderRadius: R.md, borderWidth: 1.5, borderColor: C.outlineVariant, backgroundColor: C.surfaceLow },
  fieldWarn: { borderColor: '#d97706' },
  fieldText: { flex: 1, fontSize: 16, fontWeight: '700', color: C.onSurface },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  sheet: { maxHeight: '70%', backgroundColor: C.surface, borderRadius: R.lg, paddingVertical: 8, overflow: 'hidden' },
  sheetTitle: { fontSize: 13, fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 18, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, minHeight: 52 },
  rowOn: { backgroundColor: C.primaryFixed },
  rowText: { flex: 1, fontSize: 16, fontWeight: '600', color: C.onSurface },
  tag: { backgroundColor: C.primaryFixed, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 10, fontWeight: '800', color: C.primary, textTransform: 'uppercase' },
});
