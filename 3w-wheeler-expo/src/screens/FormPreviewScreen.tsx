import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  CircleDot, 
  Square, 
  CheckSquare, 
  Send, 
  Zap, 
  Camera, 
  X, 
  MapPin, 
  ClipboardCheck,
  Upload,
  AlertCircle,
  Sparkles,
  Clock,
  History
} from 'lucide-react-native';



import { StatusBar } from 'react-native';
import apiClient, { BASE_URL, ROOT_URL } from '../api/config';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuth } from '../context/AuthContext';
import QuestionRenderer from '../components/QuestionRenderer';
import NetInfo from '@react-native-community/netinfo';
import { offlineQueue } from '../api/OfflineQueue';
import { useQuestionLogic } from '../hooks/useQuestionLogic';
// import * as Location from 'expo-location';

// Helper to normalize image URLs for reference images
const getReferenceImageUrl = (path: string) => {
  if (!path) return '';
  
  // If it's already a full URL
  if (path.startsWith('http')) {
    // If it's already on our server, return as is
    if (path.includes(ROOT_URL)) return path;
    // Otherwise proxy it (handles Google Drive, redirects, etc.)
    const cleanBase = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
    return `${cleanBase}/files/proxy?url=${encodeURIComponent(path)}`;
  }
  
  // Remove leading slash if exists
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  // If it already includes 'uploads/', point to root
  if (cleanPath.startsWith('uploads/')) return `${ROOT_URL}/${cleanPath}`;
  
  // Otherwise assume it's in the uploads folder
  return `${ROOT_URL}/uploads/${cleanPath}`;
};


// ─── Main Screen ─────────────────────────────────────────────────────────────

