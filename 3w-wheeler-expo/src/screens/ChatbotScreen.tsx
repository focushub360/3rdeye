import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Search, MessageSquare, Plus, UserCircle, X, ShieldCheck, Users, RefreshCcw, Filter } from 'lucide-react-native';
import apiClient from '../api/config';
import { useAuth } from '../context/AuthContext';

const { height } = Dimensions.get('window');

const ChatListScreen = () => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const fetchData = async () => {
    try {
      const [msgRes, contactRes] = await Promise.all([
        apiClient.get('/messages/tenant-messages'),
        apiClient.get('/users?role=admin&role=superadmin&role=subadmin')
      ]);
      
      if (msgRes.data.success) {
        // Group messages by responseId to create threads (similar to Web Dashboard)
        const messages = msgRes.data.data || [];
        const threads = messages.reduce((acc: any, msg: any) => {
          const resId = (typeof msg.responseId === 'object' && msg.responseId?.id) 
            ? msg.responseId.id 
            : (typeof msg.responseId === 'object' && msg.responseId?._id)
              ? msg.responseId._id
              : (msg.responseId || 'general');
          
          if (!acc[resId]) {
            let questionTitle = "General Message";
            if (msg.questionTitles && msg.questionTitles.length > 0) {
              questionTitle = msg.questionTitles[0];
            }

            acc[resId] = {
              _id: resId,
              user: msg.from || { firstName: 'System', lastName: '', role: 'admin' },
              lastMessage: msg.message,
              createdAt: msg.createdAt,
              unreadCount: 0, // In a real app, this would come from a tracking mechanism
              title: questionTitle,
              formTitle: (typeof msg.responseId === 'object' && msg.responseId?.formTitle) ? msg.responseId.formTitle : 'Service'
            };
          }
          return acc;
        }, {});

        setConversations(Object.values(threads).sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      }

      if (contactRes.data.success) {
        setContacts(contactRes.data.data.users || []);
      }
    } catch (error) {
      console.error('Fetch chat data error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const filteredConversations = conversations.filter((item: any) => {
    const name = `${item.user?.firstName} ${item.user?.lastName}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const renderConversationItem = ({ item }: any) => {
    const contact = item.user;
    return (
      <TouchableOpacity 
        style={styles.chatItem}
        onPress={() => navigation.navigate('ChatDetail', { 
          contactId: item._id, 
          name: `${contact.firstName} ${contact.lastName}`,
          role: contact.role,
          title: item.title,
          formTitle: item.formTitle
        })}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.webAvatarWrapper}>
            <UserCircle size={32} color="#4f46e5" />
          </View>
          {item.unreadCount > 0 && <View style={styles.unreadBadge}><Text style={styles.unreadText}>{item.unreadCount}</Text></View>}
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName}>ID: {String(item._id).substring(0, 16)}</Text>
            <Text style={styles.chatTime}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderContactItem = ({ item }: any) => (
    <TouchableOpacity 
      style={styles.modalChatItem}
      onPress={() => {
        setIsModalVisible(false);
        navigation.navigate('ChatDetail', { 
          contactId: item._id, 
          name: `${item.firstName} ${item.lastName}`,
          role: item.role
        });
      }}
    >
      <UserCircle size={40} color="#cbd5e1" />
      <View style={styles.modalChatInfo}>
        <Text style={styles.modalChatName}>{item.firstName} {item.lastName}</Text>
        <Text style={styles.modalChatRole}>{(item.role || 'GUEST').toUpperCase()}</Text>
      </View>
      <ShieldCheck size={18} color="#1e3a8a" />
    </TouchableOpacity>
  );

  if (loading && !refreshing && conversations.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.webHeader}>
        <Text style={styles.webTitle}>Chat System</Text>
        <View style={styles.webHeaderActions}>
          <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
            <RefreshCcw size={18} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversation..."
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity style={styles.filterBtn}>
          <Filter size={18} color="#64748b" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item._id}
        renderItem={renderConversationItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.webEmptyIconOuter}>
              <View style={styles.webEmptyIconInner}>
                <MessageSquare size={32} color="#4f46e5" />
              </View>
            </View>
            <Text style={styles.emptyTitle}>Your Workspace Chat</Text>
            <Text style={styles.emptySub}>Select a conversation from the list to start messaging.</Text>
          </View>
        }
      />

      {/* Floating Action Button removed as per request */}

      {/* Select Higher Authority Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Contact Authority</Text>
                <Text style={styles.modalSubtitle}>Select a Subadmin or Superadmin</Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={contacts}
              keyExtractor={(item) => item._id}
              renderItem={renderContactItem}
              contentContainerStyle={styles.modalList}
              ListHeaderComponent={
                <Text style={styles.authorityLabel}>AVAILABLE HIGHER AUTHORITIES</Text>
              }
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
    backgroundColor: '#fff', // White background like web sidebar
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  webHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
  webTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  webHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
    gap: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
  },
  filterBtn: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 100,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  activeChatItem: {
    backgroundColor: '#eff6ff',
    borderLeftColor: '#2563eb',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  webAvatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#6366f1',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  chatName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  chatTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  chatRole: {
    fontSize: 9,
    fontWeight: '900',
    color: '#4f46e5',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  chatRow: {
    flexDirection: 'column',
  },
  chatMessage: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    fontWeight: '400',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
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
    maxHeight: height * 0.75,
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
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  modalList: {
    padding: 24,
  },
  authorityLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1.5,
    marginBottom: 20,
    textTransform: 'uppercase',
  },
  modalChatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    gap: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  modalChatInfo: {
    flex: 1,
  },
  modalChatName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  modalChatRole: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6366f1',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    gap: 12,
  },
  webEmptyIconOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 8,
    borderColor: '#ffffff',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    marginBottom: 8,
  },
  webEmptyIconInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  emptySub: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 18,
  }
});

export default ChatListScreen;

