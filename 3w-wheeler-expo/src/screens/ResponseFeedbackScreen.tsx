import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
  Alert,
  Image as RNImage,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ChevronLeft,
  ChevronRight,
  Camera,
  Image as ImageIcon,
  Plus,
  MessageSquareText,
  X,
  Check
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';

import { io } from 'socket.io-client';
import apiClient, { BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = BASE_URL.replace('/api', '');

const ResponseFeedbackScreen = ({ route, navigation }: any) => {
  const { response, formTitle, sections } = route.params || {};
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [suggestedAnswers, setSuggestedAnswers] = useState<{[key: string]: string}>({});
  const [questionImages, setQuestionImages] = useState<{[key: string]: string}>({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [isZoomVisible, setIsZoomVisible] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [performanceScore, setPerformanceScore] = useState<number | null>(null);
  const cameraRef = useRef<any>(null);
  
  const allQuestions = sections?.flatMap((s: any) => s.questions || []) || [];
  
  const scrollViewRef = useRef<ScrollView>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    fetchMessages();
    fetchReviews();
    fetchPerformanceScore();
    
    // Socket real-time initialization
    const responseId = response.id || response._id;
    socketRef.current = io(SOCKET_URL);
    
    // Join a room specific to this response thread
    socketRef.current.emit('join-chat', responseId);
    
    socketRef.current.on('receive-message', (data: any) => {
      // If message belongs to this response, append it
      const msgResId = (typeof data.responseId === 'object') ? data.responseId._id : data.responseId;
      if (msgResId === responseId) {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.find(m => m._id === data._id)) return prev;
          return [...prev, data];
        });
        // Auto-scroll
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    // Still keep polling as a robust fallback
    const interval = setInterval(fetchMessages, 10000);
    
    return () => {
      clearInterval(interval);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);


  const fetchMessages = async () => {
    try {
      const responseId = response.id || response._id;
      const resp = await apiClient.get(`/messages/response/${responseId}`);
      if (resp.data?.success) {
        setMessages(resp.data.data || []);
      }
    } catch (err: any) {
      if (err.response?.status !== 404) {
        console.error('Failed to fetch response chat:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const responseId = response.id || response._id;
      const resp = await apiClient.get(`/responses/reviews/${responseId}`);
      if (resp.data?.success) {
        setReviews(resp.data.reviews || []);
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    }
  };

  const fetchPerformanceScore = async () => {
    try {
      const resp = await apiClient.get('/users/performance-scores');
      if (resp.data?.success) {
        const submitterId = response.submittedBy || response.submitterContact?.email;
        if (submitterId && resp.data.data[submitterId] !== undefined) {
          setPerformanceScore(resp.data.data[submitterId]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch performance scores:', err);
    }
  };

  const handleReviewSubmit = async (option: string) => {
    if (sending) return;
    if (!user?._id && !user?.id) {
      Alert.alert('Error', 'User ID not found. Please log in again.');
      return;
    }
    
    // For Rework or Rejected, ensure there's context/message
    if ((option === 'Rework' || option === 'Rejected') && !message.trim() && selectedQuestions.length === 0) {
      Alert.alert('Incomplete', `Please provide some feedback message or flag questions for ${option}.`);
      return;
    }

    try {
      setSending(true);
      const responseId = response.id || response._id;
      
      const reviewData = {
        responseId,
        reviewerId: user?._id || user?.id,
        submitterId: response.submittedBy || response.submitterContact?.email || 'Unknown',
        reviewOption: option,
        tenantId: response.tenantId || user?.tenantId
      };

      await apiClient.post('/responses/reviews', reviewData);
      
      // If there's a message or flagged questions, send them as a chat message too
      if (message.trim() || selectedQuestions.length > 0) {
        await handleSend();
      }

      Alert.alert('Success', `Response marked as ${option}`);
      fetchReviews();
      fetchPerformanceScore();
    } catch (err: any) {
      console.error('Review submission error:', err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSending(false);
    }
  };

  const pickImage = async (qId: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'We need access to your photos to upload evidence.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setQuestionImages(prev => ({
        ...prev,
        [qId]: result.assets[0].uri
      }));
    }
  };

  const takePhoto = async (qId: string) => {
    if (!permission || !permission.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Needed', 'We need access to your camera to take photos.');
        return;
      }
    }
    setActiveQuestionId(qId);
    setCameraVisible(true);
  };

  const handleCapture = async () => {
    if (cameraRef.current && activeQuestionId) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        setQuestionImages(prev => ({
          ...prev,
          [activeQuestionId]: photo.uri
        }));
        setCameraVisible(false);
        setActiveQuestionId(null);
      } catch (err) {
        console.error('Capture error:', err);
        Alert.alert('Error', 'Failed to capture photo');
      }
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      setUploadingImage(true);
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'upload.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;

      formData.append('file', {
        uri,
        name: filename,
        type
      } as any);

      const resp = await apiClient.post('/files/upload', formData);

      if (resp.data?.success) {
        // Prefer the full URL from backend (Cloudinary)
        return resp.data.data.url || resp.data.data.file?._id || resp.data.data.filename;
      }
      throw new Error('Upload failed');
    } catch (err) {
      console.error('Image upload error:', err);
      throw err;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim() && selectedQuestions.length === 0) return;

    try {
      setSending(true);
      const responseId = response.id || response._id;
      const targetToEmail = response.inspectorEmail || response.inspectorId || response.inspector_id || 'group';
      
      if (!responseId) {
        throw new Error('Missing response identification');
      }

      // Upload images sequentially and build attachments/context
      const attachments: string[] = [];
      const questionContexts: any[] = [];
      const selectedQuestionTitles: string[] = [];

      for (const qid of selectedQuestions) {
        const q = allQuestions.find((q: any) => q.id === qid);
        const qTitle = q ? q.text : qid.replace(/_/g, ' ').toUpperCase();
        selectedQuestionTitles.push(qTitle);
        
        let imageUrl = '';
        if (questionImages[qid]) {
          try {
            const uploadedUrl = await uploadImage(questionImages[qid]);
            if (uploadedUrl) {
              imageUrl = uploadedUrl;
            }
          } catch (uploadErr) {
            console.error(`Failed to upload image for question ${qid}:`, uploadErr);
          }
        }

        questionContexts.push({
          questionId: qid,
          title: qTitle,
          answer: response.answers?.[qid] || '',
          suggestion: suggestedAnswers[qid] || '',
          imageUrl: imageUrl || null
        });
      }

      const resp = await apiClient.post('/messages/send', {
        toEmail: targetToEmail,
        message: message.trim() || `Feedback regarding ${selectedQuestions.length} points`,
        responseId: responseId,
        formId: response.formId || response.questionId,
        questionIds: selectedQuestions,
        questionTitles: selectedQuestionTitles,
        questionContexts: questionContexts,
        tenantId: response.tenantId,
        attachments: [] // Granular images are now inside questionContexts
      });

      if (resp.data?.success) {
        setMessage('');
        setSelectedQuestions([]);
        setSuggestedAnswers({});
        setQuestionImages({});
        fetchMessages();
      } else {
        throw new Error(resp.data?.message || 'Send failed');
      }
    } catch (err: any) {
      console.error('Send error:', err);
      Alert.alert('Error', err.message || 'Failed to send feedback');
    } finally {
      setSending(false);
    }
  };



  const toggleQuestion = (qKey: string) => {
    setSelectedQuestions(prev => 
      prev.includes(qKey) ? prev.filter(k => k !== qKey) : [...prev, qKey]
    );
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.from === user?._id || item.from?._id === user?._id;
    return (
      <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.theirMessageRow]}>
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
          {item.questionContexts && item.questionContexts.length > 0 ? (
            <View style={styles.questionContextsContainer}>
              {item.questionContexts.map((ctx: any, idx: number) => (
                <View key={idx} style={styles.questionContextBox}>
                  <Text style={[styles.questionContextTitle, isMe ? {color: 'rgba(255,255,255,0.8)'} : {}]}>{ctx.title}</Text>
                  <Text style={[styles.questionContextAnswer, isMe ? {color: '#fff'} : {}]}>
                    {(() => {
                      if (!ctx.answer) return 'No response';
                      if (typeof ctx.answer === 'string') return ctx.answer;
                      if (Array.isArray(ctx.answer)) return ctx.answer.join(', ');
                      if (typeof ctx.answer === 'object') {
                        return ctx.answer.status || ctx.answer.value || ctx.answer.text || JSON.stringify(ctx.answer);
                      }
                      return String(ctx.answer);
                    })()}
                  </Text>
                  {ctx.suggestion ? (
                    <View style={styles.suggestionBox}>
                      <Text style={styles.suggestionTitle}>SUGGESTED CHANGE:</Text>
                      <Text style={styles.suggestionText}>
                        {(() => {
                          if (typeof ctx.suggestion === 'string') return ctx.suggestion;
                          if (Array.isArray(ctx.suggestion)) return ctx.suggestion.join(', ');
                          if (typeof ctx.suggestion === 'object') {
                            return ctx.suggestion.status || ctx.suggestion.value || ctx.suggestion.text || JSON.stringify(ctx.suggestion);
                          }
                          return String(ctx.suggestion);
                        })()}
                      </Text>
                    </View>
                  ) : null}
                  {ctx.imageUrl ? (
                    <TouchableOpacity 
                      style={styles.contextImageContainer}
                      onPress={() => {
                        const fullUrl = ctx.imageUrl.startsWith('http') ? ctx.imageUrl : `${BASE_URL}/files/${ctx.imageUrl}`;
                        setZoomImage(fullUrl);
                        setIsZoomVisible(true);
                      }}
                    >
                      <RNImage 
                        source={{ uri: ctx.imageUrl.startsWith('http') ? ctx.imageUrl : `${BASE_URL}/files/${ctx.imageUrl}` }} 
                        style={styles.contextImage} 
                        resizeMode="cover" 
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>
          ) : item.questionTitles && item.questionTitles.length > 0 && (
            <View style={styles.linkedQuestionsBox}>
              <Text style={styles.linkedQuestionsTitle}>LINKED QUESTIONS</Text>
              <View style={styles.tagsContainer}>
                {item.questionTitles.map((t: string, i: number) => (
                  <View key={i} style={styles.questionTag}>
                    <Text style={styles.questionTagText}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {item.attachments && item.attachments.map((file: string, fidx: number) => {
            const imageUrl = file.startsWith('http') ? file : `${BASE_URL}/files/${file}`;
            return (
              <TouchableOpacity key={fidx} style={styles.attachmentContainer} onPress={() => {}}>
                <RNImage source={{ uri: imageUrl }} style={styles.attachmentImage} resizeMode="cover" />
              </TouchableOpacity>
            );
          })}
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
            {item.message}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isMe && { color: 'rgba(255,255,255,0.7)' }]}>
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.webHeader}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.webBackBtn}>
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.webHeaderInfo}>
            <View style={styles.webHeaderIconContainer}>
               <MessageSquareText size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.webHeaderTitle}>Question Filter: {response.inspectorName || response.submittedBy || 'Inspector'}</Text>
              <Text style={styles.webHeaderSub}>Chassis: {response.chassisNumber || 'N/A'}</Text>
            </View>
          </View>

          {/* Web Parity: Review Status Badge & Score */}
          {reviews.length > 0 && (
             <View style={styles.headerReviewStatus}>
                <View style={[
                  styles.headerStatusBadge,
                  { backgroundColor: reviews[0].option === 'Accepted' ? 'rgba(34, 197, 94, 0.2)' : reviews[0].option === 'Rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)' }
                ]}>
                  <Text style={styles.headerStatusText}>
                    {reviews[0].option === 'Accepted' ? '✅' : reviews[0].option === 'Rejected' ? '❌' : '🔄'} {reviews[0].option.toUpperCase()}
                  </Text>
                </View>
                {performanceScore !== null && (
                  <View style={styles.headerScoreBadge}>
                    <Text style={styles.headerScoreText}>Score: {performanceScore}%</Text>
                  </View>
                )}
             </View>
          )}

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.webCloseBtn}>
            <X size={24} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>

        {/* Web Parity: Admin Review Buttons */}
        {(() => {
          const isAdmin = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'subadmin';
          const isSubmitter = response.submittedBy === user?.email || response.submitterContact?.email === user?.email || response.submittedBy === user?.name;
          
          if (isAdmin && !isSubmitter && reviews.length === 0) {
            return (
              <View style={styles.reviewButtonsRow}>
                {['Accepted', 'Rejected', 'Rework'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    onPress={() => handleReviewSubmit(option)}
                    disabled={sending}
                    style={[
                      styles.reviewBtn,
                      option === 'Accepted' ? styles.reviewBtnAccept : option === 'Rejected' ? styles.reviewBtnReject : styles.reviewBtnRework
                    ]}
                  >
                    <Text style={styles.reviewBtnText}>
                      {option === 'Accepted' ? '✅' : option === 'Rejected' ? '❌' : '🔄'} {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          }
          return null;
        })()}
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.webContent}
          showsVerticalScrollIndicator={false}
          ref={scrollViewRef}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.webLayoutRow}>
             <View style={styles.webLeftCol}>
                <Text style={styles.webChassisDisplay}>Chassis Number : {response.chassisNumber || 'N/A'}</Text>
                
                <View style={styles.webFilterSection}>
                   <Text style={styles.webFilterLabel}>Select Questions</Text>
                   <View style={styles.webQuestionsCard}>
                      {allQuestions.length > 0 ? (
                        allQuestions.map((q: any, index: number) => {
                          const isSelected = selectedQuestions.includes(q.id);
                          return (
                            <View key={q.id}>
                              <TouchableOpacity 
                                style={[styles.webQItem, index === 0 && { borderTopWidth: 0 }]}
                                onPress={() => toggleQuestion(q.id)}
                              >
                                <View style={[styles.webCheckbox, isSelected && styles.webCheckboxChecked]}>
                                  {isSelected && <Check size={10} color="#fff" strokeWidth={3} />}
                                </View>
                                <Text style={styles.webQText}>{q.text || 'Question'}</Text>
                              </TouchableOpacity>
                              
                              {isSelected && (
                                <View style={styles.suggestionImageSection}>
                                  <View style={styles.suggestionInputContainer}>
                                    <TextInput
                                      style={styles.suggestionInput}
                                      placeholder={`Suggest answer...`}
                                      placeholderTextColor="#94a3b8"
                                      value={suggestedAnswers[q.id] || ''}
                                      onChangeText={(text) => setSuggestedAnswers(prev => ({ ...prev, [q.id]: text }))}
                                    />
                                  </View>
                                  
                                  <View style={styles.qActionRow}>
                                    <TouchableOpacity 
                                      style={[styles.qActionBtn, questionImages[q.id] && styles.qActionBtnActive]} 
                                      onPress={() => takePhoto(q.id)}
                                    >
                                      <Camera size={14} color={questionImages[q.id] ? "#fff" : "#4f46e5"} />
                                      <Text style={[styles.qActionText, questionImages[q.id] && {color: '#fff'}]}>
                                        {questionImages[q.id] ? 'Retake' : 'Camera'}
                                      </Text>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity 
                                      style={[styles.qActionBtn, questionImages[q.id] && styles.qActionBtnActive]} 
                                      onPress={() => pickImage(q.id)}
                                    >
                                      <ImageIcon size={14} color={questionImages[q.id] ? "#fff" : "#4f46e5"} />
                                      <Text style={[styles.qActionText, questionImages[q.id] && {color: '#fff'}]}>
                                        {questionImages[q.id] ? 'Change' : 'Gallery'}
                                      </Text>
                                    </TouchableOpacity>

                                    {questionImages[q.id] && (
                                      <TouchableOpacity 
                                        style={styles.qActionBtnDelete} 
                                        onPress={() => setQuestionImages(prev => {
                                          const next = {...prev};
                                          delete next[q.id];
                                          return next;
                                        })}
                                      >
                                        <X size={14} color="#ef4444" />
                                      </TouchableOpacity>
                                    )}
                                  </View>

                                  {questionImages[q.id] && (
                                    <View style={styles.qImagePreviewContainer}>
                                      <RNImage source={{ uri: questionImages[q.id] }} style={styles.qImagePreview} />
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })
                      ) : (
                        Object.entries(response.answers || {}).map(([key, val]: any, index) => {
                          if (key.includes('_') || typeof val !== 'string' || val.length > 50) return null;
                          const isSelected = selectedQuestions.includes(key);
                          return (
                            <View key={key}>
                              <TouchableOpacity 
                                style={[styles.webQItem, index === 0 && { borderTopWidth: 0 }]}
                                onPress={() => toggleQuestion(key)}
                              >
                                <View style={[styles.webCheckbox, isSelected && styles.webCheckboxChecked]}>
                                  {isSelected && <Check size={10} color="#fff" strokeWidth={3} />}
                                </View>
                                <Text style={styles.webQText}>{key.replace(/_/g, ' ').toUpperCase()}</Text>
                              </TouchableOpacity>

                              {isSelected && (
                                <View style={styles.suggestionImageSection}>
                                  <View style={styles.qActionRow}>
                                    <TouchableOpacity 
                                      style={[styles.qActionBtn, questionImages[key] && styles.qActionBtnActive]} 
                                      onPress={() => takePhoto(key)}
                                    >
                                      <Camera size={14} color={questionImages[key] ? "#fff" : "#4f46e5"} />
                                      <Text style={[styles.qActionText, questionImages[key] && {color: '#fff'}]}>
                                        {questionImages[key] ? 'Retake' : 'Camera'}
                                      </Text>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity 
                                      style={[styles.qActionBtn, questionImages[key] && styles.qActionBtnActive]} 
                                      onPress={() => pickImage(key)}
                                    >
                                      <ImageIcon size={14} color={questionImages[key] ? "#fff" : "#4f46e5"} />
                                      <Text style={[styles.qActionText, questionImages[key] && {color: '#fff'}]}>
                                        {questionImages[key] ? 'Change' : 'Gallery'}
                                      </Text>
                                    </TouchableOpacity>
                                  </View>

                                  {questionImages[key] && (
                                    <View style={styles.qImagePreviewContainer}>
                                      <RNImage source={{ uri: questionImages[key] }} style={styles.qImagePreview} />
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })
                      )}
                   </View>
                   <View style={styles.webFilterFooter}>
                      <TouchableOpacity onPress={() => setSelectedQuestions([])}>
                        <Text style={styles.webClearBtn}>Clear All Filters</Text>
                      </TouchableOpacity>
                   </View>
                </View>
             </View>

             <View style={styles.webRightCol}>
                <View style={styles.webChatHeader}>
                   <Text style={styles.webChatTitle}>MESSAGE CENTER</Text>
                   <View style={styles.webLiveBadge}>
                      <View style={styles.webLiveDot} />
                      <Text style={styles.webLiveText}>Live Context</Text>
                   </View>
                </View>

                <View style={styles.webChatBox}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#4f46e5" style={{ marginVertical: 40 }} />
                  ) : messages.length === 0 ? (
                    <View style={styles.webEmptyChat}>
                      <View style={styles.webEmptyIconBox}>
                        <MessageSquareText size={32} color="#94a3b8" />
                      </View>
                      <Text style={styles.webEmptyTitle}>No active conversation</Text>
                      <Text style={styles.webEmptySub}>Send a message to start the thread.</Text>
                    </View>
                  ) : (
                    <View style={styles.webMessagesList}>
                      {messages.map((msg, i) => (
                        <View key={i}>
                          {renderMessage({ item: msg })}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
             </View>
          </View>
        </ScrollView>

        <View style={styles.webInputArea}>
          <View style={styles.inputActionRow}>
            <TextInput
              style={styles.webTextareaCompact}
              placeholder="Type overall feedback/comments..."
              placeholderTextColor="#94a3b8"
              value={message}
              onChangeText={setMessage}
              multiline
            />
          </View>
          <TouchableOpacity 
            style={[styles.webSendBtn, (sending || uploadingImage) && { opacity: 0.7 }]} 
            onPress={handleSend}
            disabled={sending || uploadingImage || (!message.trim() && selectedQuestions.length === 0)}
          >
            {sending || uploadingImage ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.webSendBtnContent}>
                <Text style={styles.webSendBtnText}>Send Feedback</Text>
                <ChevronRight size={18} color="#fff" strokeWidth={3} />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.webFooterNote}>
            Message will be sent to <Text style={{ fontWeight: '800' }}>{response.inspectorName || 'the submitter'}</Text>
          </Text>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={cameraVisible} animationType="fade" transparent>
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraContainer}>
            <View style={styles.cameraHeader}>
              <Text style={styles.cameraTitle}>Capture Evidence</Text>
              <TouchableOpacity onPress={() => setCameraVisible(false)}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <CameraView 
              ref={cameraRef}
              style={styles.camera} 
              facing="back"
            />
            
            <View style={styles.cameraFooter}>
              <TouchableOpacity 
                style={styles.captureBtn} 
                onPress={handleCapture}
              >
                <View style={styles.captureBtnInner} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Zoom Modal */}
      <Modal visible={isZoomVisible} transparent animationType="fade">
        <View style={styles.zoomOverlay}>
          <TouchableOpacity 
            style={styles.zoomClose} 
            onPress={() => setIsZoomVisible(false)}
          >
            <X size={30} color="#fff" />
          </TouchableOpacity>
          {zoomImage && (
            <RNImage 
              source={{ uri: zoomImage }} 
              style={styles.zoomImage} 
              resizeMode="contain" 
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webHeader: {
    backgroundColor: '#4f46e5',
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  webBackBtn: {
    padding: 5,
  },
  webHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 15,
  },
  webHeaderIconContainer: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  webHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  webHeaderSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  webCloseBtn: {
    padding: 5,
    marginLeft: 10,
  },
  headerReviewStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 10,
  },
  headerStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerStatusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  headerScoreBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  headerScoreText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  reviewButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15,
    paddingHorizontal: 5,
  },
  reviewBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  reviewBtnAccept: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: '#22c55e',
  },
  reviewBtnReject: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },
  reviewBtnRework: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    borderColor: '#eab308',
  },
  reviewBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  webContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webLayoutRow: {
    padding: 20,
  },
  webLeftCol: {
    marginBottom: 25,
  },
  webChassisDisplay: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 20,
  },
  webFilterSection: {
    gap: 10,
  },
  webFilterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginLeft: 4,
  },
  webQuestionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  webQItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  webCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webCheckboxChecked: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  webQText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  webFilterFooter: {
    marginTop: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  webClearBtn: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4f46e5',
  },
  webRightCol: {
    flex: 1,
  },
  webChatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  webChatTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1.5,
  },
  webLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dcfce7',
    gap: 5,
  },
  webLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  webLiveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#166534',
  },
  webChatBox: {
    minHeight: 200,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 15,
  },
  webEmptyChat: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  webEmptyIconBox: {
    width: 60,
    height: 60,
    backgroundColor: '#f1f5f9',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    borderWidth: 8,
    borderColor: '#fff',
  },
  webEmptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
  },
  webEmptySub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  webMessagesList: {
    gap: 15,
  },
  messageRow: {
    flexDirection: 'row',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  theirMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  myBubble: {
    backgroundColor: '#4f46e5',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  linkedQuestionsBox: {
    marginBottom: 10,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 10,
  },
  linkedQuestionsTitle: {
    fontSize: 8,
    fontWeight: '900',
    color: 'rgba(0,0,0,0.4)',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  questionTag: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  questionTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4f46e5',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
    fontWeight: '500',
  },
  theirMessageText: {
    color: '#1e293b',
  },
  messageFooter: {
    marginTop: 6,
    alignItems: 'flex-end',
  },
  messageTime: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '600',
  },
  suggestionInputContainer: {
    padding: 10,
    paddingTop: 0,
    backgroundColor: '#fafaf9',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  suggestionInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: '#334155',
  },
  questionContextsContainer: {
    gap: 8,
    marginBottom: 8,
  },
  questionContextBox: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  questionContextTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 4,
  },
  questionContextAnswer: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  suggestionBox: {
    backgroundColor: '#fffbeb',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  suggestionTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#d97706',
    marginBottom: 2,
  },
  suggestionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  webInputArea: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  webTextarea: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    fontSize: 14,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  webSendBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  webSendBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  webSendBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  webFooterNote: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraContainer: {
    width: '90%',
    aspectRatio: 3/4,
    backgroundColor: '#000',
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cameraTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  camera: {
    flex: 1,
  },
  cameraFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  captureBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  },
  attachmentContainer: {
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  attachmentImage: {
    width: '100%',
    height: 200,
  },
  inputActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webTextareaCompact: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    textAlignVertical: 'top',
    maxHeight: 100,
  },
  previewContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginBottom: 12,
    position: 'relative',
    backgroundColor: '#f1f5f9',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionImageSection: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  qActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  qActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qActionBtnActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  qActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
  },
  qActionBtnDelete: {
    padding: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    marginLeft: 'auto',
  },
  qImagePreviewContainer: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  qImagePreview: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  contextImageContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  contextImage: {
    width: '100%',
    height: 150,
  },
  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomClose: {
    position: 'absolute',
    top: 50,
    right: 25,
    zIndex: 20,
    padding: 10,
  },
  zoomImage: {
    width: '100%',
    height: '80%',
  },
});


export default ResponseFeedbackScreen;
