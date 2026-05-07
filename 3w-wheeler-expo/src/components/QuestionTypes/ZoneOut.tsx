import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, ScrollView, Dimensions } from 'react-native';
import { CheckCircle2, RotateCcw, XCircle, Camera, Upload, X, MessageSquare, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import InAppCamera from '../InAppCamera';
import { BASE_URL } from '../../api/config';

const { width } = Dimensions.get('window');

// Helper to normalize image URLs
const getImageUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('file:')) return url;
  return `${BASE_URL}/files/${url}`;
};

interface ZoneOutProps {
  question: any;
  value: any;
  onChange: (value: any) => void;
  readOnly?: boolean;
  suggestions?: any[];
  hideChassisNumber?: boolean;
}

export default function ZoneOut({
  question,
  value,
  onChange,
  readOnly = false,
  suggestions = [],
  hideChassisNumber = false,
}: ZoneOutProps) {
  const chassisValue = value?.chassisNumber || "";
  const statusValue = value?.status || "";
  const remarkValue = value?.remark || "";
  const evidenceUrl = value?.evidenceUrl || "";

  const [cameraVisible, setCameraVisible] = useState(false);

  const updateValue = (updates: any) => {
    if (readOnly) return;
    onChange({
      chassisNumber: chassisValue,
      status: statusValue,
      remark: remarkValue,
      evidenceUrl: evidenceUrl,
      ...updates
    });
  };

  const handleStatusChange = (val: string) => {
    updateValue({ status: val });
  };

  const reworkCount = suggestions?.filter(s => {
    const status = s.answers?.status || (s.value && typeof s.value === 'object' ? s.value.status : null);
    return status === 'Rework';
  }).length || 0;

  const hasChassis = hideChassisNumber || chassisValue.trim().length > 0;

  return (
    <View style={styles.container}>
      {!hideChassisNumber && (
        <View style={styles.section}>
          <TextInput
            style={[styles.input, readOnly && styles.disabledInput]}
            value={chassisValue}
            onChangeText={(val) => updateValue({ chassisNumber: val })}
            placeholder="Enter Chassis Number..."
            editable={!readOnly}
            placeholderTextColor="#94a3b8"
          />
          {hasChassis && chassisValue.length > 0 && (
            <View style={styles.chassisCheck}>
              <CheckCircle2 size={16} color="#10b981" />
            </View>
          )}
        </View>
      )}

      {/* Step 2: Status Selection */}
      {hasChassis && (
        <View style={styles.content}>
          <Text style={styles.label}>INSPECTION STATUS</Text>
          <View style={styles.statusGrid}>
            {[
              { id: 'Accepted', icon: CheckCircle2, color: '#10b981', bg: '#ecfdf5', label: 'ACCEPTED' },
              { id: 'Rework', icon: RotateCcw, color: '#f59e0b', bg: '#fffbeb', label: 'REWORK' },
              { id: 'Rejected', icon: XCircle, color: '#ef4444', bg: '#fef2f2', label: 'REJECTED' }
            ].map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => handleStatusChange(s.id)}
                disabled={readOnly}
                style={[
                  styles.statusBtn,
                  statusValue === s.id ? { borderColor: s.color, backgroundColor: s.bg, shadowColor: s.color, shadowOpacity: 0.1, shadowRadius: 10 } : styles.statusBtnInactive
                ]}
              >
                <s.icon size={24} color={statusValue === s.id ? s.color : '#cbd5e1'} strokeWidth={1.5} />
                <Text style={[styles.statusText, { color: statusValue === s.id ? s.color : '#94a3b8' }]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {statusValue !== "" && (
            <View style={styles.detailsArea}>
              {/* Remark & Evidence */}
              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <View style={styles.iconLabelRow}>
                    <MessageSquare size={14} color="#64748b" />
                    <Text style={styles.detailLabel}>REMARK</Text>
                  </View>
                  <TextInput
                    style={[styles.textArea, readOnly && styles.disabledInput]}
                    value={remarkValue}
                    onChangeText={(val) => updateValue({ remark: val })}
                    placeholder="Enter remark..."
                    multiline
                    editable={!readOnly}
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={[styles.field, { width: 120, marginLeft: 12 }]}>
                  <View style={styles.iconLabelRow}>
                    <Camera size={14} color="#64748b" />
                    <Text style={styles.detailLabel}>PHOTO</Text>
                  </View>
                  {evidenceUrl ? (
                    <View style={styles.evidencePreview}>
                      <Image source={{ uri: getImageUrl(evidenceUrl) }} style={styles.evidenceThumb} />
                      {!readOnly && (
                        <TouchableOpacity style={styles.removeBtn} onPress={() => updateValue({ evidenceUrl: "" })}>
                          <X size={12} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View style={styles.evidenceActions}>
                      <TouchableOpacity 
                        style={styles.miniBtn} 
                        onPress={() => setCameraVisible(true)}
                        disabled={readOnly}
                      >
                        <Camera size={18} color="#3b82f6" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.miniBtn}
                        onPress={async () => {
                          const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
                          if (!res.canceled) updateValue({ evidenceUrl: res.assets[0].uri });
                        }}
                        disabled={readOnly}
                      >
                        <Upload size={18} color="#64748b" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      <InAppCamera
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onCapture={(uri) => {
          updateValue({ evidenceUrl: uri });
          setCameraVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 0 },
  section: { position: 'relative', marginBottom: 20 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '500'
  },
  disabledInput: { backgroundColor: '#f8fafc', borderColor: '#f1f5f9' },
  chassisCheck: { position: 'absolute', right: 16, top: 14 },
  content: { 
    marginTop: 10, 
    backgroundColor: '#f8fafc', 
    borderRadius: 24, 
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  label: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 16, textAlign: 'center' },
  statusGrid: { flexDirection: 'row', gap: 12 },
  statusBtn: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 24, 
    borderRadius: 16, 
    borderWidth: 1,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8
  },
  statusBtnInactive: { borderColor: '#f1f5f9' },
  statusText: { fontSize: 10, fontWeight: '800', marginTop: 12, letterSpacing: 0.5 },
  detailsArea: { 
    marginTop: 20, 
    padding: 16, 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10
  },
  detailSection: { marginBottom: 16 },
  iconLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  detailLabel: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  row: { flexDirection: 'row' },
  field: { gap: 4 },
  textArea: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 13, color: '#334155', minHeight: 80, textAlignVertical: 'top' },
  evidencePreview: { width: '100%', height: 80, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  evidenceThumb: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  evidenceActions: { height: 80, gap: 8 },
  miniBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }
});
