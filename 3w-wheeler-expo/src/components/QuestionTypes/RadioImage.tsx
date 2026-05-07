import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { BASE_URL } from '../../api/config';

const { width } = Dimensions.get('window');

// Helper to normalize image URLs
const getImageUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('file:')) return url;
  return `${BASE_URL}/files/${url}`;
};

interface RadioImageProps {
  question: any;
  value: any;
  onChange: (value: any) => void;
  readOnly?: boolean;
}

export default function RadioImageQuestion({
  question,
  value,
  onChange,
  readOnly = false,
}: RadioImageProps) {
  const options = question.options || [];
  
  // Note: question.options in radio-image might be objects {label, imageUrl} 
  // or strings if images are handled differently.
  // In our backend, it's often just strings or we might have imageUrls in a separate field.
  // Let's assume options are strings and we might have a mapped imageUrls object or similar.
  // For now, let's look for a pattern where each option might be JSON or has a convention.
  
  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {options.map((option: any, index: number) => {
          let label = option;
          let imageUrl = '';
          
          if (typeof option === 'object') {
            label = option.label || `Option ${index + 1}`;
            imageUrl = option.imageUrl || '';
          } else if (typeof option === 'string' && option.startsWith('{')) {
            try {
              const parsed = JSON.parse(option);
              label = parsed.label || parsed.text || option;
              imageUrl = parsed.imageUrl || parsed.image || '';
            } catch (e) {
              label = option;
            }
          }

          const isSelected = value === label;

          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.7}
              disabled={readOnly}
              onPress={() => onChange(label)}
              style={[
                styles.card,
                isSelected && styles.cardSelected,
                readOnly && styles.disabled
              ]}
            >
              <View style={styles.imageContainer}>
                {imageUrl ? (
                  <Image source={{ uri: getImageUrl(imageUrl) }} style={styles.image} resizeMode="cover" />
                ) : (
                  <View style={styles.placeholder}>
                    <Text style={styles.placeholderText}>{label.charAt(0)}</Text>
                  </View>
                )}
                {isSelected && (
                  <View style={styles.selectedBadge}>
                    <CheckCircle2 size={16} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={[styles.label, isSelected && styles.labelSelected]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: (width - 64) / 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
    padding: 8,
  },
  cardSelected: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  disabled: { opacity: 0.6 },
  imageContainer: { width: '100%', height: 120, borderRadius: 10, backgroundColor: '#f8fafc', overflow: 'hidden', position: 'relative' },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 32, fontWeight: '800', color: '#cbd5e1' },
  selectedBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#3b82f6', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: 8, fontSize: 13, fontWeight: '700', color: '#64748b', textAlign: 'center' },
  labelSelected: { color: '#1e3a8a' },
});
