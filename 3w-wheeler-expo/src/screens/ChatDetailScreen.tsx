import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator,
  Keyboard,
  Alert 
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Send, ChevronLeft, UserCircle, Circle, AlertTriangle, MessageSquare, Users, X, Reply } from 'lucide-react-native';
import { Modal } from 'react-native';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import apiClient, { BASE_URL } from '../api/config';

const SOCKET_URL = BASE_URL.replace('/api', '');

const ChatDetailScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { contactId, name, role, isGroup, tenantId } = route.params;
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const socketRef = useRef<any>(null);
  const flatListRef = useRef<any>(null);

  const fetchMessages = async () => {
    try {
      const endpoint = isGroup ? '/chat/group-messages' : `/chat/messages/${contactId}`;
      const response = await apiClient.get(endpoint);
      if (response.data.success) {
        setMessages(response.data.data);
      }
    } catch (error) {
      console.error('Fetch messages error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await apiClient.get('/chat/contacts');
      if (response.data.success) {
        setMembers(response.data.data);
      }
    } catch (error) {
      console.error('Fetch members error:', error);
    }
  };

  useEffect(() => {
    if (isGroup) fetchMembers();
  }, [isGroup]);

  useEffect(() => {
    fetchMessages();

    // Initialize socket
    socketRef.current = io(SOCKET_URL);
    
    if (isGroup) {
      socketRef.current.emit('join-group-chat', tenantId);
      socketRef.current.on('receive-group-message', (data: any) => {
        setMessages((prev) => [...prev, data]);
      });
      socketRef.current.on('tyc-raised', (data: any) => {
        console.log('TYC Raised in group:', data);
        Alert.alert('📍 New TYC Raised', `${data.senderName}: ${data.message}`);
      });
    } else {
      socketRef.current.emit('join-chat', user?._id);
      socketRef.current.on('receive-message', (data: any) => {
        if (data.senderId === contactId) {
          setMessages((prev) => [...prev, data]);
        }
      });
    }

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

  const handleSend = (isTYC = false) => {
    if (!newMessage.trim() || !user) return;

    const messageData: any = {
      senderId: user._id,
      message: newMessage.trim(),
      tenantId: user.tenantId,
      isTYC,
      replyTo: replyTo?._id || null
    };

    if (isGroup) {
      socketRef.current.emit('send-group-message', messageData);
    } else {
      messageData.receiverId = contactId;
      socketRef.current.emit('send-message', messageData);
    }

    // Update locally
    const optimisticMessage = {
      _id: Date.now().toString(),
      senderId: isGroup ? { _id: user._id, firstName: user.name?.split(' ')[0] || 'Me', role: user.role } : user._id,
      message: newMessage.trim(),
      isTYC,
      replyTo: replyTo,
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage('');
    setReplyTo(null);
    Keyboard.dismiss();
  };

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

  const renderItem = ({ item }: any) => {
    if (item.type === 'date') {
      return (
        <View style={styles.dateHeader}>
          <View style={styles.dateLine} />
          <Text style={styles.dateLabel}>{item.label}</Text>
          <View style={styles.dateLine} />
        </View>
      );
    }

    const senderId = typeof item.senderId === 'object' ? item.senderId._id : item.senderId;
    const isMine = senderId === user?._id;
    const senderName = typeof item.senderId === 'object' ? `${item.senderId.firstName} (${item.senderId.role})` : '';

    return (
      <View style={[styles.messageRow, isMine ? styles.myRow : styles.theirRow]}>
        {!isMine && (
          <View style={styles.avatarMini}>
            <UserCircle size={32} color={item.isTYC ? "#ef4444" : "#cbd5e1"} />
          </View>
        )}
        <View style={[
          styles.bubble, 
          isMine ? styles.myBubble : styles.theirBubble,
          item.isTYC && styles.tycBubble
        ]}>
          {isGroup && !isMine && <Text style={styles.groupSenderName}>{senderName}</Text>}
          
          {item.replyTo && (
            <View style={styles.replyPreviewInside}>
              <Text style={styles.replyAuthorInside}>
                {typeof item.replyTo.senderId === 'object' ? item.replyTo.senderId.firstName : 'User'}
              </Text>
              <Text style={styles.replyTextInside} numberOfLines={1}>{item.replyTo.message}</Text>
            </View>
          )}

          {item.isTYC && (
            <View style={styles.tycHeader}>
              <AlertTriangle size={12} color="#ef4444" />
              <Text style={styles.tycLabel}>PRIORITY QUERY (TYC)</Text>
            </View>
          )}
          <Text style={[styles.messageText, isMine ? styles.myText : styles.theirText]}>
            {item.message}
          </Text>
          <View style={styles.messageFooterRow}>
            <TouchableOpacity onPress={() => setReplyTo(item)}>
              <Reply size={12} color={isMine ? "#cbd5e1" : "#94a3b8"} />
            </TouchableOpacity>
            <Text style={[styles.messageTime, isMine ? styles.myTime : styles.theirTime]}>
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={24} color="#1e3a8a" />
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{name}</Text>
            <View style={styles.userStatus}>
              <Circle size={8} color="#10b981" fill="#10b981" />
              <Text style={styles.userRole}>{role.toUpperCase()} • ACTIVE</Text>
            </View>
          </View>
        </View>
        {isGroup && (
          <TouchableOpacity onPress={() => setShowMembers(true)} style={styles.memberBtn}>
            <Users size={22} color="#1e3a8a" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1e3a8a" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={groupMessagesByDate(messages)}
          keyExtractor={(item, index) => item._id || `date-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          onLayout={() => flatListRef.current?.scrollToEnd()}
        />
      )}

      {isTyping && (
        <View style={styles.typingBox}>
          <Text style={styles.typingText}>{name} is typing...</Text>
        </View>
      )}

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        style={styles.footer}
      >
        {replyTo && (
          <View style={styles.replyBar}>
            <View style={styles.replyContent}>
              <Text style={styles.replyTitle}>Replying to {typeof replyTo.senderId === 'object' ? replyTo.senderId.firstName : 'User'}</Text>
              <Text style={styles.replyText} numberOfLines={1}>{replyTo.message}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputBox}>
          <TouchableOpacity 
            style={[styles.tycBtn, newMessage.length > 0 && styles.tycBtnActive]} 
            onPress={() => handleSend(true)}
            disabled={!newMessage.trim()}
          >
            <AlertTriangle size={20} color={newMessage.length > 0 ? "#ef4444" : "#cbd5e1"} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={isGroup ? "Message group..." : "Write your message..."}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendBtn, !newMessage.trim() && styles.sendBtnDisabled]} 
            onPress={() => handleSend(false)}
            disabled={!newMessage.trim()}
          >
            <Send size={20} color="#fff" />
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Group Members</Text>
              <TouchableOpacity onPress={() => setShowMembers(false)}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={members}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <View style={styles.memberItem}>
                  <UserCircle size={40} color="#cbd5e1" />
                  <View>
                    <Text style={styles.memberName}>{item.firstName} {item.lastName}</Text>
                    <Text style={styles.memberRole}>{item.role.toUpperCase()}</Text>
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
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
  memberBtn: {
    padding: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
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
    fontWeight: '700',
    color: '#3b82f6',
  },
  messageList: {
    padding: 16,
    paddingBottom: 32,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
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
    padding: 12,
    borderRadius: 20,
  },
  myBubble: {
    backgroundColor: '#1e3a8a',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#f1f5f9',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myText: {
    color: '#fff',
  },
  theirText: {
    color: '#1e293b',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myTime: {
    color: '#cbd5e1',
  },
  theirTime: {
    color: '#94a3b8',
  },
  typingBox: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  typingText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
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
  },
  groupSenderName: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3b82f6',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  tycBtn: {
    padding: 8,
    marginRight: 4,
  },
  tycBtnActive: {
    transform: [{ scale: 1.1 }],
  },
  tycBubble: {
    borderWidth: 1.5,
    borderColor: '#fee2e2',
    backgroundColor: '#fff1f2',
  },
  tycHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
    paddingBottom: 4,
  },
  tycLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ef4444',
    letterSpacing: 0.5,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  dateLabel: {
    marginHorizontal: 12,
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  messageFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  replyContent: {
    flex: 1,
    borderLeftWidth: 3,
    borderLeftColor: '#1e3a8a',
    paddingLeft: 10,
  },
  replyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e3a8a',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 13,
    color: '#64748b',
  },
  replyPreviewInside: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#1e3a8a',
  },
  replyAuthorInside: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1e3a8a',
    marginBottom: 2,
  },
  replyTextInside: {
    fontSize: 12,
    color: '#64748b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  memberRole: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3b82f6',
    marginTop: 2,
  }
});

export default ChatDetailScreen;
