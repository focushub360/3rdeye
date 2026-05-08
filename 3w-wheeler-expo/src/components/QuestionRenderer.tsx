import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Modal, ScrollView, Pressable, Dimensions, Image, ActivityIndicator,
} from 'react-native';
import {
  Camera, CheckCircle2, AlertCircle, ChevronDown,
  Check, X, Hash,
} from 'lucide-react-native';
import ChassisInspection from './QuestionTypes/ChassisInspection';
import ZoneIn from './QuestionTypes/ZoneIn';
import ZoneOut from './QuestionTypes/ZoneOut';
import RadioImage from './QuestionTypes/RadioImage';
import FeedbackQuestion from './QuestionTypes/FeedbackQuestion';
import GridQuestion from './QuestionTypes/GridQuestion';
import ProductNPSTGWBuckets from './QuestionTypes/ProductNPSTGWBuckets';
import SearchSelect from './QuestionTypes/SearchSelect';
import SliderFeedback from './QuestionTypes/SliderFeedback';
import InAppCamera from './InAppCamera';
import apiClient, { BASE_URL, ROOT_URL } from '../api/config';

const { height } = Dimensions.get('window');

// Helper to normalize image URLs
const getImageUrl = (url: string) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  
  if (trimmed.startsWith('data:') || trimmed.startsWith('file:')) {
    return trimmed;
  }
  
  // Use proxy for ALL external http/https URLs to handle redirects/CORS/Google Drive
  if (trimmed.startsWith('http')) {
    // If it's already a full URL to our server, don't proxy it
    if (trimmed.includes(ROOT_URL)) return trimmed;
    const cleanBase = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
    return `${cleanBase}/files/proxy?url=${encodeURIComponent(trimmed)}`;
  }
  
  // Internal backend files
  // If it already includes 'uploads/', point to root
  if (trimmed.startsWith('uploads/')) return `${ROOT_URL}/${trimmed}`;
  if (trimmed.startsWith('/uploads/')) return `${ROOT_URL}${trimmed}`;
  
  // Default to static uploads folder for simple filenames
  if (trimmed.startsWith('/')) return `${ROOT_URL}${trimmed}`;
  return `${ROOT_URL}/uploads/${trimmed}`;
};

interface QuestionRendererProps {
  question: any;
  value: any;
  onChange: (value: any) => void;
  readOnly?: boolean;
  formId?: string;
  tenantSlug?: string;
  trackingValue?: string;
  onTrackingChange?: (val: string) => void;
  hideLabel?: boolean;
}

