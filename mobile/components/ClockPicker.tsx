import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C, R } from '../lib/theme';

const CLOCK_SIZE = 260;
const CENTER     = CLOCK_SIZE / 2;          // 130
const NUM_RADIUS = 96;                       // center-to-number-center distance
const NUM_SIZE   = 38;                       // tap-target / circle diameter
const HAND_LEN   = NUM_RADIUS - NUM_SIZE / 2 + 8; // reaches just into the selected circle

interface Props {
  visible: boolean;
  value?: string;       // "HH:MM" 24-h; undefined = 07:00 AM
  onConfirm: (time: string) => void;  // returns "HH:MM" 24-h
  onClose: () => void;
  title?: string;
}

const HOURS   = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as const;

function clockPos(idx: number) {
  const a = (idx / 12) * 2 * Math.PI - Math.PI / 2;
  return {
    left: CENTER + NUM_RADIUS * Math.cos(a) - NUM_SIZE / 2,
    top:  CENTER + NUM_RADIUS * Math.sin(a) - NUM_SIZE / 2,
  };
}

export default function ClockPicker({ visible, value, onConfirm, onClose, title }: Props) {
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const [hr,   setHr]  = useState(7);   // 1–12
  const [min,  setMin] = useState(0);   // 0 | 5 | 10 … 55
  const [pm,   setPm]  = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMode('hour');
    if (value && /^\d{1,2}:\d{2}$/.test(value)) {
      const h24 = parseInt(value.split(':')[0], 10);
      const m   = parseInt(value.split(':')[1], 10);
      setPm(h24 >= 12);
      setHr(h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24);
      setMin(Math.round(m / 5) * 5 % 60);
    } else {
      setHr(7); setMin(0); setPm(false);
    }
  }, [visible, value]);

  function pickHour(h: number) {
    setHr(h);
    setTimeout(() => setMode('minute'), 180);
  }

  function confirm() {
    let h24 = hr;
    if (pm  && hr !== 12) h24 = hr + 12;
    if (!pm && hr === 12) h24 = 0;
    onConfirm(`${h24.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
    onClose();
  }

  // 0° = top (12 o'clock), goes clockwise
  const handAngle = mode === 'hour' ? (hr / 12) * 360 : (min / 60) * 360;

  const dh = hr.toString().padStart(2, '0');
  const dm = min.toString().padStart(2, '0');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.card} activeOpacity={1} onPress={() => {}}>
          {title ? <Text style={s.cardTitle}>{title}</Text> : null}

          {/* ── Digital display ── */}
          <View style={s.display}>
            <TouchableOpacity onPress={() => setMode('hour')}>
              <Text style={[s.seg, mode === 'hour' && s.segOn]}>{dh}</Text>
            </TouchableOpacity>
            <Text style={s.colon}>:</Text>
            <TouchableOpacity onPress={() => setMode('minute')}>
              <Text style={[s.seg, mode === 'minute' && s.segOn]}>{dm}</Text>
            </TouchableOpacity>
            <View style={s.ampmGroup}>
              <TouchableOpacity style={[s.ampm, !pm && s.ampmOn]} onPress={() => setPm(false)}>
                <Text style={[s.ampmTxt, !pm && s.ampmTxtOn]}>AM</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.ampm, pm && s.ampmOn]} onPress={() => setPm(true)}>
                <Text style={[s.ampmTxt, pm && s.ampmTxtOn]}>PM</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={s.hint}>{mode === 'hour' ? 'Select hour' : 'Select minute'}</Text>

          {/* ── Clock face ── */}
          <View style={s.face}>
            {/* Rotating hand layer */}
            <View
              style={[s.handWrap, { transform: [{ rotate: `${handAngle}deg` }] }]}
              pointerEvents="none"
            >
              <View style={s.handLine} />
              <View style={s.handDot} />
            </View>

            {/* Numbers */}
            {(mode === 'hour' ? HOURS : MINUTES).map((val, idx) => {
              const p = pos(idx);
              const active = mode === 'hour' ? hr === val : min === val;
              return (
                <TouchableOpacity
                  key={val}
                  style={[s.num, { left: p.left, top: p.top }, active && s.numOn]}
                  onPress={() => (mode === 'hour' ? pickHour(val) : setMin(val))}
                  hitSlop={4}
                  activeOpacity={0.7}
                >
                  <Text style={[s.numTxt, active && s.numTxtOn]}>
                    {mode === 'minute' ? val.toString().padStart(2, '0') : val}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Actions ── */}
          <View style={s.actions}>
            <TouchableOpacity onPress={onClose} style={s.actBtn}>
              <Text style={s.actCancel}>Cancel</Text>
            </TouchableOpacity>
            {mode === 'hour' ? (
              <TouchableOpacity onPress={() => setMode('minute')} style={s.actBtn}>
                <Text style={s.actOk}>Next →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={confirm} style={s.actBtn}>
                <Text style={s.actOk}>OK</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// re-export the position helper for external use
export function pos(idx: number) { return clockPos(idx); }

// Helper: "HH:MM" → "H:MM AM/PM" for display
export function fmt12h(time: string): string {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  const h24 = parseInt(hStr, 10);
  const m   = parseInt(mStr, 10);
  const isPM = h24 >= 12;
  const h12  = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${m.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  card:     { backgroundColor: C.surfaceLowest, borderRadius: R.xl, padding: 20, width: 320, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12 },
  cardTitle:{ fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },

  display:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  seg:       { fontSize: 46, fontWeight: '700', color: C.onSurfaceVariant, backgroundColor: C.surfaceHigh, paddingHorizontal: 14, paddingVertical: 2, borderRadius: R.md, minWidth: 76, textAlign: 'center' },
  segOn:     { color: C.onPrimary, backgroundColor: C.primaryContainer },
  colon:     { fontSize: 38, fontWeight: '300', color: C.onSurface, paddingBottom: 4 },
  ampmGroup: { gap: 4, marginLeft: 8 },
  ampm:      { paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.md, backgroundColor: C.surfaceHigh },
  ampmOn:    { backgroundColor: C.primaryFixed },
  ampmTxt:   { fontSize: 13, fontWeight: '700', color: C.onSurfaceVariant },
  ampmTxtOn: { color: C.primary },

  hint: { fontSize: 11, color: C.onSurfaceVariant, letterSpacing: 0.3, marginBottom: 12 },

  face:     { width: CLOCK_SIZE, height: CLOCK_SIZE, borderRadius: CLOCK_SIZE / 2, backgroundColor: C.surfaceHigh },

  handWrap: { position: 'absolute', top: 0, left: 0, width: CLOCK_SIZE, height: CLOCK_SIZE },
  handLine: { position: 'absolute', width: 3, height: HAND_LEN, borderRadius: 2, backgroundColor: C.primaryContainer, left: CENTER - 1.5, top: CENTER - HAND_LEN },
  handDot:  { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: C.primaryContainer, top: CENTER - 5, left: CENTER - 5 },

  num:    { position: 'absolute', width: NUM_SIZE, height: NUM_SIZE, borderRadius: NUM_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  numOn:  { backgroundColor: C.primaryContainer },
  numTxt: { fontSize: 14, fontWeight: '600', color: C.onSurface },
  numTxtOn: { color: C.onPrimary },

  actions:   { flexDirection: 'row', justifyContent: 'flex-end', alignSelf: 'stretch', marginTop: 16, gap: 8 },
  actBtn:    { paddingHorizontal: 20, paddingVertical: 10 },
  actCancel: { fontSize: 14, fontWeight: '600', color: C.onSurfaceVariant },
  actOk:     { fontSize: 14, fontWeight: '700', color: C.primary },
});
