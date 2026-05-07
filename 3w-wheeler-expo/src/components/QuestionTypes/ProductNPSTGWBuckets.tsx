import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { Layers, ChevronDown, CheckCircle2, ChevronRight, X } from 'lucide-react-native';
import {
  getLevel1Options,
  getLevel2Options,
  getLevel3Options,
  getLevel4Options,
  getLevel5Options,
  getLevel6Options,
} from '../../config/npsHierarchy';

interface ProductNPSTGWBucketsProps {
  value: any;
  onChange: (value: any) => void;
  readOnly?: boolean;
}

export default function ProductNPSTGWBuckets({
  value,
  onChange,
  readOnly = false,
}: ProductNPSTGWBucketsProps) {
  const [selections, setSelections] = useState({
    level1: value?.level1 || '',
    level2: value?.level2 || '',
    level3: value?.level3 || '',
    level4: value?.level4 || '',
    level5: value?.level5 || '',
    level6: value?.level6 || '',
  });

  const [activeLevel, setActiveLevel] = useState<string | null>(null);

  useEffect(() => {
    if (value) {
      setSelections({
        level1: value.level1 || '',
        level2: value.level2 || '',
        level3: value.level3 || '',
        level4: value.level4 || '',
        level5: value.level5 || '',
        level6: value.level6 || '',
      });
    }
  }, [value]);

  const handleLevelChange = (level: string, newValue: string) => {
    const newSelections = { ...selections, [level]: newValue };

    // Reset subsequent levels
    if (level === 'level1') {
      newSelections.level2 = '';
      newSelections.level3 = '';
      newSelections.level4 = '';
      newSelections.level5 = '';
      newSelections.level6 = '';
    } else if (level === 'level2') {
      newSelections.level3 = '';
      newSelections.level4 = '';
      newSelections.level5 = '';
      newSelections.level6 = '';
    } else if (level === 'level3') {
      newSelections.level4 = '';
      newSelections.level5 = '';
      newSelections.level6 = '';
    } else if (level === 'level4') {
      newSelections.level5 = '';
      newSelections.level6 = '';
    } else if (level === 'level5') {
      newSelections.level6 = '';
    }

    setSelections(newSelections);
    onChange(newSelections);
    setActiveLevel(null);
  };

  const renderPicker = (levelKey: string, options: string[], label: string) => {
    const currentValue = (selections as any)[levelKey];
    
    return (
      <View style={styles.levelWrapper}>
        <Text style={styles.levelLabel}>{label}</Text>
        <TouchableOpacity
          style={[styles.pickerBtn, currentValue && styles.pickerBtnActive, readOnly && styles.disabled]}
          onPress={() => !readOnly && setActiveLevel(levelKey)}
          disabled={readOnly}
        >
          <Text style={[styles.pickerText, !currentValue && styles.placeholderText]}>
            {currentValue || `Select ${label}...`}
          </Text>
          <ChevronDown size={18} color={currentValue ? '#1e3a8a' : '#94a3b8'} />
        </TouchableOpacity>

        <Modal
          visible={activeLevel === levelKey}
          transparent
          animationType="slide"
          onRequestClose={() => setActiveLevel(null)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setActiveLevel(null)}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{label}</Text>
                <TouchableOpacity onPress={() => setActiveLevel(null)}>
                  <X size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.optionsScroll}>
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.optionItem, currentValue === opt && styles.optionItemActive]}
                    onPress={() => handleLevelChange(levelKey, opt)}
                  >
                    <Text style={[styles.optionText, currentValue === opt && styles.optionTextActive]}>{opt}</Text>
                    {currentValue === opt && <CheckCircle2 size={18} color="#1e3a8a" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  };

  const l1Options = getLevel1Options();
  const l2Options = selections.level1 ? getLevel2Options(selections.level1) : [];
  const l3Options = selections.level1 && selections.level2 ? getLevel3Options(selections.level1, selections.level2) : [];
  const l4Options = selections.level1 && selections.level2 && selections.level3 ? getLevel4Options(selections.level1, selections.level2, selections.level3) : [];
  const l5Options = selections.level1 && selections.level2 && selections.level3 && selections.level4 ? getLevel5Options(selections.level1, selections.level2, selections.level3, selections.level4) : [];
  const l6Options = selections.level1 && selections.level2 && selections.level3 && selections.level4 && selections.level5 ? getLevel6Options(selections.level1, selections.level2, selections.level3, selections.level4, selections.level5) : [];

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Layers size={16} color="#1e3a8a" />
          <Text style={styles.headerTitle}>Product Hierarchy</Text>
        </View>
        <View style={styles.body}>
          {renderPicker('level1', l1Options, 'Complaint Group')}
          {selections.level1 && l2Options.length > 0 && renderPicker('level2', l2Options, 'Sub-complaint')}
          {selections.level2 && l3Options.length > 0 && renderPicker('level3', l3Options, 'Probing Question')}
          {selections.level3 && l4Options.length > 0 && renderPicker('level4', l4Options, 'Initial Answer')}
          {selections.level4 && l5Options.length > 0 && renderPicker('level5', l5Options, 'Secondary Detail')}
          {selections.level5 && l6Options.length > 0 && renderPicker('level6', l6Options, 'Final Selection')}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 13, fontWeight: '800', color: '#1e3a8a' },
  body: { padding: 16, gap: 16 },
  levelWrapper: { gap: 6 },
  levelLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  pickerBtnActive: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  pickerText: { fontSize: 14, fontWeight: '600', color: '#1e3a8a' },
  placeholderText: { color: '#94a3b8', fontWeight: '500' },
  disabled: { opacity: 0.6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  optionsScroll: { padding: 8 },
  optionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12, marginBottom: 4 },
  optionItemActive: { backgroundColor: '#eff6ff' },
  optionText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  optionTextActive: { color: '#1e3a8a', fontWeight: '700' },
});
