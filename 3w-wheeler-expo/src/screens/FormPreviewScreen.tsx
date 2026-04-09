import React, { useState, useCallback, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  SafeAreaView, 
  TouchableOpacity, 
  Text, 
  ScrollView, 
  Platform, 
  Alert, 
  TextInput,
  ActivityIndicator
} from 'react-native';
import { ChevronLeft, Info, HelpCircle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../api/config';

const FormPreviewScreen = ({ route, navigation }: any) => {
  const { title, id } = route.params || {};
  const [selections, setSelections] = useState<any>({});
  const [textInputs, setTextInputs] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<any[]>([]);
  const [formDetails, setFormDetails] = useState<any>(null);

  const fetchFormDetails = async () => {
    try {
      const response = await apiClient.get(`/forms/${id}`);
      if (response.data.success) {
        setFormDetails(response.data.data.form);
        setSections(response.data.data.form.sections || []);
      }
    } catch (error) {
      console.log('Using mock sections for showcase fallback');
      const fallbackData: Record<string, any> = {
        '3': [
          {
            title: 'Exterior',
            questions: [
              { id: 'body_cond', label: 'Body Condition', type: 'select', options: ['Good', 'Needs Repair'] },
              { id: 'tyre_f', label: 'Tyre Condition (Front)', type: 'select', options: ['Good', 'Worn'] },
              { id: 'tyre_r', label: 'Tyre Condition (Rear)', type: 'select', options: ['Good', 'Worn'] },
              { id: 'glass', label: 'Glass / Windshield', type: 'select', options: ['Intact', 'Cracked'] },
            ]
          },
          {
            title: 'Interior',
            questions: [
              { id: 'seat', label: 'Seat Condition', type: 'select', options: ['Clean', 'Torn'] },
              { id: 'meter', label: 'Speedometer Working?', type: 'select', options: ['Yes', 'No'] },
            ]
          }
        ]
      };
      setSections(fallbackData['3']);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFormDetails();
  }, [id]);

  const toggleSelection = (qId: string, option: string) => {
    setSelections((prev: any) => ({
      ...prev,
      [qId]: option
    }));
  };

  const handleTextInput = (qId: string, text: string) => {
    setTextInputs((prev: any) => ({
      ...prev,
      [qId]: text
    }));
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.loadingText}>Loading Blueprint...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color="#1e3a8a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{formDetails?.title || title || 'Form Preview'}</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formInfoContainer}>
          <Text style={styles.formTitleMain}>{formDetails?.title || title || 'Laxmi Vehicle Inspection'}</Text>
          <Text style={styles.formSubtitle}>{formDetails?.description || 'Periodic safety check for 3-wheelers'}</Text>
          <View style={styles.divider} />
        </View>

        {sections.map((section: any, sIdx: number) => (
          <View key={sIdx} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.questions.map((q: any, qIdx: number) => {
              const questionId = q.id || q._id;
              const questionLabel = q.text || q.label;
              const fieldType = q.type?.toLowerCase() || 'text';
              const options = q.options || [];

              return (
                <View key={qIdx} style={styles.questionItem}>
                  <View style={styles.questionRow}>
                    <Text style={styles.questionLabel}>{questionLabel}</Text>
                  </View>
                  
                  {fieldType === 'radio' || fieldType === 'select' ? (
                    <View style={styles.optionsGrid}>
                      {options.map((optObj: any) => {
                        const opt = typeof optObj === 'string' ? optObj : optObj.text;
                        return (
                          <TouchableOpacity 
                            key={opt}
                            style={[
                              styles.optionBtn,
                              selections[questionId] === opt && styles.optionBtnActive
                            ]}
                            onPress={() => toggleSelection(questionId, opt)}
                          >
                            <Text style={[
                              styles.optionText,
                              selections[questionId] === opt && styles.optionTextActive
                            ]}>
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <TextInput
                      style={fieldType === 'paragraph' || fieldType === 'textarea' ? styles.inputArea : styles.input}
                      placeholder={fieldType === 'number' ? 'Enter Number...' : 'Enter Text...'}
                      placeholderTextColor="#94a3b8"
                      value={textInputs[questionId] || ''}
                      onChangeText={(text) => handleTextInput(questionId, text)}
                      keyboardType={fieldType === 'number' ? 'numeric' : 'default'}
                      multiline={fieldType === 'paragraph' || fieldType === 'textarea'}
                      numberOfLines={fieldType === 'paragraph' || fieldType === 'textarea' ? 4 : 1}
                    />
                  )}
                </View>
              );
            })}
          </View>
        ))}

        <TouchableOpacity 
          style={styles.submitBtnActive} 
          onPress={() => Alert.alert('Success', 'Inspection submitted successfully!')}
        >
          <Text style={styles.submitBtnTextActive}>SUBMIT INSPECTION</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  formInfoContainer: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  formTitleMain: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 6,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginTop: 20,
    width: '100%',
  },
  sectionContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e3a8a',
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionItem: {
    marginBottom: 20,
  },
  questionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  input: {
    backgroundColor: '#f8fafc',
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '500',
  },
  inputArea: {
    backgroundColor: '#f8fafc',
    minHeight: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '500',
    textAlignVertical: 'top',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  optionBtnActive: {
    backgroundColor: '#1e3a8a',
    borderColor: '#1e3a8a',
  },
  optionText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  optionTextActive: {
    color: '#fff',
  },
  submitBtnActive: {
    backgroundColor: '#1e3a8a',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnTextActive: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1,
  }
});

export default FormPreviewScreen;
