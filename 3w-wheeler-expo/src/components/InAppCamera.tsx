import React, { useState, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, Camera, RefreshCw, Zap, ZapOff } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

interface InAppCameraProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (uri: string) => void;
}

export default function InAppCamera({ visible, onClose, onCapture }: InAppCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const cameraRef = useRef<any>(null);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="fade">
        <SafeAreaView style={styles.permissionContainer}>
          <Text style={styles.permissionText}>We need your permission to show the camera</Text>
          <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn}>
             <Text style={styles.permissionBtnText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X color="#fff" size={32} />
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        onCapture(photo.uri);
      } catch (e) {
        console.error('Capture error:', e);
      }
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.cameraBox}>
            <View style={styles.cameraContainer}>
                <CameraView 
                    style={StyleSheet.absoluteFill} 
                    facing={facing} 
                    flash={flash}
                    ref={cameraRef}
                />
                
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
                        <X color="#fff" size={24} />
                    </TouchableOpacity>
                    <View style={styles.windowLabel}>
                        <Camera color="#fff" size={14} />
                        <Text style={styles.windowLabelText}>CAPTURE EVIDENCE</Text>
                    </View>
                    <TouchableOpacity onPress={() => setFlash(f => f === 'off' ? 'on' : 'off')} style={styles.iconBtn}>
                        {flash === 'on' ? <Zap color="#facc15" size={20} fill="#facc15" /> : <ZapOff color="#fff" size={20} />}
                    </TouchableOpacity>
                </View>

                {/* Corner Guides for Square View */}
                <View style={styles.cornerTL} />
                <View style={styles.cornerTR} />
                <View style={styles.cornerBL} />
                <View style={styles.cornerBR} />
            </View>

            <View style={styles.bottomBar}>
                <TouchableOpacity onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')} style={styles.secondaryBtn}>
                    <RefreshCw color="#475569" size={24} />
                </TouchableOpacity>
                <TouchableOpacity onPress={takePicture} style={styles.captureBtn}>
                    <View style={styles.captureInner} />
                </TouchableOpacity>
                <View style={styles.placeholder} />
            </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'center', alignItems: 'center' },
  cameraBox: { width: width, backgroundColor: '#fff', overflow: 'hidden', elevation: 20 },
  cameraContainer: { width: width, height: width, backgroundColor: '#000', position: 'relative' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.3)' },
  windowLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  windowLabelText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 30, paddingHorizontal: 40, backgroundColor: '#fff' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  secondaryBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  captureBtn: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  captureInner: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#3b82f6' },
  placeholder: { width: 56 },
  // Corner Guides
  cornerTL: { position: 'absolute', top: 20, left: 20, width: 30, height: 30, borderLeftWidth: 3, borderTopWidth: 3, borderColor: 'rgba(255,255,255,0.6)', borderTopLeftRadius: 10 },
  cornerTR: { position: 'absolute', top: 20, right: 20, width: 30, height: 30, borderRightWidth: 3, borderTopWidth: 3, borderColor: 'rgba(255,255,255,0.6)', borderTopRightRadius: 10 },
  cornerBL: { position: 'absolute', bottom: 20, left: 20, width: 30, height: 30, borderLeftWidth: 3, borderBottomWidth: 3, borderColor: 'rgba(255,255,255,0.6)', borderBottomLeftRadius: 10 },
  cornerBR: { position: 'absolute', bottom: 20, right: 20, width: 30, height: 30, borderRightWidth: 3, borderBottomWidth: 3, borderColor: 'rgba(255,255,255,0.6)', borderBottomRightRadius: 10 },
  permissionContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 20 },
  permissionText: { color: '#fff', fontSize: 18, textAlign: 'center', marginBottom: 20 },
  permissionBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  permissionBtnText: { color: '#fff', fontWeight: '700' },
  closeBtn: { position: 'absolute', top: 50, right: 20 }
});
