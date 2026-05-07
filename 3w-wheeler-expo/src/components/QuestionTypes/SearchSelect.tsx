import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, Pressable } from 'react-native';
import { Search, X, Check, ChevronDown } from 'lucide-react-native';

interface SearchSelectProps {
  options: { label: string; value: string }[] | string[];
  value: any;
  onChange: (value: any) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export default function SearchSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Search...',
  readOnly = false,
}: SearchSelectProps) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const normalizedOptions = options.map(opt => 
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const filteredOptions = normalizedOptions.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = normalizedOptions.find(opt => opt.value === value);

  return (
    <View>
      <TouchableOpacity
        style={[styles.trigger, readOnly && styles.disabled]}
        onPress={() => !readOnly && setVisible(true)}
        disabled={readOnly}
      >
        <Text style={[styles.triggerText, !value && styles.placeholder]}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <ChevronDown size={18} color="#64748b" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.searchContainer}>
                <Search size={18} color="#94a3b8" />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Type to search..."
                  autoFocus
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <X size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.list}>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => {
                  const isSelected = value === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.item, isSelected && styles.itemActive]}
                      onPress={() => {
                        onChange(opt.value);
                        setVisible(false);
                        setSearch('');
                      }}
                    >
                      <Text style={[styles.itemText, isSelected && styles.itemTextActive]}>{opt.label}</Text>
                      {isSelected && <Check size={18} color="#1e3a8a" />}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No results found</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  triggerText: { fontSize: 14, fontWeight: '600', color: '#1e3a8a' },
  placeholder: { color: '#94a3b8', fontWeight: '500' },
  disabled: { opacity: 0.6 },
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  content: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%', paddingBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 12 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, height: 44, gap: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#1e293b', paddingVertical: 8 },
  closeBtn: { paddingHorizontal: 4 },
  closeText: { fontSize: 15, fontWeight: '700', color: '#3b82f6' },
  list: { padding: 8 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12, marginBottom: 4 },
  itemActive: { backgroundColor: '#eff6ff' },
  itemText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  itemTextActive: { color: '#1e3a8a', fontWeight: '700' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 14, fontWeight: '500' },
});
