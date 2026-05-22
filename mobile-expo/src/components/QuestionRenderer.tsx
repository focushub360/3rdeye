import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Modal, ScrollView, Pressable, Dimensions, Image, ActivityIndicator,
} from 'react-native';
import {
  Camera, CheckCircle2, AlertCircle, ChevronDown,
  Check, X, Hash, Upload, ChevronLeft, ChevronRight
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
import * as ImagePicker from 'expo-image-picker';
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
  historicalValue?: any;
  selectedRank?: number;
  totalHistorical?: number;
  historicalStatus?: string;
  historicalReview?: any;
  historicalSubmittedBy?: string;
  historicalChassis?: string;
  onRankChange?: (rank: number) => void;
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
  historicalValue,
  selectedRank = 1,
  totalHistorical = 0,
  historicalStatus,
  historicalReview,
  historicalSubmittedBy,
  historicalChassis,
  onRankChange,
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

  const isTrackingEnabled = isRankTrackingEnabled || isQuestionTrackingEnabled;

  const trackingLabel = isQuestionTrackingEnabled
    ? (question.trackResponseQuestionLabel || 'Tracking Question')
    : (question.trackResponseRankLabel || 'Tracking Value');

  const trackingInputType = isQuestionTrackingEnabled
    ? (question.trackResponseQuestionType || 'text')
    : (question.trackResponseRankType || 'text');

  // Internal tracking value for rank (used when no external prop provided)
  const [internalTrackingValue, setInternalTrackingValue] = useState('');
  
  // Logic parity with web: Determine which value to use for fetching rank
  const effectiveTrackingValue = React.useMemo(() => {
    // If a tracking value is provided via props (from parent form), use it
    if (trackingValue !== undefined && trackingValue !== '') return trackingValue;
    
    // If trackResponseQuestion is enabled but no trackingValue provided, use internal
    if (isQuestionTrackingEnabled && internalTrackingValue) return internalTrackingValue;
    
    // Fallback: Use the main question value (extract chassisNumber if object)
    let val = value;
    if (typeof val === 'object' && val !== null) {
      val = val.chassisNumber || val.value || '';
    }
    
    return val || internalTrackingValue || '';
  }, [trackingValue, internalTrackingValue, value, isQuestionTrackingEnabled]);

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
      if (!isTrackingEnabled || !formId || !effectiveTrackingValue.trim()) {
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
  }, [isTrackingEnabled, effectiveTrackingValue, formId, question.id, question._id]);

  // Fetch suggestions for question tracking
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (isQuestionTrackingEnabled && formId) {
        try {
          setLoadingSuggestions(true);
          const response = await apiClient.get('/responses/suggestions', {
            params: { formId, questionId: question.id || question._id, answer: effectiveTrackingValue || '' },
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
  }, [isQuestionTrackingEnabled, formId, question.id, question._id, effectiveTrackingValue]);

  const toggleOption = (option: string) => {
    const cur = Array.isArray(value) ? value : [];
    onChange(cur.includes(option) ? cur.filter(v => v !== option) : [...cur, option]);
  };

  const selectAll = () => onChange(question.options || []);
  const clearAll = () => onChange([]);

  const getRankColor = (r: number) => {
    if (r === 1) return { bg: '#10b981', text: '#ffffff', border: '#059669' }; // Premium Green for #1
    if (r === 2) return { bg: '#3b82f6', text: '#ffffff', border: '#2563eb' }; // Blue for #2
    if (r === 3) return { bg: '#f59e0b', text: '#ffffff', border: '#d97706' }; // Amber for #3
    return { bg: '#64748b', text: '#ffffff', border: '#475569' }; // Slate for others
  };

  const renderTrackRankInput = () => {
    if (!isTrackingEnabled || readOnly) return null;

    return (
      <View style={styles.trackRankContainer}>
        <View style={styles.trackRankHeader}>
          <View style={styles.trackRankDot} />
          <Text style={styles.trackRankTitle}>{isQuestionTrackingEnabled ? 'TRACK QUESTION' : 'TRACK RANK'}</Text>
        </View>
        <View style={styles.trackRankBody}>
          <View style={styles.trackRankLabelRow}>
            <Text style={styles.trackRankLabel}>{trackingLabel}</Text>
            {rank !== null && renderRankBadge()}
          </View>
          <TextInput
            style={styles.trackRankInput}
            value={effectiveTrackingValue}
            onChangeText={handleTrackingChange}
            placeholder={`Enter ${trackingLabel.toLowerCase()}…`}
            placeholderTextColor="#9ca3af"
            keyboardType={trackingInputType === 'number' ? 'numeric' : 'default'}
          />
          {rank === null && effectiveTrackingValue.trim() !== '' && !loadingRank && (
            <Text style={styles.rankBadgeHint}>No previous records found for this {trackingLabel.toLowerCase()}.</Text>
          )}
        </View>
      </View>
    );
  };

  const renderRankBadge = () => {
    if (!isTrackingEnabled) return null;
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
          <Text style={[styles.rankBadgeText, { color: colors.text }]}>#{rank}</Text>
        </View>
      );
    }
    return null;
  };

  const renderHistoricalSuggestions = () => {
    if (readOnly || !suggestions || suggestions.length === 0 || !effectiveTrackingValue.trim()) return null;

    // Group suggestions by value to match web logic
    const grouped = new Map<string, { ranks: number[], status: string[] }>();
    
    suggestions.forEach((s: any) => {
      const val = s.answers?.[question.id || question._id];
      if (!val) return;
      
      const displayVal = typeof val === 'object' ? (val.chassisNumber || JSON.stringify(val)) : String(val);
      const existing = grouped.get(displayVal);
      if (existing) {
        existing.ranks.push(s.rank || 0);
        if (s.status) existing.status.push(s.status);
      } else {
        grouped.set(displayVal, { 
          ranks: [s.rank || 0], 
          status: s.status ? [s.status] : [] 
        });
      }
    });

    if (grouped.size === 0) return null;

    return (
      <View style={styles.suggestionsContainer}>
        <Text style={styles.suggestionsTitle}>HISTORICAL RECORDS</Text>
        {Array.from(grouped.entries()).map(([val, data], idx) => (
          <View key={idx} style={styles.suggestionItem}>
            <View style={styles.suggestionRanks}>
              {data.ranks.sort((a,b) => a-b).map(r => (
                <View key={r} style={[styles.suggestionRankBadge, { backgroundColor: getRankColor(r).bg }]}>
                  <Text style={styles.suggestionRankText}>#{r}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.suggestionValue} numberOfLines={2}>{val}</Text>
            <View style={styles.suggestionStatusRow}>
               {[...new Set(data.status)].map((s, sIdx) => (
                 <Text key={sIdx} style={styles.suggestionStatusText}>{s.toUpperCase()}</Text>
               ))}
            </View>
          </View>
        ))}
      </View>
    );
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
      case 'yesnona':
      case 'YESNONA': {
        const options = (question.options && question.options.length > 0) 
          ? question.options 
          : ['Yes', 'No', 'N/A'];

        return (
          <View style={styles.optionsGrid}>
            {options.map((option: string) => {
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
      }

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
        return <ChassisInspection question={question} value={value} onChange={onChange} readOnly={readOnly} showZone={true} suggestions={suggestions} />;

      case 'chassis-without-zone':
        return <ChassisInspection question={question} value={value} onChange={onChange} readOnly={readOnly} showZone={false} suggestions={suggestions} />;

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
          {isTrackingEnabled && rank !== null && (
            <View style={{ marginLeft: 8 }}>
              {renderRankBadge()}
            </View>
          )}
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
      {/* Track Rank Badge Row (Fallback) */}
      {isTrackingEnabled && !hideLabel && rank === null && (
        <View style={styles.rankBadgeRow}>
          {renderRankBadge()}
        </View>
      )}

      {/* Track Rank Input Field */}
      {renderTrackRankInput()}

      {/* Main question input */}
      {renderInput()}

      {/* Historical Suggestions (Grouped List) */}
      {renderHistoricalSuggestions()}

      {/* Historical Record Display */}
      {historicalValue !== undefined && historicalValue !== null && historicalValue !== '' && effectiveTrackingValue.trim() !== '' && (
        <View style={styles.historicalContainer}>
          <View style={styles.historicalHeader}>
            <View style={styles.historicalBadgeRow}>
              <View style={[styles.historicalBadge, selectedRank > 1 && { backgroundColor: '#3b82f6' }]}>
                 <Text style={styles.historicalBadgeText}>#{selectedRank}</Text>
              </View>
              {(historicalStatus || historicalReview?.option) && (
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: (historicalReview?.option === 'Accepted' || String(historicalStatus).toLowerCase() === 'verified') ? '#ecfdf5' : 
                                    (historicalReview?.option === 'Rejected' || String(historicalStatus).toLowerCase() === 'rejected') ? '#fef2f2' : 
                                    (historicalReview?.option === 'Rework' || String(historicalStatus).toLowerCase().includes('rework')) ? '#fff7ed' : '#f1f5f9' }
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    { color: (historicalReview?.option === 'Accepted' || String(historicalStatus).toLowerCase() === 'verified') ? '#059669' : 
                             (historicalReview?.option === 'Rejected' || String(historicalStatus).toLowerCase() === 'rejected') ? '#ef4444' : 
                             (historicalReview?.option === 'Rework' || String(historicalStatus).toLowerCase().includes('rework')) ? '#d97706' : '#64748b' }
                  ]}>
                    {(historicalReview?.option || historicalStatus || 'PENDING').toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.historicalTitle}>HISTORICAL RECORD {totalHistorical > 1 ? `(${selectedRank} of ${totalHistorical})` : ''}</Text>
          </View>
          
          <View style={styles.historicalMetaRow}>
            <View style={styles.historicalMetaItem}>
              <Text style={styles.historicalMetaLabel}>SUBMITTED BY</Text>
              <Text style={styles.historicalMetaValue}>{historicalSubmittedBy || 'Anonymous'}</Text>
            </View>
            <View style={styles.historicalMetaItem}>
              <Text style={styles.historicalMetaLabel}>TIMESTAMP</Text>
              <Text style={styles.historicalMetaValue}>
                {historicalReview?.createdAt ? new Date(historicalReview.createdAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
              </Text>
            </View>
            {historicalChassis && (
              <View style={styles.historicalMetaItem}>
                <Text style={styles.historicalMetaLabel}>CHASSIS</Text>
                <Text style={[styles.historicalMetaValue, { color: '#1e3a8a', fontWeight: '800' }]}>{historicalChassis}</Text>
              </View>
            )}
          </View>

          {totalHistorical > 1 && onRankChange && (
            <View style={styles.rankSwitcherRow}>
              <TouchableOpacity 
                disabled={selectedRank <= 1} 
                onPress={() => onRankChange(selectedRank - 1)}
                style={[styles.rankSwitcherBtn, selectedRank <= 1 && styles.disabledOpacity]}
              >
                <ChevronLeft size={16} color={selectedRank <= 1 ? '#cbd5e1' : '#3b82f6'} />
                <Text style={[styles.rankSwitcherText, { color: selectedRank <= 1 ? '#cbd5e1' : '#3b82f6' }]}>PREV</Text>
              </TouchableOpacity>
              
              <Text style={styles.rankSwitcherInfo}>{selectedRank} / {totalHistorical}</Text>

              <TouchableOpacity 
                disabled={selectedRank >= totalHistorical} 
                onPress={() => onRankChange(selectedRank + 1)}
                style={[styles.rankSwitcherBtn, selectedRank >= totalHistorical && styles.disabledOpacity]}
              >
                <Text style={[styles.rankSwitcherText, { color: selectedRank >= totalHistorical ? '#cbd5e1' : '#3b82f6' }]}>NEXT</Text>
                <ChevronRight size={16} color={selectedRank >= totalHistorical ? '#cbd5e1' : '#3b82f6'} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.historicalContent}>
            <Text style={styles.historicalValueText}>
              {(() => {
                if (!historicalValue) return 'N/A';
                if (typeof historicalValue === 'string') return historicalValue;
                if (typeof historicalValue === 'object') {
                  // Handle common object structures like {status, remark}
                  return historicalValue.status || historicalValue.label || JSON.stringify(historicalValue);
                }
                return String(historicalValue);
              })()}
            </Text>
          </View>
        </View>
      )}
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
  trackRankLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
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
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: -0.5 },
  rankBadgeLoading: { paddingVertical: 3 },
  rankBadgeHint: { fontSize: 10, fontWeight: '600', color: '#64748b', marginTop: 4 },

  // Suggestions styles
  suggestionsContainer: {
    marginTop: 12,
    gap: 8,
  },
  suggestionsTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  suggestionItem: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  suggestionRanks: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  suggestionRankBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  suggestionRankText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#fff',
  },
  suggestionValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  suggestionStatusRow: {
    flexDirection: 'row',
    gap: 6,
  },
  suggestionStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
  },

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

  // Historical Record Styles
  historicalContainer: {
    marginTop: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    padding: 12,
  },
  historicalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historicalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historicalMetaRow: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  historicalMetaItem: {
    flex: 1,
  },
  historicalMetaLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 2,
  },
  historicalMetaValue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  rankSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    marginHorizontal: 4,
    marginTop: 4,
    marginBottom: 8,
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rankSwitcherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rankSwitcherText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rankSwitcherInfo: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  historicalContent: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  historicalBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historicalBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  historicalTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  historicalValueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
});
