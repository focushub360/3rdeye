import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
  Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Search, MessageSquare, Plus, UserCircle, X, ShieldCheck, Users } from 'lucide-react-native';
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
      const [convRes, contactRes] = await Promise.all([
        apiClient.get('/chat/conversations'),
        apiClient.get('/chat/contacts')
      ]);
      
      if (convRes.data.success) setConversations(convRes.data.data);
      if (contactRes.data.success) setContacts(contactRes.data.data);
    } catch (error) {
      console.log('Using mock chat data for showcase');
      // Mock Data for Demo
      setConversations([
        {
          _id: '1',
          user: { firstName: 'Vell', lastName: 'Murugan', role: 'subadmin' },
          lastMessage: 'The vehicle inspection report is ready.',
          createdAt: new Date().toISOString(),
          unreadCount: 2
        },
        {
          _id: '2',
          user: { firstName: 'Deepak', lastName: 'V', role: 'superadmin' },
          lastMessage: 'Please check the new service request.',
          createdAt: new Date().toISOString(),
          unreadCount: 0
        }
      ]);
      setContacts([
        { _id: '1', firstName: 'Vell', lastName: 'Murugan', role: 'subadmin' },
        { _id: '2', firstName: 'Deepak', lastName: 'V', role: 'superadmin' }
      ]);
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
          role: contact.role
        })}
      >
        <View style={styles.avatarContainer}>
          <UserCircle size={50} color="#cbd5e1" />
          {item.unreadCount > 0 && <View style={styles.unreadBadge}><Text style={styles.unreadText}>{item.unreadCount}</Text></View>}
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName}>{contact.firstName} {contact.lastName}</Text>
            <Text style={styles.chatTime}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
          <View style={styles.chatRow}>
            <Text style={styles.chatRole}>{contact.role.toUpperCase()}</Text>
            <Text style={styles.chatMessage} numberOfLines={1}>{item.lastMessage}</Text>
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
        <Text style={styles.modalChatRole}>{item.role.toUpperCase()}</Text>
      </View>
      <ShieldCheck size={18} color="#1e3a8a" />
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      {/* Premium Group Chat Card */}
      {user?.tenant && (
        <TouchableOpacity 
          style={styles.premiumGroupCard}
          onPress={() => navigation.navigate('ChatDetail', { 
            isGroup: true,
            tenantId: user.tenant.id || user.tenantId,
            name: `${user.tenant.name || 'Laxmi Metals'} Official`,
            role: 'ORGANIZATION'
          })}
        >
          <View style={styles.groupIconWrapper}>
            <Users size={30} color="#fff" />
            <View style={styles.onlinePing} />
          </View>
          <View style={styles.groupInfoMain}>
            <View style={styles.groupNameRow}>
              <Text style={styles.groupTitleText}>{user.tenant.name || 'Laxmi Metals'} Family</Text>
              <View style={styles.verifiedBadge}>
                <ShieldCheck size={12} color="#fff" />
              </View>
            </View>
            <Text style={styles.participantPreview}>
              {contacts.slice(0, 2).map(c => c.firstName).join(', ')} 
              {contacts.length > 2 ? ` + ${contacts.length} others` : ' • Team channel'}
            </Text>
          </View>
          <View style={styles.groupMeta}>
             <View style={styles.groupBadge}>
                <Text style={styles.groupBadgeText}>REAL TIME</Text>
             </View>
             <Text style={styles.groupTime}>Live</Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.searchBox}>
        <Search size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item._id}
        renderItem={renderConversationItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MessageSquare size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No active conversations</Text>
          </View>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => setIsModalVisible(true)}
      >
        <Plus size={28} color="#fff" />
      </TouchableOpacity>

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
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  premiumGroupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 32,
    marginBottom: 24,
    elevation: 12,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  groupIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
    position: 'relative',
  },
  onlinePing: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10b981',
    borderWidth: 3,
    borderColor: '#1e3a8a',
  },
  groupInfoMain: {
    flex: 1,
  },
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupTitleText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  verifiedBadge: {
    backgroundColor: '#3b82f6',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantPreview: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '600',
  },
  groupMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  groupBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  groupBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  groupTime: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '900',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    marginHorizontal: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    height: 52,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 24,
    gap: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  chatTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  chatRole: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3b82f6',
    marginBottom: 4,
  },
  chatRow: {
    flexDirection: 'column',
  },
  chatMessage: {
    fontSize: 14,
    color: '#64748b',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1e3a8a',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: height * 0.7,
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
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalList: {
    padding: 24,
  },
  authorityLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 20,
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
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  modalChatRole: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3b82f6',
    marginTop: 2,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    gap: 12,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
  }
});

export default ChatListScreen;
