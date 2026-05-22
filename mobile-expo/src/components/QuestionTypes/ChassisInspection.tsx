import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, Alert, Modal, ScrollView, Pressable, Dimensions } from 'react-native';
import { CheckCircle2, ChevronDown, ChevronUp, Check, Layers, Image as ImageIcon, X, Zap, Camera, Upload, MessageSquare } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import InAppCamera from '../InAppCamera';
import { BASE_URL } from '../../api/config';

const { height, width } = Dimensions.get('window');

// Helper to normalize image URLs
const getImageUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('file:')) return url;
  return `${BASE_URL}/files/${url}`;
};

interface ChassisInspectionProps {
  question: any;
  value: any;
  onChange: (value: any) => void;
  readOnly?: boolean;
  showZone?: boolean;
  suggestions?: any[];
}

interface SpecificDefectDetail {
  remark?: string;
  evidence?: string;
}

const FALLBACK_ZONES = ["Zone A+", "Zone A", "Zone B", "Zone C"];
const DEFECT_CATEGORIES = ["Painting defects", "Welding defects", "Fitment defects", "Sealant defects", "Handling defects"];

const SUB_DEFECTS: Record<string, string[]> = {
  "Painting defects": [
    "Paint uncover", "Low DFT", "Colour missmatch", "Cissing mark", 
    "Paint rundown", "Orange peel", "Dry spray", "Rough finish", 
    "High DFT", "Dirt inclusion", "Blisters", "Bubbling"
  ],
  "Welding defects": [
    "Porosity", "Pin hole", "Spatters", "Burnthrough", "crack", 
    "Unfill", "Undercut", "Excess weld", "Chipping mark", "Sharp edge", 
    "Spot missing", "Spot welding shift", "Edge spot", "Edge spot burr", 
    "Weld shift", "No nugget formation", "Welding stick", 
    "Plug welding missing", "Plug welding burn through", "Spot failure"
  ],
  "Fitment defects": [
    "Hole misalignment", "Bracket misalignment", "Gap issue", "Interference", 
    "Bolt not assembling", "Part not assembly", "Thread damage", 
    "Mouting point shift", "Weld bead interference", "Clearance issue", 
    "Nut missing", "Nut offset", "Bolt missing", "Bolt lossen", 
    "Assembly not seating", "Bracket tilt"
  ],
  "Sealant defects": [
    "Sealant missing", "Incomplete sealant", "Uneven bead", "Excess sealant", 
    "Selant overflow", "Sealant lifting", "Sealant gap", 
    "Discontinuous sealant", "Sealant crack", "Water leakage", "Sealant peeling"
  ],
  "Handling defects": [
    "Dent", "Bend", "Paint damage", "Scratch", "Rust due to storage", 
    "Packing damage", "Transit damage", "Part rubbing damage"
  ]
};

