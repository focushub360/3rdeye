import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator,
  Keyboard,
  Alert,
  Image as RNImage
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Send, ChevronLeft, UserCircle, Circle, AlertTriangle, MessageSquare, Users, X, Reply, Camera, Image as ImageIcon, Plus, Filter } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Modal } from 'react-native';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import apiClient, { BASE_URL } from '../api/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '../context/ThemeContext';

const SOCKET_URL = BASE_URL.replace('/api', '');

const ChatDetailScreen = () => {
  const { colors, isDark } = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { contactId, name, role, isGroup, tenantId, title, formTitle } = route.params;
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const socketRef = useRef<any>(null);
  const flatListRef = useRef<any>(null);

  const fetchMessages = async () => {
    const cacheKey = isGroup 
      ? `@cached_chat_messages_${tenantId || user?.tenantId}_group` 
      : `@cached_chat_messages_${contactId}`;

    try {
      let endpoint = '';
      if (isGroup) {
        endpoint = '/messages/tenant-messages';
      } else {
        endpoint = `/messages/response/${contactId}`;
      }
      
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          setMessages(JSON.parse(cached));
        }
        return;
      }
      
      const response = await apiClient.get(endpoint);
      if (response.data.success) {
        const messageData = response.data.data || [];
        setMessages(messageData);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(messageData));
      }
    } catch (error) {
      console.error('Fetch messages error:', error);
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          setMessages(JSON.parse(cached));
        }
      } catch (cacheErr) {}
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    const cacheKey = `@cached_group_members_${tenantId || user?.tenantId}`;
    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          setMembers(JSON.parse(cached));
        }
        return;
      }

      const response = await apiClient.get('/users?role=admin&role=superadmin&role=subadmin');
      if (response.data.success) {
        const membersData = response.data.data.users || [];
        setMembers(membersData);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(membersData));
      }
    } catch (error) {
      console.error('Fetch members error:', error);
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          setMembers(JSON.parse(cached));
        }
      } catch (cacheErr) {}
    }
  };

  useEffect(() => {
    if (isGroup) fetchMembers();
  }, [isGroup]);

  useEffect(() => {
    fetchMessages();

    socketRef.current = io(SOCKET_URL);

    // Join appropriate room
    if (isGroup) {
      socketRef.current.emit('join-group-chat', user?.tenantId || tenantId);
      console.log('💬 Joined group chat room:', user?.tenantId || tenantId);
    } else {
      socketRef.current.emit('join-chat', user?._id); 
      console.log('💬 Joined private chat room:', user?._id);
    }

    // Listen for new messages
    socketRef.current.on('receive-group-message', (data: any) => {
      console.log('📩 Received group message:', data);
      setMessages((prev) => {
        if (prev.some(m => m._id === data._id)) return prev;
        return [...prev, data];
      });
    });

    socketRef.current.on('receive-message', (data: any) => {
      console.log('📩 Received private message:', data);
      setMessages((prev) => {
        if (prev.some(m => m._id === data._id)) return prev;
        return [...prev, data];
      });
    });

    socketRef.current.on('user-typing', (data: any) => {
      if (data.senderId === contactId) setIsTyping(true);
    });

    socketRef.current.on('user-stop-typing', (data: any) => {
      if (data.senderId === contactId) setIsTyping(false);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [contactId, isGroup, tenantId]);

  const groupMessagesByDate = (msgs: any[]) => {
    const groups: any[] = [];
    let currentDate = '';

    msgs.forEach((msg) => {
      const date = new Date(msg.createdAt).toDateString();
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      
      let dateLabel = date;
      if (date === today) dateLabel = 'Today';
      else if (date === yesterday) dateLabel = 'Yesterday';

      if (dateLabel !== currentDate) {
        groups.push({ type: 'date', label: dateLabel });
        currentDate = dateLabel;
      }
      groups.push({ ...msg, type: 'message' });
    });
    return groups;
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'We need access to your photos to upload evidence.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'We need access to your camera to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
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
        return resp.data.data.filename || resp.data.data.path || resp.data.data.id;
      }
      throw new Error('Upload failed');
    } catch (err) {
      console.error('Image upload error:', err);
      throw err;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSend = async (isTYC = false) => {
    if ((!newMessage.trim() && !selectedImage) || !user) return;

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      Alert.alert('Offline Mode Active', 'You are offline. Sending messages requires an active internet connection.');
      return;
    }

    try {
      let attachmentUrl = null;
      if (selectedImage) {
        attachmentUrl = await uploadImage(selectedImage);
      }

      const messageData: any = {
        from: user._id,
        message: newMessage.trim() || (attachmentUrl ? "Sent an image." : ""),
        tenantId: user.tenantId,
        isTYC: isTYC,
        responseId: isGroup ? null : contactId,
        replyTo: replyTo?._id || null,
        attachments: attachmentUrl ? [attachmentUrl] : []
      };

      const res = await apiClient.post('/messages/send', {
        ...messageData,
        toEmail: isGroup ? 'group' : 'admin' 
      });

      if (res.data.success) {
        const savedMsg = res.data.data;
        if (isGroup) {
          socketRef.current.emit('send-group-message', savedMsg);
        } else {
          socketRef.current.emit('send-message', {
            ...savedMsg,
            receiverId: contactId 
          });
        }
        
        setMessages((prev) => [...prev, savedMsg]);
        setNewMessage('');
        setSelectedImage(null);
        setReplyTo(null);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
    Keyboard.dismiss();
  };

  const getSenderColor = (name: string) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const renderItem = ({ item }: any) => {
    if (item.type === 'date') {
      return (
        <View style={styles.dateHeader}>
          <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dateLabel, { color: colors.subtext, backgroundColor: colors.surface }]}>{item.label}</Text>
          <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
        </View>
      );
    }

    const senderId = typeof item.senderId === 'object' ? item.senderId._id : item.senderId;
    const isMine = senderId === user?._id;
    const senderName = typeof item.senderId === 'object' ? `${item.senderId.firstName} ${item.senderId.lastName || ''}` : 'User';
    const senderRole = typeof item.senderId === 'object' ? item.senderId.role : '';

    return (
      <View style={[styles.messageRow, isMine ? styles.myRow : styles.theirRow]}>
        {!isMine && (
          <View style={styles.avatarMini}>
            <View style={[styles.avatarCircle, { backgroundColor: getSenderColor(senderName) + '20' }]}>
              <Text style={[styles.avatarLetter, { color: getSenderColor(senderName) }]}>{senderName[0]}</Text>
            </View>
          </View>
        )}
        <View style={[
          styles.bubble, 
          isMine ? [styles.myBubble, { backgroundColor: colors.card, borderColor: colors.border }] : [styles.theirBubble, { backgroundColor: colors.card, borderColor: colors.border }],
          item.isTYC && [styles.tycBubble, { backgroundColor: isDark ? '#450a0a' : '#fff5f5', borderColor: colors.error }]
        ]}>
          {isGroup && !isMine && (
             <View style={styles.senderHeader}>
               <Text style={[styles.groupSenderName, { color: getSenderColor(senderName) }]}>{senderName}</Text>
               <View style={styles.roleBadge}>
                 <Text style={styles.roleBadgeText}>{(senderRole || 'USER').toUpperCase()}</Text>
               </View>
             </View>
          )}
          
          {item.replyTo && (
            <View style={styles.replyPreviewInside}>
              <Text style={styles.replyAuthorInside}>
                {typeof item.replyTo.senderId === 'object' ? item.replyTo.senderId.firstName : 'User'}
              </Text>
              <Text style={styles.replyTextInside} numberOfLines={1}>{item.replyTo.message}</Text>
            </View>
          )}

          {item.questionContexts && item.questionContexts.length > 0 ? (
            <View style={styles.contextContainer}>
              {item.questionContexts.map((ctx: any, idx: number) => (
                <View key={idx} style={styles.contextItem}>
                  <Text style={[styles.contextTitle, isMine ? styles.myContextTitle : styles.theirContextTitle, { color: isMine ? (isDark ? colors.success : '#166534') : colors.accent, borderBottomColor: colors.border }]}>
                    {ctx.title}
                  </Text>
                  
                  {ctx.suggestion && (
                    <View style={[styles.adminInstructionsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                       <View style={styles.adminInstructionsHeader}>
                         <Text style={styles.adminInstructionsTitle}>ADMIN INSTRUCTIONS</Text>
                       </View>
                       <View style={styles.suggestionBadge}>
                         <Text style={styles.suggestionBadgeText}>
                           SUGGESTED: {(() => {
                              const s = ctx.suggestion;
                              if (!s) return 'N/A';
                              
                              let val = s;
                              if (typeof s === 'string' && s.includes('{')) {
                                try { val = JSON.parse(s); } catch(e) { val = s; }
                              }

                              if (typeof val === 'object' && val !== null) {
                                return val.suggestion || val.value || val.text || val.status || val.message || JSON.stringify(val);
                              }
                              return String(val);
                            })()}
                         </Text>
                       </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : item.questionTitles && item.questionTitles.length > 0 && (
            <View style={styles.titlesContainer}>
               <View style={styles.linkedHeader}>
                  <Filter size={10} color={isMine ? "#86efac" : "#6366f1"} />
                  <Text style={[styles.linkedLabel, isMine ? styles.myLinkLabel : styles.theirLinkLabel]}>
                    LINKED QUESTIONS
                  </Text>
               </View>
               <View style={styles.titlesRow}>
                 {item.questionTitles.map((title: string, idx: number) => (
                   <View key={idx} style={[styles.titleTag, isMine ? styles.myTitleTag : styles.theirTitleTag]}>
                     <Text style={[styles.titleTagText, isMine ? styles.myTitleTagText : styles.theirTitleTagText]}>
                       {title}
                     </Text>
                   </View>
                 ))}
               </View>
            </View>
          )}

          {item.attachments && item.attachments.map((file: string, fidx: number) => {
             const imageUrl = file.startsWith('http') ? file : `${BASE_URL}/files/${file}`;
             return (
               <TouchableOpacity key={fidx} style={[styles.attachmentContainer, { backgroundColor: colors.surface }]} onPress={() => {}}>
                 <RNImage source={{ uri: imageUrl }} style={styles.attachmentImage} resizeMode="cover" />
               </TouchableOpacity>
             );
          })}

          <Text style={[styles.messageText, isMine ? styles.myText : styles.theirText, { color: colors.text }]}>
            {item.message}
          </Text>
          <View style={styles.messageFooterRow}>
            <Text style={[styles.messageTime, isMine ? styles.myTime : styles.theirTime, { color: colors.subtext }]}>
              {isMine ? 'You' : senderName.split(' ')[0]} • {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, isGroup ? styles.groupHeader : { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={24} color={isGroup ? "#fff" : colors.accent} />
          </TouchableOpacity>
          <View style={styles.headerIconContainer}>
            <UserCircle size={36} color={isGroup ? "#fff" : colors.accent} />
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, isGroup ? styles.groupTitle : { color: colors.text }]} numberOfLines={1}>
              {isGroup ? name : (title || 'General Message')}
            </Text>
            <View style={styles.userStatus}>
              <Text style={[styles.userRole, isGroup ? styles.groupSubTitle : { color: colors.subtext }]} numberOfLines={1}>
                {isGroup ? `${members.length || '15+'} online members` : `Form: ${formTitle || 'Service'} • Ref: ${String(contactId).substring(0, 10)}...`}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          {!isGroup && (
            <TouchableOpacity 
              style={[styles.openDashboardBtn, { backgroundColor: colors.accent }]} 
              onPress={() => (navigation as any).navigate('FormAnalytics', { responseId: contactId })}
            >
              <Text style={styles.openDashboardText}>Open Dashboard</Text>
            </TouchableOpacity>
          )}
          {isGroup && (
            <TouchableOpacity onPress={() => setShowMembers(true)} style={styles.memberBtnMain}>
              <Users size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={[styles.centered, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={groupMessagesByDate(messages)}
          keyExtractor={(item, index) => item._id || `date-${index}`}
          renderItem={renderItem}
          contentContainerStyle={[styles.messageList, { backgroundColor: colors.background }]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          onLayout={() => flatListRef.current?.scrollToEnd()}
        />
      )}

      {isTyping && (
        <View style={styles.typingBox}>
          <Text style={[styles.typingText, { color: colors.subtext }]}>{name} is typing...</Text>
        </View>
      )}

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}
      >
        {replyTo && (
          <View style={[styles.replyBar, { backgroundColor: colors.surface, borderLeftColor: colors.accent }]}>
            <View style={styles.replyContent}>
              <Text style={[styles.replyTitle, { color: colors.accent }]}>Replying to {typeof replyTo.senderId === 'object' ? replyTo.senderId.firstName : 'User'}</Text>
              <Text style={[styles.replyText, { color: colors.subtext }]} numberOfLines={1}>{replyTo.message}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <X size={18} color={colors.subtext} />
            </TouchableOpacity>
          </View>
        )}
        {selectedImage && (
          <View style={styles.previewContainer}>
            <RNImage source={{ uri: selectedImage }} style={styles.previewImage} />
            <TouchableOpacity style={styles.removeImageBtn} onPress={() => setSelectedImage(null)}>
              <X size={16} color="#fff" />
            </TouchableOpacity>
            {uploadingImage && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
          </View>
        )}
        <View style={[styles.inputBox, { backgroundColor: colors.surface }]}>
          <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
            <ImageIcon size={20} color={colors.subtext} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachBtn} onPress={takePhoto}>
            <Camera size={20} color={colors.subtext} />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={isGroup ? "Chat with group..." : "Type your reply..."}
            placeholderTextColor={colors.subtext}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendBtn, { backgroundColor: colors.accent }, (!newMessage.trim() && !selectedImage) && styles.sendBtnDisabled]} 
            onPress={() => handleSend(false)}
            disabled={!newMessage.trim() && !selectedImage}
          >
            {uploadingImage ? (
               <ActivityIndicator size="small" color="#fff" />
            ) : (
               <Send size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      {/* Group Members Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showMembers}
        onRequestClose={() => setShowMembers(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Group Members</Text>
              <TouchableOpacity onPress={() => setShowMembers(false)}>
                <X size={24} color={colors.subtext} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={members}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <View style={[styles.memberItem, { borderBottomColor: colors.border }]}>
                  <UserCircle size={40} color={colors.subtext} />
                  <View>
                    <Text style={[styles.memberName, { color: colors.text }]}>{item.firstName} {item.lastName}</Text>
                    <Text style={[styles.memberRole, { color: colors.accent }]}>{(item.role || 'USER').toUpperCase()}</Text>
                  </View>
                </View>
              )}
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc', 
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  raiseTycHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderWidth: 1.5,
    borderColor: '#fecaca',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 6,
  },
  raiseTycHeaderText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#e11d48',
    letterSpacing: 0.5,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    marginRight: 12,
    padding: 4,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  userStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  userRole: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  messageList: {
    padding: 16,
    paddingBottom: 32,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
    maxWidth: '88%',
    alignItems: 'flex-end',
  },
  myRow: {
    alignSelf: 'flex-end',
  },
  theirRow: {
    alignSelf: 'flex-start',
  },
  avatarMini: {
    marginRight: 8,
    marginBottom: 4,
  },
  bubble: {
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  myBubble: {
    backgroundColor: '#fff', 
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  theirBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 21,
    color: '#1e293b',
  },
  myText: {
    color: '#0f172a',
  },
  theirText: {
    color: '#1e293b',
  },
  messageTime: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  myTime: {
    color: '#64748b',
  },
  theirTime: {
    color: '#94a3b8',
  },
  messageFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  typingBox: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  typingText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 13,
    fontWeight: '900',
  },
  senderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  roleBadge: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#c7d2fe',
  },
  roleBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#4f46e5',
  },
  groupHeader: {
    backgroundColor: '#4f46e5',
    borderBottomWidth: 0,
  },
  groupTitle: {
    color: '#fff',
  },
  groupSubTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  memberBtnMain: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
  },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 14,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1e293b',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#efe7dd',
  },
  groupSenderName: {
    fontSize: 10,
    fontWeight: '900',
    color: '#4f46e5',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  tycBubble: {
    borderWidth: 2,
    borderColor: '#fecaca',
    backgroundColor: '#fff5f5',
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    paddingHorizontal: 20,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  dateLabel: {
    marginHorizontal: 16,
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 14,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4f46e5',
    elevation: 2,
  },
  replyContent: {
    flex: 1,
  },
  replyTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#4f46e5',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  replyPreviewInside: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4f46e5',
  },
  replyAuthorInside: {
    fontSize: 10,
    fontWeight: '900',
    color: '#4f46e5',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  replyTextInside: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '80%',
    paddingBottom: 40,
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
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  memberRole: {
    fontSize: 10,
    fontWeight: '900',
    color: '#6366f1',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contextContainer: {
    marginBottom: 8,
    gap: 4,
  },
  contextItem: {
    gap: 2,
  },
  contextTitle: {
    fontSize: 12,
    fontWeight: '800',
    borderBottomWidth: 1,
    paddingBottom: 2,
    color: '#4f46e5',
    borderBottomColor: '#f1f5f9',
  },
  myContextTitle: {
    color: '#166534',
    borderBottomColor: 'rgba(22, 101, 52, 0.1)',
  },
  theirContextTitle: {
    color: '#4f46e5',
    borderBottomColor: '#f1f5f9',
  },
  adminInstructionsBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  adminInstructionsHeader: {
    marginBottom: 8,
  },
  adminInstructionsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6366f1',
    letterSpacing: 0.5,
  },
  suggestionBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  suggestionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
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
  attachBtn: {
    padding: 8,
    marginRight: 4,
  },
  previewContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginBottom: 12,
    position: 'relative',
    backgroundColor: '#f1f5f9',
    marginLeft: 12,
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
  titlesContainer: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    padding: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  linkedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  linkedLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  myLinkLabel: {
    color: '#166534',
  },
  theirLinkLabel: {
    color: '#4f46e5',
  },
  titlesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  titleTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  myTitleTag: {
    backgroundColor: '#bbf7d0',
    borderColor: '#86efac',
  },
  theirTitleTag: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
  },
  titleTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  myTitleTagText: {
    color: '#166534',
  },
  theirTitleTagText: {
    color: '#4f46e5',
  },
  headerIconContainer: {
    marginRight: 8,
  },
  openDashboardBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  openDashboardText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});

export default ChatDetailScreen;