const FormPreviewScreen = ({ route, navigation }: any) => {
  const { 
    title, 
    id, 
    answers: initialAnswers, 
    readOnly = false, 
    chassisNumber, 
    shift, 
    status,
    responseId,
    isDispatched: initialDispatched = false,
    submittedBy: initialSubmittedBy,
    submitterContact: initialSubmitterContact
  } = route.params || {};
  const { user, token } = useAuth();

  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers || {});
  const [submitted, setSubmitted] = useState(false);
  const [wasQueued, setWasQueued] = useState(false);
  const [startTime] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [locationName, setLocationName] = useState<string>('');
  const [submittingProgress, setSubmittingProgress] = useState('');
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [selectedChassis, setSelectedChassis] = useState<string>(chassisNumber || '');
  const [trackingValues, setTrackingValues] = useState<Record<string, string>>({});
  const [availableChassis, setAvailableChassis] = useState<any[]>([]);

  // Dispatch State
  const [isDispatched, setIsDispatched] = useState(initialDispatched);
  const [dispatching, setDispatching] = useState(false);

  // Historical Records State
  const [historicalRecords, setHistoricalRecords] = useState<any[]>([]);
  const [fetchingHistorical, setFetchingHistorical] = useState(false);
  const [selectedRank, setSelectedRank] = useState<number>(1);
  const [chassisQId, setChassisQId] = useState<string>('');

  // Location fetching removed as per request
  useEffect(() => {
    setLocationName('');
  }, []);

  const fetchForm = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get(`/forms/${id}`);
      const formData = response.data?.data?.form || response.data?.data || response.data?.form || response.data;
      setForm(formData);

      // Extract available chassis based on tenant assignments
      if (formData.chassisNumbers && formData.chassisNumbers.length > 0) {
        let list = formData.chassisNumbers;
        
        // Filter by tenant assignment if applicable
        if (formData.chassisTenantAssignments && user?.tenantId) {
          const tenantIdStr = user.tenantId.toString();
          const assigned = formData.chassisTenantAssignments
            .filter((a: any) => a.assignedTenants && a.assignedTenants.includes(tenantIdStr))
            .map((a: any) => a.chassisNumber);
          
          if (assigned.length > 0) {
            list = list.filter((c: any) => assigned.includes(c.chassisNumber));
          }
        }
        setAvailableChassis(list);
      }
    } catch (err: any) {
      console.error('FormPreview fetch error:', err.message);
      setError('Could not load form. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchForm(); }, [fetchForm]);

  // Identify Chassis Question ID
  useEffect(() => {
    if (!form?.sections) return;
    
    let foundId = '';
    for (const s of form.sections) {
      if (s.questions) {
        for (const q of s.questions) {
          if (q.type === 'chassisNumber' || q.text?.toLowerCase().includes('chassis number')) {
            foundId = q.id || q._id;
            break;
          }
        }
      }
      if (foundId) break;
    }
    
    if (!foundId) {
      for (const s of form.sections) {
        if (s.questions) {
          for (const q of s.questions) {
            if (q.trackResponseRank) {
              foundId = q.id || q._id;
              break;
            }
          }
        }
        if (foundId) break;
      }
    }
    setChassisQId(foundId);
  }, [form]);

  // Fetch Historical Data when chassis is selected
  useEffect(() => {
    const fetchHistorical = async () => {
      if (!selectedChassis || !form || !id || !chassisQId) {
        setHistoricalRecords([]);
        return;
      }

      try {
        setFetchingHistorical(true);
        const tenantSlug = user?.tenant?.slug || 'default';
        const response = await apiClient.get(`/responses/${tenantSlug}/forms/${id}/suggestions`, {
          params: { questionId: chassisQId, answer: selectedChassis }
        });

        if (response.data?.success && response.data.data?.suggestedAnswers) {
          const suggestions = response.data.data.suggestedAnswers;
          // Filter to ensure we only show records that match the chassis number exactly
          const normalizedChassis = selectedChassis.trim().toLowerCase();
          const filtered = suggestions.filter((s: any) => {
             const val = s.answers?.[chassisQId];
             if (typeof val === 'object' && val?.chassisNumber) return val.chassisNumber.trim().toLowerCase() === normalizedChassis;
             return String(val || '').trim().toLowerCase() === normalizedChassis;
          });
          
          setHistoricalRecords(filtered);
          if (filtered.length > 0) setSelectedRank(1);
        } else {
          setHistoricalRecords([]);
        }
      } catch (err) {
        console.error('Failed to fetch historical records:', err);
        setHistoricalRecords([]);
      } finally {
        setFetchingHistorical(false);
      }
    };

    fetchHistorical();
  }, [selectedChassis, id, form, user?.tenant?.slug]);

  const handleDispatchToggle = async () => {
    if (!responseId || dispatching) return;
    
    try {
      setDispatching(true);
      const nextStatus = !isDispatched;
      
      await apiClient.patch(`/responses/${responseId}`, {
        isDispatched: nextStatus
      });
      
      setIsDispatched(nextStatus);
      Alert.alert(
        'Success', 
        nextStatus ? 'Response marked as dispatched.' : 'Dispatch status removed.'
      );
    } catch (err: any) {
      console.error('Failed to toggle dispatch:', err);
      Alert.alert('Error', 'Failed to update dispatch status. Please try again.');
    } finally {
      setDispatching(false);
    }
  };
  
  const { getOrderedVisibleQuestions } = useQuestionLogic();

  const mainSections = React.useMemo(() => {
    if (!form?.sections) return [];

    // Pre-filter visible root sections
    const baseSections = form.sections.filter((s: any) => {
      const isSub = s.isSubsection === true || s.isSubsection === 'true' || (s.parentSectionId && s.parentSectionId !== '');
      return !isSub;
    });

    if (form.viewType === "question-wise" || form.view_type === "question-wise") {
      const virtualSections: any[] = [];
      baseSections.forEach((section: any, sIdx: number) => {
        const visibleQs = getOrderedVisibleQuestions(section.questions || [], answers);
        
        if (visibleQs.length === 0) {
          // Keep the section even if empty for navigation stability if it's the only one
          virtualSections.push({
            ...section,
            id: `${section.id || sIdx}_empty`,
            questions: [],
            isVirtual: true,
            originalSectionId: section.id,
            originalSectionIndex: sIdx,
            totalOriginalSections: baseSections.length,
            questionIndex: 0,
            totalQuestionsInSection: 0,
          });
        } else {
          visibleQs.forEach((q: any, qIdx: number) => {
            virtualSections.push({
              ...section,
              id: `${section.id || sIdx}_v${qIdx}`,
              title: section.title,
              description: qIdx === 0 ? section.description : "",
              questions: [q],
              isVirtual: true,
              originalSectionId: section.id,
              originalSectionIndex: sIdx,
              totalOriginalSections: baseSections.length,
              questionIndex: qIdx,
              totalQuestionsInSection: visibleQs.length,
            });
          });
        }
      });
      return virtualSections;
    }

    // Build section hierarchy for section-wise view
    const sectionsMap = new Map<string, any>();
    const rootSections: any[] = [];

    baseSections.forEach((section: any, idx: number) => {
      const sId = section.id || section._id || `root_${idx}`;
      sectionsMap.set(sId, { ...section, subsections: [] });
    });

    form.sections.forEach((section: any, idx: number) => {
      const sId = section.id || section._id || `sec_${idx}`;
      const parentId = section.parentSectionId;
      const isSub = section.isSubsection === true || section.isSubsection === 'true' || (parentId && parentId !== '');

      if (isSub && parentId) {
        const mappedSection = { ...section, subsections: [] };
        const parent = sectionsMap.get(parentId);
        if (parent) {
          parent.subsections.push(mappedSection);
        } else if (!sectionsMap.has(sId)) {
           // Fallback for orphaned subsections
           rootSections.push(mappedSection);
        }
      } else {
        const mappedSection = sectionsMap.get(sId);
        if (mappedSection && !rootSections.find(rs => (rs.id || rs._id) === (mappedSection.id || mappedSection._id))) {
          rootSections.push(mappedSection);
        }
      }
    });

    return rootSections;
  }, [form, answers, getOrderedVisibleQuestions]);

  // Safety Effect: Ensure index is always valid when sections change dynamically
  useEffect(() => {
    if (mainSections.length > 0 && currentSectionIndex >= mainSections.length) {
      setCurrentSectionIndex(mainSections.length - 1);
    }
  }, [mainSections.length]);

  const currentSection = mainSections[currentSectionIndex] || mainSections[0];
  const effectiveViewType = form?.viewType || form?.view_type || "section-wise";

  const isFirst = currentSectionIndex === 0;
  const isLast = mainSections.length > 0 && currentSectionIndex >= mainSections.length - 1;

  // For section-wise view, we also need to get visible questions for subsections
  const getVisibleQuestionsForSection = (section: any) => {
    if (!section) return [];
    let qs = getOrderedVisibleQuestions(section.questions || [], answers);
    return qs;
  };

  const visibleQuestions = getVisibleQuestionsForSection(currentSection);

  // Get subsections for display in section-wise view
  const subsections = (effectiveViewType === "section-wise" && currentSection?.subsections) ? currentSection.subsections : [];

  const handleAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    
    // Auto-sync selectedChassis if this is the chassis question
    if (chassisQId && questionId === chassisQId) {
      if (typeof value === 'string') {
        setSelectedChassis(value);
      } else if (typeof value === 'object' && value?.chassisNumber) {
        setSelectedChassis(value.chassisNumber);
      }
    }
  };

  const handleTrackingAnswer = (questionId: string, trackingVal: string) => {
    setTrackingValues(prev => ({ ...prev, [questionId]: trackingVal }));
    setAnswers(prev => ({ ...prev, [`${questionId}_tracking`]: trackingVal }));
    
    // Auto-sync selectedChassis if this is the tracking-enabled chassis question
    if (chassisQId && questionId === chassisQId && trackingVal) {
      setSelectedChassis(trackingVal);
    }
  };

  const handleNext = () => {
    // Validate current section required questions
    const missing: string[] = [];
    if (currentSection) {
      visibleQuestions.forEach((q: any) => {
        if (q.required) {
          const ans = answers[q.id];
          let isAnswered = ans !== undefined && ans !== null && ans !== '' && (!Array.isArray(ans) || ans.length > 0);
          
          // Enhanced check for object-based responses (Chassis/Zone types)
          if (isAnswered && typeof ans === 'object' && !Array.isArray(ans)) {
            if (ans.status === '' || ans.status === undefined) isAnswered = false;
          }

          const isTrackingAnswered = answers[`${q.id}_tracking`] !== undefined && answers[`${q.id}_tracking`] !== '';
          const isChassisFilled = (q.type === 'chassisNumber' || q.text?.toLowerCase().includes('chassis number')) && selectedChassis;
          
          if (!isAnswered && !isTrackingAnswered && !isChassisFilled) {
             missing.push(q.text || q.label || 'Unknown Question');
          }
        }
      });
    }

    if (missing.length > 0) {
      Alert.alert(
        "Required Fields Missing",
        "Please complete all required fields in this section before proceeding:\n\n• " + missing.join("\n• "),
        [{ text: 'OK' }]
      );
      return;
    }

    if (!isLast && currentSectionIndex < mainSections.length - 1) {
      setCurrentSectionIndex(i => i + 1);
      // Scroll to top of the new section
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 50);
    }
  };

  const handlePrev = () => {
    if (!isFirst) setCurrentSectionIndex(i => i - 1);
  };

  const uploadImage = async (uri: string, attempt = 1): Promise<string> => {
    const MAX_RETRIES = 3;
    try {
      const uploadUrl = `${BASE_URL}files/upload`;
      
      console.log(`[UPLOAD] Attempt ${attempt}/${MAX_RETRIES} for: ${uri}`);
      
      // Check if file exists first
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        console.error(`[UPLOAD] File does not exist: ${uri}`);
        throw new Error('FILE_NOT_FOUND');
      }

      // Compress image before upload
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1080 } }], // Slightly smaller for better reliability
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      const targetUri = manipulatedImage.uri;
      console.log(`[UPLOAD] Starting FileSystem upload: ${targetUri}`);

      const uploadResult = await FileSystem.uploadAsync(uploadUrl, targetUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'X-App-Type': 'mobile-app'
        },
      });

      const responseData = JSON.parse(uploadResult.body);

      if (uploadResult.status === 200 || uploadResult.status === 201) {
        if (responseData.success) {
          console.log(`[UPLOAD] Successfully uploaded: ${uri}`);
          return responseData.data.url || responseData.data.filename || responseData.data.path || responseData.data.id;
        }
      }
      
      throw new Error(responseData.message || `Upload failed with status ${uploadResult.status}`);
    } catch (err: any) {
      if (err.message === 'FILE_NOT_FOUND') throw err;

      if (attempt < MAX_RETRIES) {
        const delay = attempt * 2000; // Exponential backoff: 2s, 4s...
        console.warn(`[UPLOAD] Attempt ${attempt} failed, retrying in ${delay}ms...`, err.message);
        await new Promise(r => setTimeout(r, delay));
        return uploadImage(uri, attempt + 1);
      }
      
      console.error('Final image upload error:', {
        message: err.message,
        uri
      });
      throw err;
    }
  };

  const handleSubmit = () => {
    // 1. Check for required questions across all sections
    const missingRequired: string[] = [];
    for (const section of mainSections) {
      const sectionQuestions = getOrderedVisibleQuestions(section.questions || [], answers);
      for (const q of sectionQuestions) {
        if (q.required) {
          const ans = answers[q.id];
          let isAnswered = ans !== undefined && ans !== null && ans !== '' && (!Array.isArray(ans) || ans.length > 0);
          
          // Enhanced check for object-based responses (Chassis/Zone types)
          if (isAnswered && typeof ans === 'object' && !Array.isArray(ans)) {
            if (ans.status === '' || ans.status === undefined) isAnswered = false;
          }

          const isTrackingAnswered = answers[`${q.id}_tracking`] !== undefined && answers[`${q.id}_tracking`] !== '';
          const isChassisFilled = (q.type === 'chassisNumber' || q.text?.toLowerCase().includes('chassis number')) && selectedChassis;
          
          if (!isAnswered && !isTrackingAnswered && !isChassisFilled) {
            missingRequired.push(q.text || q.label || 'Unknown Question');
          }
        }
      }
    }

    if (missingRequired.length > 0) {
      Alert.alert(
        "Required Questions Missing",
        "Please answer the following required questions before submitting:\n\n• " + missingRequired.join("\n• "),
        [{ text: 'OK' }]
      );
      return;
    }

    if (Object.keys(answers).length === 0) {
      Alert.alert("Warning", "You haven't answered any questions yet. Do you still want to submit?", [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit Anyway', onPress: executeSubmit }
      ]);
      return;
    }

    Alert.alert(
      'Submit Response',
      'Are you sure you want to submit this inspection report? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Submit',
          onPress: executeSubmit,
        },
      ]
    );
  };

  const executeSubmit = async () => {
    let processedAnswers = JSON.parse(JSON.stringify(answers));
    const uploadTasks: { qid: string, type: 'single' | 'photos' | 'defects' | 'zones', path?: string[], key?: string, subKey?: string, index?: number }[] = [];
    
    // Preparation of upload tasks... (same as before)
    Object.entries(processedAnswers).forEach(([qid, val]) => {
      if (typeof val === 'string' && val.startsWith('file://')) {
        uploadTasks.push({ qid, type: 'single', path: [val] });
      } else if (typeof val === 'object' && val !== null) {
        const v = val as any;
        if (Array.isArray(v.evidencePhotos)) {
           v.evidencePhotos.forEach((p: string, idx: number) => {
             if (p && p.startsWith('file://')) uploadTasks.push({ qid, type: 'photos', path: [p], index: idx });
           });
        }
        if (v.rejectedDefects) {
           for (const cat in v.rejectedDefects) {
             v.rejectedDefects[cat].forEach((def: any, idx: number) => {
               if (def.evidence && def.evidence.startsWith('file://')) {
                 uploadTasks.push({ qid, type: 'defects', key: cat, index: idx, path: [def.evidence] });
               }
             });
           }
        }
        if (v.evidenceUrl && v.evidenceUrl.startsWith('file://')) {
           uploadTasks.push({ qid, type: 'single', key: 'evidenceUrl', path: [v.evidenceUrl] });
        }
        if (v.zoneData) {
          for (const z in v.zoneData) {
            if (v.zoneData[z].defects) {
              for (const cat in v.zoneData[z].defects) {
                v.zoneData[z].defects[cat].forEach((def: any, idx: number) => {
                  if (def.evidence && def.evidence.startsWith('file://')) {
                    uploadTasks.push({ qid, type: 'zones', key: z, subKey: cat, index: idx, path: [def.evidence] });
                  }
                });
              }
            }
          }
        }
      }
    });

    const payload = {
      answers: processedAnswers,
      location: null,
      startedAt: startTime.toISOString(),
      completedAt: new Date().toISOString(),
      submittedBy: user?.name || ((user as any)?.firstName ? `${(user as any).firstName} ${(user as any).lastName || ''}` : 'Mobile Inspector'),
      submitterContact: {
        email: user?.email,
        phone: user?.phone || user?.mobile
      },
      metadata: {
        submittedVia: 'mobile-app',
        platform: Platform.OS,
        timestamp: new Date().toISOString()
      },
      chassisNumber: selectedChassis || chassisNumber
    };

    try {
      setSubmitting(true);
      setSubmittingProgress('Initializing...');

      // Check internet first
      const netState = await NetInfo.fetch();

      if (!netState.isConnected) {
        setSubmittingProgress('Offline. Saving to queue...');
        await offlineQueue.addToQueue(id, payload);
        setWasQueued(true);
        setSubmitting(false);
        setSubmitted(true);
        return;
      }
      
      // 1. Process and upload any local images
      if (uploadTasks.length > 0) {
        setUploadProgress({ current: 0, total: uploadTasks.length });
        
        // Concurrency control: batch images to avoid overwhelming the network
        const CONCURRENCY = 1; // Sequential for maximum reliability on mobile networks
        for (let i = 0; i < uploadTasks.length; i++) {
          const task = uploadTasks[i];
          setSubmittingProgress(`Uploading image ${i + 1} of ${uploadTasks.length}...`);
          
          try {
            // Upload with internal retries already handled in uploadImage
            const uploadedUrl = await uploadImage(task.path![0]);
            
            // Apply the URL back to the processedAnswers structure
            if (task.type === 'single') {
              if (task.key) processedAnswers[task.qid][task.key] = uploadedUrl;
              else processedAnswers[task.qid] = uploadedUrl;
            } else if (task.type === 'photos') {
              processedAnswers[task.qid].evidencePhotos[task.index!] = uploadedUrl;
            } else if (task.type === 'defects') {
              processedAnswers[task.qid].rejectedDefects[task.key!][task.index!].evidence = uploadedUrl;
            } else if (task.type === 'zones') {
              processedAnswers[task.qid].zoneData[task.key!].defects[task.subKey!][task.index!].evidence = uploadedUrl;
            }
            
            setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
          } catch (uploadErr: any) {
            console.error('Final upload failure after retries:', task.path![0], uploadErr);
            
            // Strictly follow user requirement: Only queue if internet is OFF
            // If we get here, we are "online" but the upload failed.
            // We should show an error instead of silent queuing.
            const errorMsg = uploadErr.response?.data?.message || uploadErr.message || 'Network timeout or server error';
            Alert.alert(
              'Upload Failed',
              `Could not upload image: ${task.path![0].split('/').pop()}\n\nError: ${errorMsg}\n\nSince you are online, please check your connection or try again.`,
              [{ text: 'OK' }]
            );
            throw new Error('UPLOAD_FAILED');
          }

          // Small pause between uploads
          await new Promise(r => setTimeout(r, 300));
        }
      }
      setUploadProgress({ current: 0, total: 0 });

      setSubmittingProgress('Sending report...');
      const response = await apiClient.post(`/responses/${id}`, payload);

      if (response.data.success) {
        setSubmitted(true);
      } else {
        throw new Error(response.data.message || 'Server rejected submission');
      }
    } catch (err: any) {
      if (err.message === 'UPLOAD_FAILED') return;
      console.error('Submission error:', err);
      
      // We already checked isOnline at the start. 
      // If it fails here, and we aren't explicitly offline, show error.
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        await offlineQueue.addToQueue(id, payload);
        setWasQueued(true);
        setSubmitted(true);
      } else {
        const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
        Alert.alert('Submission Error', `The submission could not be completed. \n\nDetails: ${errorMessage}\n\nPlease try again.`, [{ text: 'OK' }]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const loadSampleAnswers = () => {
    const sample: Record<string, any> = {};
    mainSections.forEach((sec: any) => {
      sec.questions?.forEach((q: any) => {
        if (q.type === 'rating' || q.type === 'scale') sample[q.id] = String(Math.floor(Math.random() * (q.max || 5)) + (q.min || 1));
        if (q.type === 'yesnona') sample[q.id] = 'Yes';
        if (q.type === 'text' || q.type === 'paragraph') sample[q.id] = 'Sample text response';
      });
    });
    setAnswers(prev => ({ ...prev, ...sample }));
    Alert.alert('Success', 'Sample answers loaded successfully.');
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
            <View style={styles.titleGroup}>
              <Text style={styles.formTitle} numberOfLines={1}>{title || 'Form Preview'}</Text>
            </View>
          </View>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Fetching form structure...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
            <View style={styles.titleGroup}>
              <Text style={styles.formTitle} numberOfLines={1}>{title || 'Form Preview'}</Text>
            </View>
          </View>
        </View>
        <View style={styles.centered}>
          <AlertCircle size={48} color="#ef4444" />
          <Text style={[styles.errorText, { marginTop: 16 }]}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchForm}>
            <Text style={styles.retryBtnText}>Retry Fetch</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleStartNew = () => {
    setAnswers({});
    setCurrentSectionIndex(0);
    setSubmitted(false);
    setSelectedChassis('');
    setTrackingValues({});
    setWasQueued(false);
    setSubmittingProgress('');
    setUploadProgress({ current: 0, total: 0 });
    // Scroll to top
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, 100);
  };

  // Submitted state
  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centered}>
          <View style={styles.successIconContainer}>
            <CheckCircle size={80} color="#10b981" />
          </View>
          <Text style={styles.successTitle}>Inspection Complete!</Text>
          <Text style={styles.successSubtitle}>
            {wasQueued 
              ? `Your report for chassis ${selectedChassis || chassisNumber || 'N/A'} is saved safely on your device and will sync automatically when your connection is better.`
              : `Your report for chassis ${selectedChassis || chassisNumber || 'N/A'} has been securely submitted and synced with the dashboard.`
            }
          </Text>
          
          <TouchableOpacity 
            style={styles.viewDetailsBtn} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.viewDetailsBtnText}>BACK TO DASHBOARD</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.historyBtn} 
            onPress={handleStartNew}
          >
            <Text style={styles.historyBtnText}>START NEW INSPECTION</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isSectionValid = () => {
    if (!currentSection) return true;
    return currentSection.questions.every((q: any) => {
      if (!q.required) return true;
      const ans = answers[q.id];
      const isAnswered = ans !== undefined && ans !== null && ans !== '' && (!Array.isArray(ans) || ans.length > 0);
      const isTrackingAnswered = answers[`${q.id}_tracking`] !== undefined && answers[`${q.id}_tracking`] !== '';
      const isChassisFilled = (q.type === 'chassisNumber' || q.text?.toLowerCase().includes('chassis number')) && selectedChassis;
      return isAnswered || isTrackingAnswered || isChassisFilled;
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <X size={24} color="#64748b" />
          </TouchableOpacity>
          <View style={styles.titleGroup}>
            <Text style={styles.formTitle} numberOfLines={1}>{form?.title || title || 'Form Preview'}</Text>
            <View style={[styles.previewBadge, readOnly && { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}>
              <Text style={[styles.previewBadgeText, readOnly && { color: '#64748b' }]}>{readOnly ? 'VIEW ONLY' : 'PREVIEW MODE'}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.progressText}>
              {mainSections.length > 0 ? Math.round(((currentSectionIndex + 1) / mainSections.length) * 100) : 0}%
            </Text>
            <Text style={styles.pageCount}>
              {currentSectionIndex + 1}/{mainSections.length || 1}
            </Text>
          </View>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${mainSections.length > 0 ? ((currentSectionIndex + 1) / mainSections.length) * 100 : 0}%` }]} />
        </View>
      </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
         <ScrollView 
           ref={scrollViewRef}
           style={styles.content} 
           contentContainerStyle={styles.contentInner}
           showsVerticalScrollIndicator={false}
           keyboardShouldPersistTaps="handled"
         >
            {/* Chassis Selection - Web Parity */}
            {!readOnly && availableChassis.length > 0 && currentSectionIndex === 0 && (
              <View style={styles.chassisSelectionContainer}>
          <View style={styles.chassisHeader}>
            <View style={styles.chassisIconBox}>
              <View style={styles.innerIconBox}>
                <ClipboardCheck size={18} color="#4f46e5" />
              </View>
            </View>
            <View>
              <Text style={styles.chassisMainTitle}>Select Chassis Number *</Text>
              <Text style={styles.chassisSubTitle}>Please identify the vehicle you are inspecting</Text>
            </View>
          </View>

                <View style={styles.chassisGrid}>
                  {availableChassis.map((item, idx) => {
                    const isSelected = selectedChassis === item.chassisNumber;
                    return (
                      <TouchableOpacity 
                        key={idx} 
                        style={[styles.chassisCard, isSelected && styles.chassisCardSelected]}
                        onPress={() => setSelectedChassis(item.chassisNumber)}
                      >
                         <View style={styles.chassisCardTop}>
                            <Text style={[styles.chassisCardId, isSelected && styles.chassisCardIdSelected]}>
                              {item.chassisNumber}
                            </Text>
                            <View style={[styles.statusIndicator, { backgroundColor: isSelected ? '#fff' : '#10b981' }]} />
                         </View>
                         <Text style={[styles.chassisCardDesc, isSelected && styles.chassisCardDescSelected]}>
                           {item.partDescription || 'Standard Chassis Unit'}
                         </Text>
                         <Text style={[styles.chassisStatus, isSelected && styles.chassisStatusSelected]}>
                           {isSelected ? 'SELECTED' : 'AVAILABLE'}
                         </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Historical Records Selector (Web Parity) */}
            {!readOnly && historicalRecords.length > 0 && currentSectionIndex === 0 && (
              <View style={styles.historicalSelectorContainer}>
                <View style={styles.historicalSelectorHeader}>
                  <View style={styles.sparklesIconBox}>
                    <Sparkles size={16} color="#10b981" />
                  </View>
                  <Text style={styles.historicalSelectorTitle}>HISTORICAL RECORDS</Text>
                </View>
                <Text style={styles.historicalSelectorSub}>
                  {historicalRecords.length} previous reports found for this chassis. Switching records will update the historical data shown below each question.
                </Text>
                <View style={styles.rankList}>
                  {historicalRecords.map((rec) => {
                    const isActive = selectedRank === rec.rank;
                    return (
                      <TouchableOpacity
                        key={rec.rank}
                        style={[styles.rankButton, isActive && styles.rankButtonActive]}
                        onPress={() => setSelectedRank(rec.rank)}
                      >
                        <Text style={[styles.rankButtonText, isActive && styles.rankButtonTextActive]}>#{rec.rank}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
           {/* Response Summary (Web Parity) */}
           {readOnly && (
             <View style={styles.responseSummaryCard}>
               <View style={styles.summaryHeader}>
                 <View style={styles.summaryIconBox}>
                   <ClipboardCheck size={20} color="#4f46e5" />
                 </View>
                 <View style={{ flex: 1 }}>
                   <Text style={styles.summaryHeaderTitle}>RESPONSE SUMMARY</Text>
                   <Text style={styles.summaryHeaderSub}>Submission Metadata</Text>
                 </View>

                 {/* Dispatch Action (Submitter Only) */}
                 {(() => {
                    const s = String(status || '').toLowerCase();
                    const canShowDispatch = s.includes('accepted') || s.includes('verified') || s.includes('ok') || s.includes('direct');
                    const userEmail = user?.email || '';
                    const isSubmitter = initialSubmittedBy === userEmail || initialSubmitterContact?.email === userEmail || (user?.name && initialSubmittedBy === user.name);

                    if (canShowDispatch && isSubmitter) {
                      return (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {/* Chat Button */}
                          <TouchableOpacity 
                            style={[styles.dispatchToggle, { borderColor: '#4f46e5' }]}
                            onPress={() => navigation.navigate('ResponseFeedback', { 
                              response: { 
                                id: responseId, 
                                _id: responseId,
                                answers: initialAnswers,
                                chassisNumber,
                                shift,
                                status,
                                submittedBy: initialSubmittedBy,
                                submitterContact: initialSubmitterContact
                              }, 
                              formTitle: title,
                              sections: form?.sections 
                            })}
                          >
                            <MessageSquareText size={10} color="#4f46e5" />
                            <Text style={[styles.dispatchToggleText, { color: '#4f46e5' }]}>CHAT</Text>
                          </TouchableOpacity>

                          {/* Dispatch Toggle */}
                          <TouchableOpacity 
                            style={[styles.dispatchToggle, isDispatched && styles.dispatchToggleActive]}
                            onPress={handleDispatchToggle}
                            disabled={dispatching}
                          >
                            {dispatching ? (
                              <ActivityIndicator size="small" color={isDispatched ? "#fff" : "#10b981"} />
                            ) : (
                              <>
                                <View style={[styles.miniCheckbox, isDispatched && styles.miniCheckboxChecked]}>
                                  {isDispatched && <CheckCircle size={10} color="#fff" />}
                                </View>
                                <Text style={[styles.dispatchToggleText, isDispatched && styles.dispatchToggleTextActive]}>
                                  {isDispatched ? 'DISPATCHED' : 'DISPATCH'}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    }
                    return null;
                 })()}
               </View>
               <View style={styles.summaryGrid}>
                 <View style={styles.summaryItem}>
                   <Text style={styles.summaryLabel}>CHASSIS NUMBER</Text>
                   <Text style={styles.summaryValue}>{chassisNumber || 'N/A'}</Text>
                 </View>
                 <View style={styles.summaryDivider} />
                 <View style={styles.summaryItem}>
                   <Text style={styles.summaryLabel}>SHIFT</Text>
                   <Text style={styles.summaryValue}>{shift || 'N/A'}</Text>
                 </View>
                 <View style={styles.summaryDivider} />
                 <View style={styles.summaryItem}>
                   <Text style={styles.summaryLabel}>STATUS</Text>
                   <View style={[
                     styles.summaryStatusBadge,
                     { backgroundColor: String(status).toLowerCase().includes('accepted') ? '#ecfdf5' : String(status).toLowerCase().includes('rejected') ? '#fef2f2' : '#fff7ed' }
                   ]}>
                      <Text style={[
                        styles.summaryStatusText,
                        { color: String(status).toLowerCase().includes('accepted') ? '#059669' : String(status).toLowerCase().includes('rejected') ? '#ef4444' : '#d97706' }
                      ]}>
                        {(status || 'PENDING').toString().toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
 
            {/* Phase Badge */}
            <View style={styles.phaseContainer}>
              <View style={styles.phaseIcon}>
                <Text style={styles.phaseIconText}>{currentSectionIndex + 1}</Text>
              </View>
              <View>
                <Text style={styles.phaseLabel}>
                  {effectiveViewType === "question-wise" && currentSection?.isVirtual
                    ? `SECTION ${currentSection.originalSectionIndex + 1}`
                    : "CURRENT PHASE"}
                </Text>
                <Text style={styles.phaseCount}>
                  {effectiveViewType === "question-wise" && currentSection?.isVirtual ? (
                    `Question ${currentSection.questionIndex + 1} of ${currentSection.totalQuestionsInSection}`
                  ) : (
                    `0${currentSectionIndex + 1} of 0${mainSections.length || 1}`
                  )}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>{currentSection?.title || `Section ${currentSectionIndex + 1}`}</Text>
            {currentSection?.description && (
              <Text style={styles.sectionDesc}>{currentSection.description}</Text>
            )}
 
            <View style={styles.questionsList}>
              {(() => {
                const renderQuestion = (question: any) => (
                  <View key={question.id} style={styles.questionCard}>
                    <View style={styles.questionHeaderRow}>
                      <Text style={styles.questionText}>
                        {question.text || question.label || "Untitled Question"}
                        {question.required && <Text style={styles.requiredAsterisk}> *</Text>}
                      </Text>
                      {question.subParam1 && (
                        <View style={styles.subParamBadge}>
                          <Text style={styles.subParamText}>{question.subParam1.toUpperCase()}</Text>
                        </View>
                      )}
                    </View>

                    <QuestionRenderer
                      question={question}
                      value={answers[question.id] || ( (question.type === 'chassisNumber' || question.text?.toLowerCase().includes('chassis number')) ? selectedChassis : undefined )}
                      onChange={(val: any) => handleAnswer(question.id, val)}
                      readOnly={readOnly}
                      formId={id}
                      trackingValue={trackingValues[question.id] || ( (question.trackResponseRank === true && question.text?.toLowerCase().includes('chassis number')) ? selectedChassis : answers[`${question.id}_tracking`] || '' )}
                      onTrackingChange={(tv: string) => handleTrackingAnswer(question.id, tv)}
                      hideLabel={true}
                      historicalValue={historicalRecords.find(r => r.rank === selectedRank)?.answers?.[question.id]}
                      selectedRank={selectedRank}
                      totalHistorical={historicalRecords.length}
                      historicalStatus={historicalRecords.find(r => r.rank === selectedRank)?.status}
                      historicalReview={historicalRecords.find(r => r.rank === selectedRank)?.review}
                      historicalSubmittedBy={historicalRecords.find(r => r.rank === selectedRank)?.submittedBy}
                      historicalChassis={historicalRecords.find(r => r.rank === selectedRank)?.answers?.[chassisQId] || selectedChassis}
                      onRankChange={(r) => setSelectedRank(r)}
                    />
                  </View>
                );

                return (
                  <>
                    {visibleQuestions.map(renderQuestion)}
                    {subsections.map((sub: any) => (
                      <View key={sub.id || sub._id} style={styles.subsectionContainer}>
                        <View style={styles.subsectionHeader}>
                          <Text style={styles.subsectionTitle}>{sub.title}</Text>
                          {sub.description && <Text style={styles.subsectionDesc}>{sub.description}</Text>}
                        </View>
                        {getVisibleQuestionsForSection(sub).map(renderQuestion)}
                      </View>
                    ))}
                  </>
                );
              })()}
            </View>
         </ScrollView>
       </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.backPortalBtn} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backPortalText}>BACK TO PORTAL</Text>
        </TouchableOpacity>

        {/* Location badge removed as per request */}
        <View style={{ flex: 1 }} />

        <TouchableOpacity 
          style={[
            styles.submitBtn, 
            (submitting || (isLast && readOnly)) && styles.submitBtnDisabled,
            (isLast && readOnly) && { backgroundColor: '#94a3b8' }
          ]}
          onPress={isLast ? (readOnly ? undefined : handleSubmit) : handleNext}
          disabled={submitting || (isLast && readOnly)}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              {isLast ? (
                readOnly ? <ClipboardCheck size={16} color="#fff" /> : <CheckCircle size={16} color="#fff" />
              ) : (
                <ChevronRight size={16} color="#fff" />
              )}
              <Text style={styles.submitBtnText}>
                {isLast ? (readOnly ? 'SUBMISSION DISABLED' : 'SUBMIT RESPONSE') : 'NEXT SECTION'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Submission Overlay for Smooth Experience */}
      {submitting && (
        <View style={styles.submissionOverlay}>
          <View style={styles.overlayContent}>
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text style={styles.overlayTitle}>{submittingProgress || 'Submitting Report...'}</Text>
            {uploadProgress.total > 0 && (
              <View style={styles.overlayProgressContainer}>
                <View style={[styles.overlayProgressBar, { width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }]} />
                <Text style={styles.overlayProgressText}>Step {uploadProgress.current} of {uploadProgress.total}</Text>
              </View>
            )}
            <Text style={styles.overlaySub}>
              {uploadProgress.total > 0 
                ? 'Uploading inspection evidence to secure cloud...' 
                : 'Finalizing and synchronizing your report with the dashboard...'}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcfcfd' },
  header: { 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderColor: '#f1f5f9' 
  },
  headerTop: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 14,
    gap: 12
  },
  backBtn: { padding: 4 },
  titleGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  formTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  previewBadge: { 
    backgroundColor: '#fffbeb', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4, 
    borderWidth: 1, 
    borderColor: '#fef3c7' 
  },
  previewBadgeText: { fontSize: 7, fontWeight: '900', color: '#d97706' },
  headerRight: { alignItems: 'flex-end' },
  progressText: { fontSize: 10, fontWeight: '900', color: '#3b82f6' },
  pageCount: { fontSize: 10, fontWeight: '600', color: '#94a3b8' },
  progressBarContainer: { height: 2, backgroundColor: '#f1f5f9', width: '100%' },
  progressBar: { height: '100%', backgroundColor: '#3b82f6' },

  content: { flex: 1 },
  contentInner: { padding: 20, paddingBottom: 40 },
  
  phaseContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  phaseIcon: { 
    width: 32, 
    height: 32, 
    borderRadius: 8, 
    backgroundColor: '#2563eb', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  phaseIconText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  phaseLabel: { fontSize: 8, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5 },
  phaseCount: { fontSize: 10, fontWeight: '800', color: '#2563eb' },

  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: '#64748b', marginBottom: 32 },
  
  questionsList: { gap: 24 },
  questionCard: { gap: 8, marginBottom: 24 },
  questionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12
  },
  questionText: { fontSize: 14, fontWeight: '800', color: '#334155', flex: 1 },
  requiredAsterisk: {
    color: '#ef4444',
    fontWeight: '900',
    fontSize: 16,
  },
  questionDescription: {
    fontSize: 12,
    color: '#64748b',
    marginTop: -4,
    lineHeight: 18,
  },
  subParamBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  subParamText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1e40af',
  },
  referenceImageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  referenceImage: {
    width: '100%',
    height: '100%',
  },

  footer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: '#fff', 
    borderTopWidth: 1, 
    borderColor: '#f1f5f9',
    gap: 10
  },
  backPortalBtn: { 
    backgroundColor: '#f1f5f9', 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderRadius: 8 
  },
  backPortalText: { fontSize: 9, fontWeight: '800', color: '#64748b' },
  locationBadge: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: '#f0fdf4', 
    paddingHorizontal: 8, 
    paddingVertical: 8, 
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dcfce7'
  },
  locationText: { fontSize: 8, fontWeight: '700', color: '#166534' },
  submitBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#059669', 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderRadius: 8, 
    gap: 6 
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
  errorText: { color: '#ef4444', textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#1e3a8a', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  successTitle: { 
    fontSize: 28, 
    fontWeight: '800', 
    color: '#1e293b', 
    marginTop: 24, 
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' // Serif for premium feel
  },
  successSubtitle: { 
    fontSize: 15, 
    color: '#64748b', 
    textAlign: 'center', 
    marginBottom: 40, 
    paddingHorizontal: 20, 
    lineHeight: 22,
    fontStyle: 'italic'
  },
  successIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  viewDetailsBtn: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewDetailsBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  historyBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif'
  },
  
  // Response Summary Styles
  responseSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  summaryIconBox: {
    width: 40,
    height: 40,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryHeaderTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1e293b',
    letterSpacing: 1,
  },
  summaryHeaderSub: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#f1f5f9',
  },
  summaryLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  summaryStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  summaryStatusText: {
    fontSize: 9,
    fontWeight: '900',
  },
  dispatchToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  dispatchToggleActive: {
    backgroundColor: '#10b981',
  },
  miniCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCheckboxChecked: {
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  dispatchToggleText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#10b981',
    letterSpacing: 0.5,
  },
  dispatchToggleTextActive: {
    color: '#fff',
  },
  // Submission Overlay
  submissionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayContent: {
    alignItems: 'center',
    padding: 30,
  },
  overlayTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 20,
    marginBottom: 8,
  },
  overlaySub: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  overlayProgressContainer: {
    width: 240,
    height: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    marginVertical: 16,
    overflow: 'visible',
  },
  overlayProgressBar: {
    height: '100%',
    backgroundColor: '#4f46e5',
    borderRadius: 2,
  },
  overlayProgressText: {
    position: 'absolute',
    top: 8,
    width: '100%',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
  },
  chassisSelectionContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  chassisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  chassisIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chassisMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  chassisSubTitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  chassisGrid: {
    gap: 12,
  },
  chassisCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    position: 'relative',
    overflow: 'hidden',
  },
  chassisCardSelected: {
    backgroundColor: '#f5f7ff',
    borderColor: '#4f46e5',
    borderWidth: 1.5,
  },
  chassisCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chassisCardId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  chassisCardIdSelected: {
    color: '#4f46e5',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chassisCardDesc: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
    fontWeight: '500',
  },
  chassisCardDescSelected: {
    color: '#6366f1',
  },
  chassisStatus: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 1,
  },
  chassisStatusSelected: {
    color: '#4f46e5',
  },
  subsectionContainer: {
    marginTop: 24,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
  },
  subsectionHeader: {
    padding: 16,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  subsectionDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  // Historical Selector Styles
  historicalSelectorContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historicalSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sparklesIconBox: {
    backgroundColor: '#ecfdf5',
    padding: 6,
    borderRadius: 8,
  },
  historicalSelectorTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#065f46',
    letterSpacing: 1,
  },
  historicalSelectorSub: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 16,
  },
  rankList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  rankButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankButtonActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  rankButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748b',
  },
  rankButtonTextActive: {
    color: '#fff',
  },
});

export default FormPreviewScreen;
