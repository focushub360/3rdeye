import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Platform,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, CheckCircle, CircleDot, Square, CheckSquare } from 'lucide-react-native';
import apiClient from '../api/config';
import { useAuth } from '../context/AuthContext';

// ─── Question renderer helpers ───────────────────────────────────────────────

const YesNoNAQuestion = ({ question, value, onChange }: any) => {
  const options = ['Yes', 'No', 'N/A'];
  return (
    <View style={qStyles.row}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[qStyles.pill, value === opt && qStyles.pillSelected]}
          onPress={() => onChange(opt)}
        >
          <Text style={[qStyles.pillText, value === opt && qStyles.pillTextSelected]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const RadioQuestion = ({ question, value, onChange }: any) => {
  const options = question.options || [];
  return (
    <View>
      {options.map((opt: any) => {
        const label = typeof opt === 'string' ? opt : opt.label || opt.value || '';
        const selected = value === label;
        return (
          <TouchableOpacity key={label} style={qStyles.optionRow} onPress={() => onChange(label)}>
            <View style={[qStyles.radio, selected && qStyles.radioSelected]}>
              {selected && <View style={qStyles.radioDot} />}
            </View>
            <Text style={qStyles.optionLabel}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const CheckboxQuestion = ({ question, value = [], onChange }: any) => {
  const options = question.options || [];
  const toggle = (label: string) => {
    const current = Array.isArray(value) ? value : [];
    onChange(current.includes(label) ? current.filter((v: string) => v !== label) : [...current, label]);
  };
  return (
    <View>
      {options.map((opt: any) => {
        const label = typeof opt === 'string' ? opt : opt.label || opt.value || '';
        const checked = Array.isArray(value) && value.includes(label);
        return (
          <TouchableOpacity key={label} style={qStyles.optionRow} onPress={() => toggle(label)}>
            {checked
              ? <CheckSquare size={20} color="#1e3a8a" />
              : <Square size={20} color="#94a3b8" />}
            <Text style={qStyles.optionLabel}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const TextQuestion = ({ question, value, onChange }: any) => (
  <TextInput
    style={qStyles.input}
    value={value || ''}
    onChangeText={onChange}
    placeholder={question.placeholder || 'Type your answer...'}
    placeholderTextColor="#94a3b8"
    multiline={question.type === 'paragraph' || question.type === 'textarea'}
    numberOfLines={question.type === 'paragraph' || question.type === 'textarea' ? 4 : 1}
  />
);

const RatingQuestion = ({ question, value, onChange }: any) => {
  const max = question.max || 5;
  return (
    <View style={qStyles.row}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <TouchableOpacity
          key={n}
          style={[qStyles.ratingBtn, Number(value) === n && qStyles.ratingBtnSelected]}
          onPress={() => onChange(String(n))}
        >
          <Text style={[qStyles.ratingText, Number(value) === n && qStyles.ratingTextSelected]}>{n}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const QuestionRenderer = ({ question, value, onChange }: any) => {
  const type = (question.type || '').toLowerCase();

  if (type === 'yesnona' || type === 'yes_no_na' || type === 'yesno') {
    return <YesNoNAQuestion question={question} value={value} onChange={onChange} />;
  }
  if (type === 'radio' || type === 'multiplechoice') {
    return <RadioQuestion question={question} value={value} onChange={onChange} />;
  }
  if (type === 'checkbox' || type === 'checkboxes') {
    return <CheckboxQuestion question={question} value={value} onChange={onChange} />;
  }
  if (type === 'rating' || type === 'scale') {
    return <RatingQuestion question={question} value={value} onChange={onChange} />;
  }
  // Default: text input
  return <TextQuestion question={question} value={value} onChange={onChange} />;
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

const FormPreviewScreen = ({ route, navigation }: any) => {
  const { title, id } = route.params || {};
  const { user } = useAuth();

  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  const fetchForm = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get(`/forms/${id}`);
      const formData = response.data?.data?.form || response.data?.data || response.data?.form || response.data;
      setForm(formData);
    } catch (err: any) {
      console.error('FormPreview fetch error:', err.message);
      setError('Could not load form. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchForm(); }, [fetchForm]);

  const sections = form?.sections || [];
  const currentSection = sections[currentSectionIndex];
  const isFirst = currentSectionIndex === 0;
  const isLast = currentSectionIndex === sections.length - 1;

  const handleAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (!isLast) setCurrentSectionIndex(i => i + 1);
  };

  const handlePrev = () => {
    if (!isFirst) setCurrentSectionIndex(i => i - 1);
  };

  const handleSubmit = () => {
    Alert.alert(
      'Submit Form',
      'Are you sure you want to submit this form?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: () => {
            setSubmitted(true);
          },
        },
      ]
    );
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft size={24} color="#1e3a8a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{title || 'Form Preview'}</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text style={styles.loadingText}>Loading form...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft size={24} color="#1e3a8a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title || 'Form Preview'}</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchForm}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Submitted state
  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <CheckCircle size={64} color="#10b981" />
          <Text style={styles.successTitle}>Form Submitted!</Text>
          <Text style={styles.successSubtitle}>Thank you for completing this form.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.retryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color="#1e3a8a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{form?.title || title}</Text>
      </View>

      {/* Section progress bar */}
      {sections.length > 1 && (
        <View style={styles.progressBar}>
          {sections.map((_: any, i: number) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i <= currentSectionIndex && styles.progressDotActive,
                i < currentSectionIndex && styles.progressDotDone,
              ]}
            />
          ))}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Section title */}
        {currentSection && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionCounter}>
              Section {currentSectionIndex + 1} of {sections.length}
            </Text>
            <Text style={styles.sectionTitle}>{currentSection.title}</Text>
            {currentSection.description ? (
              <Text style={styles.sectionDescription}>{currentSection.description}</Text>
            ) : null}
          </View>
        )}

        {/* Questions */}
        {(currentSection?.questions || []).map((question: any, qi: number) => (
          <View key={question.id || qi} style={styles.questionCard}>
            <View style={styles.questionHeader}>
              <View style={styles.questionBadge}>
                <Text style={styles.questionBadgeText}>{qi + 1}</Text>
              </View>
              <Text style={styles.questionText}>
                {question.text}
                {question.required && <Text style={styles.required}> *</Text>}
              </Text>
            </View>
            {question.description ? (
              <Text style={styles.questionDescription}>{question.description}</Text>
            ) : null}
            <View style={styles.questionAnswer}>
              <QuestionRenderer
                question={question}
                value={answers[question.id]}
                onChange={(val: any) => handleAnswer(question.id, val)}
              />
            </View>
          </View>
        ))}

        {/* Nav buttons */}
        <View style={styles.navRow}>
          {!isFirst && (
            <TouchableOpacity style={styles.navBtnSecondary} onPress={handlePrev}>
              <ChevronLeft size={18} color="#1e3a8a" />
              <Text style={styles.navBtnSecondaryText}>Previous</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {!isLast ? (
            <TouchableOpacity style={styles.navBtnPrimary} onPress={handleNext}>
              <Text style={styles.navBtnPrimaryText}>Next</Text>
              <ChevronRight size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.navBtnPrimary, { backgroundColor: '#10b981' }]} onPress={handleSubmit}>
              <Text style={styles.navBtnPrimaryText}>Submit</Text>
              <CheckCircle size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Question styles ──────────────────────────────────────────────────────────

const qStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  pillSelected: { borderColor: '#1e3a8a', backgroundColor: '#eff6ff' },
  pillText: { fontSize: 14, color: '#475569', fontWeight: '600' },
  pillTextSelected: { color: '#1e3a8a' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#cbd5e1',
    justifyContent: 'center', alignItems: 'center',
  },
  radioSelected: { borderColor: '#1e3a8a' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1e3a8a' },
  optionLabel: { fontSize: 14, color: '#374151', flex: 1 },
  input: {
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#1e293b', backgroundColor: '#f8fafc',
    minHeight: 44, textAlignVertical: 'top',
  },
  ratingBtn: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1.5, borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    justifyContent: 'center', alignItems: 'center',
  },
  ratingBtnSelected: { borderColor: '#1e3a8a', backgroundColor: '#1e3a8a' },
  ratingText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  ratingTextSelected: { color: '#fff' },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? 36 : 0,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  backButton: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 14, color: '#1e3a8a', fontSize: 15, fontWeight: '600' },
  errorText: { color: '#ef4444', fontSize: 15, textAlign: 'center', marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#059669', marginTop: 20 },
  successSubtitle: { fontSize: 15, color: '#64748b', marginTop: 8, textAlign: 'center' },
  retryBtn: {
    marginTop: 20, backgroundColor: '#1e3a8a',
    paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  progressBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, backgroundColor: '#fff', gap: 6,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  progressDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#e2e8f0',
  },
  progressDotActive: { backgroundColor: '#93c5fd', width: 10, height: 10, borderRadius: 5 },
  progressDotDone: { backgroundColor: '#1e3a8a' },
  scroll: { padding: 16, paddingBottom: 40 },
  sectionHeader: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 14,
    borderLeftWidth: 4, borderLeftColor: '#1e3a8a',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  sectionCounter: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 1, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  sectionDescription: { fontSize: 13, color: '#64748b', marginTop: 6, lineHeight: 18 },
  questionCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  questionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  questionBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  questionBadgeText: { fontSize: 12, fontWeight: '800', color: '#1e3a8a' },
  questionText: { fontSize: 14, fontWeight: '600', color: '#1e293b', flex: 1, lineHeight: 20 },
  required: { color: '#ef4444' },
  questionDescription: { fontSize: 12, color: '#94a3b8', marginBottom: 10, marginLeft: 36 },
  questionAnswer: { marginLeft: 0 },
  navRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 8,
    gap: 12, paddingTop: 8,
  },
  navBtnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1e3a8a', paddingVertical: 13, paddingHorizontal: 22,
    borderRadius: 12,
  },
  navBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  navBtnSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  navBtnSecondaryText: { color: '#1e3a8a', fontWeight: '700', fontSize: 14 },
});

export default FormPreviewScreen;
