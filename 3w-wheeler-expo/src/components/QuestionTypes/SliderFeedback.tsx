import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';

interface SliderFeedbackProps {
  question: any;
  value: any;
  onChange: (value: any) => void;
  readOnly?: boolean;
}

export default function SliderFeedback({
  question,
  value,
  onChange,
  readOnly = false,
}: SliderFeedbackProps) {
  const min = question.min || 0;
  const max = question.max || 100;
  const step = question.step || 1;
  const currentValue = value !== undefined ? Number(value) : min;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Value</Text>
        <Text style={styles.valueText}>{currentValue}</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={currentValue}
        onSlidingComplete={(val) => onChange(String(val))}
        disabled={readOnly}
        minimumTrackTintColor="#3b82f6"
        maximumTrackTintColor="#f1f5f9"
        thumbTintColor="#1e3a8a"
      />
      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>{min}</Text>
        <Text style={styles.rangeText}>{max}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  valueText: { fontSize: 18, fontWeight: '800', color: '#1e3a8a' },
  slider: { width: '100%', height: 40 },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  rangeText: { fontSize: 11, fontWeight: '600', color: '#94a3b8' }
});
