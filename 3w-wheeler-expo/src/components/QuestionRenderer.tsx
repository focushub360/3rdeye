import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, ScrollView, Pressable, Dimensions } from 'react-native';
import { Camera, Upload, CheckCircle2, AlertCircle, ChevronDown, Check, X, Search } from 'lucide-react-native';
import ChassisInspection from './QuestionTypes/ChassisInspection';

const { height } = Dimensions.get('window');

interface QuestionRendererProps {
  question: any;
  value: any;
  onChange: (value: any) => void;
  readOnly?: boolean;
}

export default function QuestionRenderer({
  question,
  value,
  onChange,
  readOnly = false,
}: QuestionRendererProps) {
  const [modalVisible, setModalVisible] = useState(false);

  // Helper for multi-select (checkbox)
  const toggleOption = (option: string) => {
    const currentValues = Array.isArray(value) ? value : [];
    if (currentValues.includes(option)) {
      onChange(currentValues.filter(v => v !== option));
    } else {
      onChange([...currentValues, option]);
    }
  };

  const selectAll = () => {
    onChange(question.options || []);
  };

  const clearAll = () => {
    onChange([]);
  };

  const renderInput = () => {
    switch (question.type) {
      case 'short-text':
      case 'short_text':
      case 'text':
      case 'chassisNumber':
      case 'chassis-number':
        return (
          <TextInput
            style={[styles.textInput, readOnly && styles.disabledInput]}
            value={value || ''}
            onChangeText={onChange}
            editable={!readOnly}
            placeholder={
              question.type?.toLowerCase().includes('chassis') 
                ? "Enter Chassis Number..." 
                : "Enter response..."
            }
            placeholderTextColor="#9ca3af"
          />
        );

      case 'paragraph':
      case 'textarea':
        return (
          <TextInput
            style={[styles.textInput, styles.textArea, readOnly && styles.disabledInput]}
            value={value || ''}
            onChangeText={onChange}
            editable={!readOnly}
            multiline
            numberOfLines={4}
            placeholder="Enter details..."
            placeholderTextColor="#9ca3af"
            textAlignVertical="top"
          />
        );

      case 'radio':
      case 'yesNoNA':
        return (
          <View style={styles.optionsGrid}>
            {question.options?.map((option: string) => {
              const isSelected = value === option;
              return (
                <TouchableOpacity
                  key={option}
                  disabled={readOnly}
                  onPress={() => onChange(option)}
                  style={[
                    styles.optionCard,
                    isSelected && styles.optionCardSelected,
                    readOnly && styles.disabledOpacity,
                  ]}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {option}
                  </Text>
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                    {isSelected && <CheckCircle2 size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        );

      case 'checkbox':
      case 'select':
      case 'dropdown':
      case 'multiplechoice':
        const isMulti = question.type === 'checkbox' || question.type === 'multiplechoice';
        const displayValue = isMulti 
          ? (Array.isArray(value) && value.length > 0 ? `${value.length} selected` : 'Select options...')
          : (value || 'Select an option...');

        return (
          <>
            <TouchableOpacity 
              style={[styles.dropdownTrigger, readOnly && styles.disabledInput]}
              onPress={() => !readOnly && setModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dropdownText, !value && styles.placeholderText]}>
                {displayValue}
              </Text>
              <ChevronDown size={20} color="#64748b" />
            </TouchableOpacity>

            <Modal
              visible={modalVisible}
              transparent
              animationType="slide"
              onRequestClose={() => setModalVisible(false)}
            >
              <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{question.text || 'Select Options'}</Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                      <X size={24} color="#64748b" />
                    </TouchableOpacity>
                  </View>

                  {isMulti && (
                    <View style={styles.modalActions}>
                      <TouchableOpacity style={styles.actionLink} onPress={selectAll}>
                        <Text style={styles.actionLinkText}>Select All</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionLink} onPress={clearAll}>
                        <Text style={styles.actionLinkText}>Clear All</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <ScrollView style={styles.optionsScroll}>
                    {question.options?.map((option: string) => {
                      const isSelected = isMulti 
                        ? (Array.isArray(value) && value.includes(option))
                        : (value === option);

                      return (
                        <TouchableOpacity
                          key={option}
                          style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                          onPress={() => {
                            if (isMulti) {
                              toggleOption(option);
                            } else {
                              onChange(option);
                              setModalVisible(false);
                            }
                          }}
                        >
                          <View style={styles.optionItemContent}>
                            <View style={[
                              isMulti ? styles.checkbox : styles.radio,
                              isSelected && styles.checkedBox
                            ]}>
                              {isSelected && <Check size={14} color="#fff" />}
                            </View>
                            <Text style={[styles.optionItemText, isSelected && styles.optionItemTextActive]}>
                              {option}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <TouchableOpacity 
                    style={styles.doneBtn} 
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.doneBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Modal>
          </>
        );

      case 'chassis-with-zone':
        return (
          <ChassisInspection
            question={question}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            showZone={true}
          />
        );

      case 'chassis-without-zone':
        return (
          <ChassisInspection
            question={question}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            showZone={false}
          />
        );

      default:
        return (
          <View style={styles.fallbackContainer}>
            <AlertCircle size={20} color="#6b7280" />
            <Text style={styles.fallbackText}>Unsupported type: {question.type}</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {renderInput()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    height: 100,
  },
  disabledInput: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
  optionsGrid: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#f3f4f6',
    borderRadius: 16,
  },
  optionCardSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4b5563',
  },
  optionTextSelected: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  disabledOpacity: {
    opacity: 0.6,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
  },
  dropdownText: {
    fontSize: 16,
    color: '#1f2937',
  },
  placeholderText: {
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    flex: 1,
    marginRight: 10,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  actionLink: {
    paddingVertical: 4,
  },
  actionLinkText: {
    color: '#3b82f6',
    fontWeight: '700',
    fontSize: 14,
  },
  optionsScroll: {
    padding: 16,
  },
  optionItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  optionItemSelected: {
    backgroundColor: '#eff6ff',
  },
  optionItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedBox: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  optionItemText: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '500',
  },
  optionItemTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  doneBtn: {
    backgroundColor: '#1e3a8a',
    margin: 24,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  fallbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  fallbackText: {
    color: '#6b7280',
    fontSize: 14,
  },
});
