import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Check } from 'lucide-react-native';

interface GridProps {
  type: 'radio' | 'checkbox';
  question: any;
  value: any;
  onChange: (value: any) => void;
  readOnly?: boolean;
}

export default function GridQuestion({
  type,
  question,
  value,
  onChange,
  readOnly = false,
}: GridProps) {
  const rows = question.gridOptions?.rows || [];
  const columns = question.gridOptions?.columns || [];
  const responses = value || {};

  const handleCellPress = (row: string, col: string) => {
    if (readOnly) return;
    
    const newResponses = { ...responses };
    if (type === 'radio') {
      newResponses[row] = col;
    } else {
      const current = Array.isArray(newResponses[row]) ? newResponses[row] : [];
      if (current.includes(col)) {
        newResponses[row] = current.filter((c: string) => c !== col);
      } else {
        newResponses[row] = [...current, col];
      }
    }
    onChange(newResponses);
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.rowLabelCell} />
            {columns.map((col: string) => (
              <View key={col} style={styles.columnHeaderCell}>
                <Text style={styles.columnHeaderText}>{col}</Text>
              </View>
            ))}
          </View>

          {/* Rows */}
          {rows.map((row: string) => (
            <View key={row} style={styles.row}>
              <View style={styles.rowLabelCell}>
                <Text style={styles.rowLabelText}>{row}</Text>
              </View>
              {columns.map((col: string) => {
                const isSelected = type === 'radio' 
                  ? responses[row] === col
                  : Array.isArray(responses[row]) && responses[row].includes(col);

                return (
                  <TouchableOpacity
                    key={col}
                    onPress={() => handleCellPress(row, col)}
                    disabled={readOnly}
                    style={styles.cell}
                  >
                    <View style={[
                      styles.indicator, 
                      type === 'radio' ? styles.radio : styles.checkbox,
                      isSelected && styles.indicatorActive
                    ]}>
                      {isSelected && (
                        type === 'radio' ? <View style={styles.radioInner} /> : <Check size={12} color="#fff" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#f1f5f9' },
  headerRow: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowLabelCell: { width: 120, padding: 12, justifyContent: 'center' },
  rowLabelText: { fontSize: 13, fontWeight: '700', color: '#1e3a8a' },
  columnHeaderCell: { width: 80, padding: 12, alignItems: 'center', justifyContent: 'center' },
  columnHeaderText: { fontSize: 11, fontWeight: '800', color: '#64748b', textAlign: 'center' },
  cell: { width: 80, padding: 12, alignItems: 'center', justifyContent: 'center' },
  indicator: { width: 22, height: 22, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
  radio: { borderRadius: 11 },
  checkbox: { borderRadius: 4 },
  indicatorActive: { borderColor: '#3b82f6', backgroundColor: '#3b82f6' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
});