export default function QuestionRenderer({
  question,
  value,
  onChange,
  readOnly = false,
  formId,
  tenantSlug,
  trackingValue,
  onTrackingChange,
  hideLabel = false,
}: QuestionRendererProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Track Rank state
  const [rank, setRank] = useState<number | null>(null);
  const [loadingRank, setLoadingRank] = useState(false);

  const isRankTrackingEnabled =
    question.trackResponseRank === true || String(question.trackResponseRank) === 'true';

  const isQuestionTrackingEnabled =
    question.trackResponseQuestion === true || String(question.trackResponseQuestion) === 'true';

  const rankLabel = question.trackResponseRankLabel || 'Tracking Value';
  const rankInputType = question.trackResponseRankType || 'text';

  // Internal tracking value for rank (used when no external prop provided)
  const [internalTrackingValue, setInternalTrackingValue] = useState('');
  const effectiveTrackingValue = trackingValue !== undefined ? trackingValue : internalTrackingValue;
  const handleTrackingChange = (val: string) => {
    setInternalTrackingValue(val);
    if (onTrackingChange) onTrackingChange(val);
    
    // Auto-sync with main answer if this is a tracking-primary question (like Chassis Number)
    if (isRankTrackingEnabled && (question.type?.toLowerCase().includes('chassis') || question.type === 'text' || question.type === 'short_text')) {
      onChange(val);
    }
  };

  // Fetch rank when tracking value changes
  useEffect(() => {
    const fetchRank = async () => {
      if (!isRankTrackingEnabled || !formId || !effectiveTrackingValue.trim()) {
        setRank(null);
        return;
      }
      try {
        setLoadingRank(true);
        const response = await apiClient.get('/responses/rank', {
          params: {
            formId,
            questionId: question.id || question._id,
            answer: effectiveTrackingValue,
          },
        });
        if (response.data?.success && typeof response.data.data?.rank === 'number') {
          setRank(response.data.data.rank);
        } else {
          setRank(null);
        }
      } catch {
        setRank(null);
      } finally {
        setLoadingRank(false);
      }
    };

    const timer = setTimeout(fetchRank, 600);
    return () => clearTimeout(timer);
  }, [isRankTrackingEnabled, effectiveTrackingValue, formId, question.id, question._id]);

  // Fetch suggestions for question tracking
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (isQuestionTrackingEnabled && formId) {
        try {
          setLoadingSuggestions(true);
          const response = await apiClient.get('/responses/suggestions', {
            params: { formId, questionId: question.id || question._id, answer: value || '' },
          });
          if (response.data?.success) {
            setSuggestions(response.data.data?.suggestedAnswers || []);
          }
        } catch (err: any) {
          if (err.response?.status !== 404) console.error('Failed to fetch suggestions:', err);
        } finally {
          setLoadingSuggestions(false);
        }
      }
    };
    fetchSuggestions();
  }, [isQuestionTrackingEnabled, formId, question.id, question._id, value]);

  const toggleOption = (option: string) => {
    const cur = Array.isArray(value) ? value : [];
    onChange(cur.includes(option) ? cur.filter(v => v !== option) : [...cur, option]);
  };

  const selectAll = () => onChange(question.options || []);
  const clearAll = () => onChange([]);

  const getRankColor = (r: number) => {
    if (r === 1) return { bg: '#dcfce7', text: '#166534', border: '#86efac' };
    if (r === 2) return { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' };
    if (r === 3) return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' };
    return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
  };

  const renderTrackRankInput = () => {
    if (!isRankTrackingEnabled || readOnly) return null;

    return (
      <View style={styles.trackRankContainer}>
        <View style={styles.trackRankHeader}>
          <View style={styles.trackRankDot} />
          <Text style={styles.trackRankTitle}>TRACK RANK</Text>
        </View>
        <View style={styles.trackRankBody}>
          <Text style={styles.trackRankLabel}>{rankLabel}</Text>
          <TextInput
            style={styles.trackRankInput}
            value={effectiveTrackingValue}
            onChangeText={handleTrackingChange}
            placeholder={`Enter ${rankLabel.toLowerCase()}…`}
            placeholderTextColor="#9ca3af"
            keyboardType={rankInputType === 'number' ? 'numeric' : 'default'}
          />
        </View>
      </View>
    );
  };

  const renderRankBadge = () => {
    if (!isRankTrackingEnabled) return null;
    if (loadingRank) {
      return (
        <View style={styles.rankBadgeLoading}>
          <ActivityIndicator size="small" color="#3b82f6" />
        </View>
      );
    }
    if (typeof rank === 'number' && rank > 0) {
      const colors = getRankColor(rank);
      return (
        <View style={[styles.rankBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Hash size={10} color={colors.text} />
          <Text style={[styles.rankBadgeText, { color: colors.text }]}>{rank}</Text>
        </View>
      );
    }
    return null;
  };

  const renderInput = () => {
    switch (question.type?.toLowerCase()) {
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
            placeholder={question.type?.toLowerCase().includes('chassis') ? 'Enter Chassis Number...' : 'Enter response...'}
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
                  style={[styles.optionCard, isSelected && styles.optionCardSelected, readOnly && styles.disabledOpacity]}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option}</Text>
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
      case 'multiplechoice': {
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
              <Text style={[styles.dropdownText, !value && styles.placeholderText]}>{displayValue}</Text>
              <ChevronDown size={20} color="#64748b" />
            </TouchableOpacity>
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
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
                      const isSelected = isMulti ? (Array.isArray(value) && value.includes(option)) : (value === option);
                      return (
                        <TouchableOpacity
                          key={option}
                          style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                          onPress={() => { if (isMulti) { toggleOption(option); } else { onChange(option); setModalVisible(false); } }}
                        >
                          <View style={styles.optionItemContent}>
                            <View style={[isMulti ? styles.checkbox : styles.radio, isSelected && styles.checkedBox]}>
                              {isSelected && <Check size={14} color="#fff" />}
                            </View>
                            <Text style={[styles.optionItemText, isSelected && styles.optionItemTextActive]}>{option}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <TouchableOpacity style={styles.doneBtn} onPress={() => setModalVisible(false)}>
                    <Text style={styles.doneBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Modal>
          </>
        );
      }

      case 'chassis-with-zone':
        return <ChassisInspection question={question} value={value} onChange={onChange} readOnly={readOnly} showZone={true} />;

      case 'chassis-without-zone':
        return <ChassisInspection question={question} value={value} onChange={onChange} readOnly={readOnly} showZone={false} />;

      case 'zone-in':
      case 'zonein':
        return (
          <ZoneIn
            question={question} value={value} onChange={onChange} readOnly={readOnly}
            suggestions={suggestions} hideChassisNumber={!isQuestionTrackingEnabled}
          />
        );

      case 'zone-out':
      case 'zoneout':
        return (
          <ZoneOut
            question={question} value={value} onChange={onChange} readOnly={readOnly}
            suggestions={suggestions} hideChassisNumber={!isQuestionTrackingEnabled}
          />
        );

      case 'radio-image':
      case 'radioimage':
        return <RadioImage question={question} value={value} onChange={onChange} readOnly={readOnly} />;

      case 'emoji-star-feedback':
      case 'star':
        return <FeedbackQuestion type="emoji-star" question={question} value={value} onChange={onChange} readOnly={readOnly} />;

      case 'emoji-reaction-feedback':
      case 'reaction':
        return <FeedbackQuestion type="emoji-reaction" question={question} value={value} onChange={onChange} readOnly={readOnly} />;

      case 'satisfaction-rating':
      case 'satisfaction':
        return <FeedbackQuestion type="satisfaction" question={question} value={value} onChange={onChange} readOnly={readOnly} />;

      case 'rating-number':
        return <FeedbackQuestion type="rating-number" question={question} value={value} onChange={onChange} readOnly={readOnly} />;

      case 'radio-grid':
      case 'radiogrid':
        return <GridQuestion type="radio" question={question} value={value} onChange={onChange} readOnly={readOnly} />;

      case 'checkbox-grid':
      case 'checkboxgrid':
        return <GridQuestion type="checkbox" question={question} value={value} onChange={onChange} readOnly={readOnly} />;

      case 'productNPSTGWBuckets':
      case 'hierarchy':
        return <ProductNPSTGWBuckets value={value} onChange={onChange} readOnly={readOnly} />;

      case 'search-select':
      case 'searchselect':
        return (
          <SearchSelect
            options={question.options || []} value={value} onChange={onChange}
            readOnly={readOnly} placeholder={question.placeholder || 'Search options...'}
          />
        );

      case 'slider-feedback':
      case 'slider':
        return <SliderFeedback question={question} value={value} onChange={onChange} readOnly={readOnly} />;

      case 'rating':
      case 'scale': {
        const max = question.max || 5;
        const ratingValue = Number(value) || 0;
        return (
          <View style={styles.ratingContainer}>
            {Array.from({ length: max }).map((_, i) => (
              <TouchableOpacity key={i} disabled={readOnly} onPress={() => onChange(String(i + 1))} style={styles.starBtn}>
                <CheckCircle2 size={32} color={i < ratingValue ? '#3b82f6' : '#e2e8f0'} fill={i < ratingValue ? '#3b82f6' : 'transparent'} />
                <Text style={[styles.starLabel, i < ratingValue && styles.starLabelActive]}>{i + 1}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      }

      case 'date':
        return (
          <View style={styles.dateInputWrapper}>
            <TextInput
              style={[styles.textInput, readOnly && styles.disabledInput]}
              value={value || ''} onChangeText={onChange} editable={!readOnly}
              placeholder="YYYY-MM-DD" placeholderTextColor="#9ca3af"
            />
          </View>
        );

      case 'image':
      case 'file':
      case 'upload':
      case 'photo':
        return (
          <View style={styles.imageInputContainer}>
            {value ? (
              <View style={styles.imagePreviewWrapper}>
                <Image source={{ uri: getImageUrl(value) }} style={styles.imagePreview} resizeMode="cover" />
                {!readOnly && (
                  <TouchableOpacity style={styles.removeImgBtn} onPress={() => onChange('')}>
                    <X size={16} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.imageActions}>
                <TouchableOpacity
                  style={[styles.imageBtn, readOnly && styles.disabledOpacity]}
                  disabled={readOnly} onPress={() => setModalVisible(true)}
                >
                  <Camera size={20} color="#3b82f6" />
                  <Text style={styles.imageBtnText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.imageBtn, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }, readOnly && styles.disabledOpacity]}
                  disabled={readOnly}
                  onPress={async () => {
                    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
                    if (!res.canceled) onChange(res.assets[0].uri);
                  }}
                >
                  <Upload size={20} color="#64748b" />
                  <Text style={[styles.imageBtnText, { color: '#64748b' }]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
            <InAppCamera
              visible={modalVisible} onClose={() => setModalVisible(false)}
              onCapture={(uri) => { onChange(uri); setModalVisible(false); }}
            />
          </View>
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
      {!hideLabel && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {question.text || question.label || question.title || "Untitled Question"}
            {question.required && <Text style={styles.requiredAsterisk}> *</Text>}
          </Text>
          {question.subParam1 && (
            <View style={styles.subParamBadge}>
              <Text style={styles.subParamText}>{question.subParam1.toUpperCase()}</Text>
            </View>
          )}
        </View>
      )}

      {question.description && (
        <Text style={styles.descriptionText}>{question.description}</Text>
      )}

      {/* Reference Image Support (Parity with Web) */}
      {(question.imageUrl || question.image) && (
        <View style={styles.referenceImageContainer}>
          <Image 
            source={{ uri: getImageUrl(question.imageUrl || question.image) }} 
            style={styles.referenceImage} 
            resizeMode="contain"
          />
        </View>
      )}
      {/* Track Rank Badge — shown inline next to main input */}
      {isRankTrackingEnabled && (
        <View style={styles.rankBadgeRow}>
          {renderRankBadge()}
          {(typeof rank === 'number' && rank > 0) && (
            <Text style={styles.rankBadgeHint}>
              {rankLabel}
            </Text>
          )}
        </View>
      )}

      {/* Track Rank Input Field */}
      {renderTrackRankInput()}

      {/* Main question input */}
      {renderInput()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 10 },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 20,
  },
  referenceImageContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  referenceImage: {
    width: '100%',
    height: '100%',
  },
  requiredAsterisk: {
    color: '#ef4444',
    fontWeight: '900',
    fontSize: 16,
  },
  descriptionText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  subParamBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  subParamText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3b82f6',
  },
  // Track Rank styles
  trackRankContainer: {
    marginBottom: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    overflow: 'hidden',
  },
  trackRankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  trackRankDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#3b82f6',
  },
  trackRankTitle: {
    fontSize: 9, fontWeight: '900', color: '#1d4ed8', letterSpacing: 1,
  },
  trackRankBody: { padding: 12, gap: 6 },
  trackRankLabel: {
    fontSize: 11, fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  trackRankInput: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#93c5fd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1f2937',
  },

  // Rank badge
  rankBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  rankBadgeText: { fontSize: 11, fontWeight: '900' },
  rankBadgeLoading: { paddingVertical: 3 },
  rankBadgeHint: { fontSize: 10, fontWeight: '600', color: '#64748b' },

  // Text inputs
  textInput: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#1f2937',
  },
  textArea: { height: 100 },
  disabledInput: { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb' },

  // Radio / options
  optionsGrid: { gap: 10 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#fff', borderWidth: 2, borderColor: '#f3f4f6', borderRadius: 16,
  },
  optionCardSelected: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  optionText: { fontSize: 15, fontWeight: '500', color: '#4b5563' },
  optionTextSelected: { color: '#1d4ed8', fontWeight: '700' },
  radioCircle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center',
  },
  radioCircleSelected: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  disabledOpacity: { opacity: 0.6 },

  // Dropdown modal
  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12,
    paddingHorizontal: 16, height: 52,
  },
  dropdownText: { fontSize: 16, color: '#1f2937' },
  placeholderText: { color: '#9ca3af' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 40, maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', flex: 1, marginRight: 10 },
  modalActions: {
    flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 12, gap: 16,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  actionLink: { paddingVertical: 4 },
  actionLinkText: { color: '#3b82f6', fontWeight: '700', fontSize: 14 },
  optionsScroll: { padding: 16 },
  optionItem: { padding: 16, borderRadius: 12, marginBottom: 8 },
  optionItemSelected: { backgroundColor: '#eff6ff' },
  optionItemContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center',
  },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center',
  },
  checkedBox: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  optionItemText: { fontSize: 16, color: '#475569', fontWeight: '500' },
  optionItemTextActive: { color: '#1d4ed8', fontWeight: '700' },
  doneBtn: {
    backgroundColor: '#1e3a8a', margin: 24, height: 54, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Misc
  fallbackContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12,
    backgroundColor: '#f9fafb', borderRadius: 8,
  },
  fallbackText: { color: '#6b7280', fontSize: 14 },
  ratingContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  starBtn: { alignItems: 'center', gap: 4 },
  starLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
  starLabelActive: { color: '#3b82f6' },
  dateInputWrapper: { flex: 1 },
  imageInputContainer: { marginTop: 5 },
  imagePreviewWrapper: {
    width: '100%', height: 200, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f1f5f9',
  },
  imagePreview: { width: '100%', height: '100%' },
  removeImgBtn: {
    position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)',
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  imageActions: { flexDirection: 'row', gap: 12 },
  imageBtn: {
    flex: 1, height: 52, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed',
    borderColor: '#3b82f6', backgroundColor: '#eff6ff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  imageBtnText: { fontSize: 14, fontWeight: '700', color: '#3b82f6' },
});