export default function ChassisInspection({
  question,
  value,
  onChange,
  readOnly = false,
  showZone = false,
  suggestions = [],
}: ChassisInspectionProps) {
  const status = value?.status || "";
  const selectedZones = Array.isArray(value?.zones) ? value.zones : [];
  const zoneData = value?.zoneData || {}; 
  const evidencePhotos = value?.evidencePhotos || [];
  const rejectedCategories = Array.isArray(value?.rejectedCategories) ? value.rejectedCategories : [];
  const rejectedDefects = value?.rejectedDefects || {}; // { "Painting defects": [{name: "", remark: "", evidence: ""}] }
  
  const [cameraVisible, setCameraVisible] = useState<{ zone?: string, cat: string, defect: string, mode: 'zone' | 'rejected' } | boolean>(false);
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [subDefectModal, setSubDefectModal] = useState<{ mode: 'zone' | 'rejected', id: string, cat: string } | null>(null);

  const ZONE_OPTIONS = (Array.isArray(question?.options) && question.options.length > 0)
    ? question.options
    : FALLBACK_ZONES;

  const updateValue = (updates: any) => {
    if (readOnly) return;
    onChange({ ...(value || {}), ...updates });
  };

  // Calculate rework count from suggestions
  const reworkCount = suggestions?.filter(s => {
    const sStatus = s.answers?.status || (s.value && typeof s.value === 'object' ? s.value.status : null);
    return String(sStatus || '').toLowerCase().includes('rework');
  }).length || 0;

  const toggleZone = (z: string) => {
    const current = [...selectedZones];
    if (current.includes(z)) {
      updateValue({ zones: current.filter(item => item !== z) });
    } else {
      updateValue({ zones: [...current, z] });
      setExpandedZone(z);
    }
  };

  const toggleSubDefect = (cat: string, item: string) => {
    if (!subDefectModal) return;

    if (subDefectModal.mode === 'zone') {
        const z = subDefectModal.id;
        const currentZoneData = zoneData[z] || { defects: {} };
        const currentDefects = currentZoneData.defects?.[cat] || [];
        const isSelected = currentDefects.some((d: any) => (typeof d === 'string' ? d === item : d.name === item));
        
        let nextDefects;
        if (isSelected) {
            nextDefects = currentDefects.filter((d: any) => (typeof d === 'string' ? d !== item : d.name !== item));
        } else {
            nextDefects = [...currentDefects, { name: item, remark: "", evidence: "" }];
        }
        
        const newData = { ...zoneData, [z]: { ...currentZoneData, defects: { ...(currentZoneData.defects || {}), [cat]: nextDefects } } };
        updateValue({ zoneData: newData });
    } else {
        const currentDefects = rejectedDefects[cat] || [];
        const isSelected = currentDefects.some((d: any) => (typeof d === 'string' ? d === item : d.name === item));
        
        let nextDefects;
        if (isSelected) {
            nextDefects = currentDefects.filter((d: any) => (typeof d === 'string' ? d !== item : d.name !== item));
        } else {
            nextDefects = [...currentDefects, { name: item, remark: "", evidence: "" }];
        }
        
        updateValue({ rejectedDefects: { ...rejectedDefects, [cat]: nextDefects } });
    }
  };

  const updateDefectDetail = (mode: 'zone' | 'rejected', id: string, cat: string, defectName: string, updates: Partial<SpecificDefectDetail>) => {
    if (mode === 'zone') {
        const z = id;
        const currentZoneData = zoneData[z] || { defects: {} };
        const currentDefects = currentZoneData.defects?.[cat] || [];
        const nextDefects = currentDefects.map((d: any) => {
            const name = typeof d === 'string' ? d : d.name;
            if (name === defectName) {
                const base = typeof d === 'string' ? { name: d, remark: "", evidence: "" } : d;
                return { ...base, ...updates };
            }
            return d;
        });
        const newData = { ...zoneData, [z]: { ...currentZoneData, defects: { ...(currentZoneData.defects || {}), [cat]: nextDefects } } };
        updateValue({ zoneData: newData });
    } else {
        const currentDefects = rejectedDefects[cat] || [];
        const nextDefects = currentDefects.map((d: any) => {
            const name = typeof d === 'string' ? d : d.name;
            if (name === defectName) {
                const base = typeof d === 'string' ? { name: d, remark: "", evidence: "" } : d;
                return { ...base, ...updates };
            }
            return d;
        });
        updateValue({ rejectedDefects: { ...rejectedDefects, [cat]: nextDefects } });
    }
  };

  const statusConfig = [
    { 
      key: "Accepted", 
      label: reworkCount > 0 ? "REWORK COMPLETED" : "ACCEPTED", 
      color: "#10b981", 
      bg: "#ecfdf5" 
    },
    { 
      key: "Rework", 
      label: reworkCount > 0 ? `RE-REWORK (${reworkCount})` : "REWORK", 
      color: "#f59e0b", 
      bg: "#fffbeb" 
    },
    { 
      key: "Rejected", 
      label: "REJECTED", 
      color: "#ef4444", 
      bg: "#fef2f2" 
    },
  ];

  return (
    <View style={styles.container}>
      {/* Inspection Status */}
      <View style={styles.section}>
        <Text style={styles.label}>INSPECTION STATUS</Text>
        <View style={styles.statusGrid}>
          {statusConfig.map((s) => (
            <TouchableOpacity
              key={s.key}
              onPress={() => updateValue({ status: status === s.key ? "" : s.key })}
              disabled={readOnly}
              style={[styles.statusButton, { borderColor: status === s.key ? s.color : '#f3f4f6', backgroundColor: status === s.key ? s.bg : '#fff' }]}
            >
              <View style={[styles.radioCircle, { borderColor: status === s.key ? s.color : '#cbd5e1' }, status === s.key && { backgroundColor: s.color }]}>
                {status === s.key && <Check size={14} color="#fff" />}
              </View>
              <Text style={[styles.statusLabel, { color: status === s.key ? s.color : '#94a3b8' }]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Evidence Photos Section - Always Visible */}
      <View style={styles.section}>
        <View style={styles.iconLabelRow}>
          <ImageIcon size={14} color="#94a3b8" />
          <Text style={styles.label}>EVIDENCE PHOTOS</Text>
        </View>
        {evidencePhotos.length > 0 && (
          <ScrollView horizontal style={styles.photoScroll} showsHorizontalScrollIndicator={false}>
            {evidencePhotos.map((p: string, i: number) => (
              <View key={i} style={styles.photoBox}>
                <Image source={{ uri: getImageUrl(p) }} style={styles.photo} />
                {!readOnly && (
                  <TouchableOpacity 
                    style={styles.removeEvidence} 
                    onPress={() => updateValue({ evidencePhotos: evidencePhotos.filter((_: any, idx: number) => idx !== i) })}
                  >
                    <X size={12} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        )}
        {!readOnly && (
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setCameraVisible(true)}>
              <Camera size={18} color="#3b82f6" />
              <Text style={[styles.actionText, { color: '#3b82f6' }]}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={async () => {
                const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
                if (!res.canceled) updateValue({ evidencePhotos: [...evidencePhotos, res.assets[0].uri] });
              }}
            >
              <Upload size={18} color="#64748b" />
              <Text style={styles.actionText}>Upload</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* REWORK & REJECTED MODE */}
      {(status === "Rework" || status === "Rejected") && (
        <>
          {showZone ? (
            <>
              <View style={styles.section}>
                <View style={styles.iconLabelRow}><Layers size={14} color="#94a3b8" /><Text style={styles.label}>ZONE CLARIFICATION</Text></View>
                <View style={styles.zoneGrid}>
                  {ZONE_OPTIONS.map((z: any) => (
                    <TouchableOpacity key={z} style={[styles.zoneCard, selectedZones.includes(z) && styles.zoneCardSelected]} onPress={() => toggleZone(z)}>
                      <View style={[styles.checkbox, selectedZones.includes(z) && styles.checkedBox]}>{selectedZones.includes(z) && <Check size={12} color="#fff" />}</View>
                      <Text style={[styles.zoneText, selectedZones.includes(z) && styles.zoneTextSelected]}>{z}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {selectedZones.map((z: string) => {
                const data = zoneData[z] || { categories: [], defects: {} };
                const isExpanded = expandedZone === z;
                return (
                  <View key={z} style={styles.nestedGroup}>
                    <TouchableOpacity style={styles.nestedHeader} onPress={() => setExpandedZone(isExpanded ? null : z)}>
                      <View style={styles.nestedHeaderLeft}>
                        {isExpanded ? <ChevronUp size={20} color="#3b82f6" /> : <ChevronDown size={20} color="#3b82f6" />}
                        <Text style={styles.nestedHeaderText}>{z}</Text>
                        <View style={styles.badge}><Text style={styles.badgeText}>{data.categories?.length || 0} categories</Text></View>
                      </View>
                    </TouchableOpacity>
                    {isExpanded && (
                      <View style={styles.nestedBody}>
                        <Text style={styles.subLabel}>DEFECT CATEGORIES</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                            {DEFECT_CATEGORIES.map(cat => (
                                <TouchableOpacity 
                                    key={cat} 
                                    onPress={() => updateValue({ zoneData: { ...zoneData, [z]: { ...(zoneData[z] || {}), categories: data.categories?.includes(cat) ? data.categories.filter((c: any) => c !== cat) : [...(data.categories || []), cat] } } })}
                                    style={[styles.catChip, data.categories?.includes(cat) && styles.catChipActive]}
                                >
                                    <Text style={[styles.catChipText, data.categories?.includes(cat) && styles.catChipTextActive]}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        {data.categories?.map((cat: string) => (
                            <View key={cat} style={styles.specificBox}>
                                <View style={styles.specificHeader}><Layers size={14} color="#8b5cf6" /><Text style={styles.specificTitle}>{cat}</Text></View>
                                <TouchableOpacity style={styles.dropdownInput} onPress={() => setSubDefectModal({ mode: 'zone', id: z, cat: cat })}>
                                    <Text style={[styles.dropdownInputText, data.defects?.[cat]?.length > 0 && { color: '#1e293b', fontWeight: '800' }]}>
                                        {data.defects?.[cat]?.length > 0 ? `${data.defects[cat].length} selected` : "Select specific defects..."}
                                    </Text>
                                    <ChevronDown size={18} color="#94a3b8" />
                                </TouchableOpacity>

                                {data.defects?.[cat]?.map((def: any, idx: number) => {
                                    const defName = typeof def === 'string' ? def : def.name;
                                    const details = typeof def === 'string' ? { remark: "", evidence: "" } : def;
                                    const color = status === "Rejected" ? "#ef4444" : "#8b5cf6";
                                    return (
                                        <View key={defName} style={[styles.defectDetailCard, { borderLeftColor: color }]}>
                                            <View style={styles.defectDetailHeader}>
                                                <View style={[styles.defectDot, { backgroundColor: color }]} />
                                                <Text style={styles.defectDetailName}>{defName}</Text>
                                            </View>
                                            <View style={styles.defectDetailBody}>
                                                <View style={styles.remarkBox}>
                                                    <View style={styles.fieldLabelRow}><MessageSquare size={10} color="#94a3b8" /><Text style={styles.fieldLabel}>REMARK</Text></View>
                                                    <TextInput
                                                        style={styles.remarkInput}
                                                        placeholder="Add details about this defect..."
                                                        value={details.remark}
                                                        onChangeText={(txt) => updateDefectDetail('zone', z, cat, defName, { remark: txt })}
                                                        multiline
                                                    />
                                                </View>
                                                <View style={styles.evidenceBox}>
                                                    <View style={styles.fieldLabelRow}><ImageIcon size={10} color="#94a3b8" /><Text style={styles.fieldLabel}>EVIDENCE</Text></View>
                                                    <View style={styles.evidenceActions}>
                                                        {details.evidence ? (
                                                            <View style={styles.evidencePreview}>
                                                                <Image source={{ uri: getImageUrl(details.evidence) }} style={styles.evidenceThumb} />
                                                                <TouchableOpacity style={styles.removeEvidence} onPress={() => updateDefectDetail('zone', z, cat, defName, { evidence: "" })}>
                                                                    <X size={12} color="#fff" />
                                                                </TouchableOpacity>
                                                            </View>
                                                        ) : (
                                                            <>
                                                                <TouchableOpacity style={styles.miniActionBtn} onPress={() => setCameraVisible({ zone: z, cat, defect: defName, mode: 'zone' })}>
                                                                    <Camera size={14} color="#64748b" />
                                                                    <Text style={styles.miniActionText}>Camera</Text>
                                                                </TouchableOpacity>
                                                                <TouchableOpacity style={styles.miniActionBtn} onPress={async () => {
                                                                    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
                                                                    if (!res.canceled) updateDefectDetail('zone', z, cat, defName, { evidence: res.assets[0].uri });
                                                                }}>
                                                                    <Upload size={14} color="#64748b" />
                                                                    <Text style={styles.miniActionText}>Upload</Text>
                                                                </TouchableOpacity>
                                                            </>
                                                        )}
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          ) : (
            <View style={styles.section}>
              <Text style={styles.subLabel}>DEFECT CATEGORIES</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                  {DEFECT_CATEGORIES.map(cat => (
                      <TouchableOpacity 
                          key={cat} 
                          onPress={() => {
                              const next = rejectedCategories.includes(cat) ? rejectedCategories.filter((c: any) => c !== cat) : [...rejectedCategories, cat];
                              updateValue({ rejectedCategories: next });
                          }}
                          style={[styles.catChip, rejectedCategories.includes(cat) && styles.catChipActive]}
                      >
                          <Text style={[styles.catChipText, rejectedCategories.includes(cat) && styles.catChipTextActive]}>{cat}</Text>
                      </TouchableOpacity>
                  ))}
              </ScrollView>
              
              {rejectedCategories.map((cat: string) => (
                  <View key={cat} style={styles.specificBox}>
                      <View style={styles.specificHeader}><Layers size={14} color="#8b5cf6" /><Text style={styles.specificTitle}>{cat}</Text></View>
                      <TouchableOpacity style={styles.dropdownInput} onPress={() => setSubDefectModal({ mode: 'rejected', id: 'global', cat: cat })}>
                          <Text style={[styles.dropdownInputText, rejectedDefects[cat]?.length > 0 && { color: '#1e293b', fontWeight: '800' }]}>
                              {rejectedDefects[cat]?.length > 0 ? `${rejectedDefects[cat].length} selected` : "Select specific defects..."}
                          </Text>
                          <ChevronDown size={18} color="#94a3b8" />
                      </TouchableOpacity>

                      {rejectedDefects[cat]?.map((def: any) => {
                          const defName = typeof def === 'string' ? def : def.name;
                          const details = typeof def === 'string' ? { remark: "", evidence: "" } : def;
                          const color = status === "Rejected" ? "#ef4444" : "#f59e0b";
                          return (
                              <View key={defName} style={[styles.defectDetailCard, { borderLeftColor: color }]}>
                                  <View style={styles.defectDetailHeader}>
                                      <View style={[styles.defectDot, { backgroundColor: color }]} />
                                      <Text style={styles.defectDetailName}>{defName}</Text>
                                  </View>
                                  <View style={styles.defectDetailBody}>
                                      <View style={styles.remarkBox}>
                                          <TextInput
                                              style={styles.remarkInput}
                                              placeholder="Defect details..."
                                              value={details.remark}
                                              onChangeText={(txt) => updateDefectDetail('rejected', 'global', cat, defName, { remark: txt })}
                                              multiline
                                          />
                                      </View>
                                      <View style={styles.evidenceBox}>
                                          {details.evidence ? (
                                              <View style={styles.evidencePreview}>
                                                  <Image source={{ uri: getImageUrl(details.evidence) }} style={styles.evidenceThumb} />
                                                  <TouchableOpacity style={styles.removeEvidence} onPress={() => updateDefectDetail('rejected', 'global', cat, defName, { evidence: "" })}>
                                                      <X size={12} color="#fff" />
                                                  </TouchableOpacity>
                                              </View>
                                          ) : (
                                              <View style={styles.evidenceActions}>
                                                  <TouchableOpacity style={styles.miniActionBtn} onPress={() => setCameraVisible({ mode: 'rejected', zone: 'global', cat, defect: defName })}>
                                                      <Camera size={14} color="#64748b" />
                                                  </TouchableOpacity>
                                                  <TouchableOpacity style={styles.miniActionBtn} onPress={async () => {
                                                      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
                                                      if (!res.canceled) updateDefectDetail('rejected', 'global', cat, defName, { evidence: res.assets[0].uri });
                                                  }}>
                                                      <Upload size={14} color="#64748b" />
                                                  </TouchableOpacity>
                                              </View>
                                          )}
                                      </View>
                                  </View>
                              </View>
                          );
                      })}
                  </View>
              ))}
            </View>
          )}
        </>
      )}

      {/* SUB-DEFECT MODAL */}
      <Modal visible={!!subDefectModal} transparent animationType="slide">
          <Pressable style={styles.modalOverlay} onPress={() => setSubDefectModal(null)}>
              <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{subDefectModal?.cat}</Text>
                        <TouchableOpacity onPress={() => setSubDefectModal(null)}><X size={24} color="#64748b" /></TouchableOpacity>
                    </View>
                    <ScrollView style={styles.optionsScroll}>
                        {subDefectModal && SUB_DEFECTS[subDefectModal.cat]?.map((item) => {
                            const isSelected = subDefectModal.mode === 'zone' 
                                ? zoneData[subDefectModal.id]?.defects?.[subDefectModal.cat]?.some((d: any) => (typeof d === 'string' ? d === item : d.name === item))
                                : rejectedDefects[subDefectModal.cat]?.some((d: any) => (typeof d === 'string' ? d === item : d.name === item));
                            return (
                                <TouchableOpacity key={item} style={[styles.optionItem, isSelected && styles.optionItemSelected]} onPress={() => toggleSubDefect(subDefectModal.cat, item)}>
                                    <View style={[styles.checkbox, isSelected && styles.checkedBox]}>{isSelected && <Check size={14} color="#fff" />}</View>
                                    <Text style={[styles.optionItemText, isSelected && styles.optionItemTextActive]}>{item}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                    <TouchableOpacity style={styles.doneBtn} onPress={() => setSubDefectModal(null)}><Text style={styles.doneBtnText}>Confirm Selection</Text></TouchableOpacity>
              </View>
          </Pressable>
      </Modal>

      <InAppCamera 
        visible={!!cameraVisible} 
        onClose={() => setCameraVisible(false)} 
        onCapture={(uri) => {
            if (typeof cameraVisible === 'object') {
                updateDefectDetail(cameraVisible.mode, cameraVisible.zone || 'global', cameraVisible.cat, cameraVisible.defect, { evidence: uri });
            } else {
                updateValue({ evidencePhotos: [...evidencePhotos, uri] });
            }
            setCameraVisible(false);
        }} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 4 },
  section: { marginBottom: 20 },
  label: { fontSize: 9, fontWeight: '900', color: '#94a3b8', marginBottom: 12, letterSpacing: 1.5 },
  subLabel: { fontSize: 9, fontWeight: '800', color: '#64748b', marginBottom: 8, marginTop: 12, textTransform: 'uppercase' },
  iconLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  statusGrid: { flexDirection: 'row', gap: 10 },
  statusButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderWidth: 1, borderRadius: 16 },
  statusLabel: { marginTop: 6, fontSize: 10, fontWeight: '800' },
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  zoneGrid: { gap: 8 },
  zoneCard: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  zoneCardSelected: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  zoneText: { fontSize: 14, color: '#475569', fontWeight: '600' },
  zoneTextSelected: { color: '#1e3a8a', fontWeight: '800' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
  checkedBox: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  nestedGroup: { backgroundColor: '#f8fafc', borderRadius: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
  nestedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  nestedHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nestedHeaderText: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  badge: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 11, color: '#3b82f6', fontWeight: '700' },
  nestedBody: { padding: 16, paddingTop: 0 },
  catScroll: { flexDirection: 'row' },
  catChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8 },
  catChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  catChipText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  catChipTextActive: { color: '#fff', fontWeight: '800' },
  specificBox: { marginTop: 20, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: '#e2e8f0' },
  specificHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  specificTitle: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  dropdownInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, height: 46 },
  dropdownInputText: { fontSize: 13, color: '#94a3b8' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 40, maxHeight: height * 0.7 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  optionsScroll: { padding: 16 },
  optionItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, gap: 12, marginBottom: 4 },
  optionItemSelected: { backgroundColor: '#f8fafc' },
  optionItemText: { fontSize: 15, color: '#334155', fontWeight: '600' },
  optionItemTextActive: { color: '#1e3a8a', fontWeight: '800' },
  doneBtn: { backgroundColor: '#1e3a8a', margin: 24, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '800' },
  photoScroll: { flexDirection: 'row', marginBottom: 12 },
  photoBox: { marginRight: 8 },
  photo: { width: 50, height: 50, borderRadius: 10 },
  actionGrid: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#cbd5e1', borderRadius: 12 },
  actionText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  defectDetailCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 4, borderLeftColor: '#8b5cf6', overflow: 'hidden' },
  defectDetailHeader: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 8 },
  defectDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#8b5cf6' },
  defectDetailName: { fontSize: 11, fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' },
  defectDetailBody: { padding: 10, gap: 10 },
  remarkBox: { flex: 1 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  fieldLabel: { fontSize: 8, fontWeight: '900', color: '#94a3b8', letterSpacing: 1 },
  remarkInput: { fontSize: 11, color: '#334155', backgroundColor: '#f8fafc', borderRadius: 8, padding: 8, height: 60, textAlignVertical: 'top', borderWidth: 1, borderColor: '#f1f5f9' },
  evidenceBox: { flex: 1 },
  evidenceActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  evidencePreview: { position: 'relative' },
  evidenceThumb: { width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  removeEvidence: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  miniActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 40, borderWidth: 1, borderStyle: 'dashed', borderColor: '#cbd5e1', borderRadius: 8 },
  miniActionText: { fontSize: 10, fontWeight: '700', color: '#64748b' }
});
