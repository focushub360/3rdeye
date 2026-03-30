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
  Keyboard 
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Send, ChevronLeft, UserCircle, Circle } from 'lucide-react-native';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/config';

const SOCKET_URL = 'http://192.168.31.181:5000'; // Replace with your local machine's IP

const ChatDetailScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { contactId, name, role } = route.params;
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const socketRef = useRef<any>(null);
  const flatListRef = useRef<any>(null);

  const fetchMessages = async () => {
    try {
      const response = await apiClient.get(`/chat/messages/${contactId}`);
      if (response.data.success) {
        setMessages(response.data.data);
      }
    } catch (error) {
      console.error('Fetch messages error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Initialize socket
    socketRef.current = io(SOCKET_URL);
    
    socketRef.current.emit('join-chat', user?._id);

    socketRef.current.on('receive-message', (data: any) => {
      if (data.senderId === contactId) {
        setMessages((prev) => [...prev, data]);
      }
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
  }, [contactId]);

  const handleSend = () => {
    if (!newMessage.trim() || !user) return;

    const messageData = {
      senderId: user._id,
      receiverId: contactId,
      message: newMessage.trim(),
      tenantId: user.tenantId
    };

    // Emit to socket
    socketRef.current.emit('send-message', messageData);

    // Update locally
    const optimisticMessage = {
      _id: Date.now().toString(),
      senderId: user._id,
      message: newMessage.trim(),
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage('');
    Keyboard.dismiss();
  };

  const renderMessage = ({ item }: any) => {
    const isMine = item.senderId === user?._id;
    return (
      <View style={[styles.messageRow, isMine ? styles.myRow : styles.theirRow]}>
        {!isMine && <UserCircle size={32} color="#cbd5e1" style={styles.avatarMini} />}
        <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
          <Text style={[styles.messageText, isMine ? styles.myText : styles.theirText]}>
            {item.message}
          </Text>
          <Text style={[styles.messageTime, isMine ? styles.myTime : styles.theirTime]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#1e3a8a" />
        </TouchableOpacity>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{name}</Text>
          <View style={styles.userStatus}>
            <Circle size={10} color="#10b981" fill="#10b981" />
            <Text style={styles.userRole}>{role.toUpperCase()} • ACTIVE NOW</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1e3a8a" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderMessage}
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
        <View style={styles.inputBox}>
          <TextInput
            style={styles.input}
            placeholder="Write your message..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendBtn, !newMessage.trim() && styles.sendBtnDisabled]} 
            onPress={handleSend}
            disabled={!newMessage.trim()}
          >
            <Send size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
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
  }
});

export default ChatDetailScreen;
