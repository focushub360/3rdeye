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
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Search, MessageSquare, Plus, UserCircle, X, ShieldCheck } from 'lucide-react-native';
import apiClient from '../api/config';
import { useAuth } from '../context/AuthContext';

const { height } = Dimensions.get('window');

const ChatListScreen = () => {
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
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
                <Text style={styles.modalSubtitle}>Select a Supervisor or Administrator</Text>
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
