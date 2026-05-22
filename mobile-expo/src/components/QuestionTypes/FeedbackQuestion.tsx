import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Star, Smile, Meh, Frown, ThumbsUp, ThumbsDown } from 'lucide-react-native';

interface FeedbackProps {
  type: 'emoji-star' | 'emoji-reaction' | 'satisfaction' | 'rating-number';
  question: any;
  value: any;
  onChange: (value: any) => void;
  readOnly?: boolean;
}

export default function FeedbackQuestion({
  type,
  question,
  value,
  onChange,
  readOnly = false,
}: FeedbackProps) {
  
  const renderStarRating = () => {
    return (
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((num) => (
          <TouchableOpacity
            key={num}
            onPress={() => onChange(String(num))}
            disabled={readOnly}
            style={styles.starBtn}
          >
            <Star 
              size={32} 
              color={Number(value) >= num ? '#facc15' : '#e2e8f0'} 
              fill={Number(value) >= num ? '#facc15' : 'transparent'} 
            />
            <Text style={[styles.starNum, Number(value) >= num && styles.starNumActive]}>{num}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderEmojiReaction = () => {
    const reactions = [
      { id: '1', label: 'Poor', icon: Frown, color: '#ef4444' },
      { id: '3', label: 'Neutral', icon: Meh, color: '#f59e0b' },
      { id: '5', label: 'Great', icon: Smile, color: '#10b981' }
    ];

    return (
      <View style={styles.reactionRow}>
        {reactions.map((r) => {
          const isSelected = value === r.id;
          const Icon = r.icon;
          return (
            <TouchableOpacity
              key={r.id}
              onPress={() => onChange(r.id)}
              disabled={readOnly}
              style={[styles.reactionBtn, isSelected && { backgroundColor: r.color + '15', borderColor: r.color }]}
            >
              <Icon size={32} color={isSelected ? r.color : '#cbd5e1'} />
              <Text style={[styles.reactionLabel, isSelected && { color: r.color }]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderSatisfaction = () => {
    const levels = ['Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very Satisfied'];
    return (
      <View style={styles.satisfactionCol}>
        {levels.map((level, index) => {
          const isSelected = value === level;
          return (
            <TouchableOpacity
              key={level}
              onPress={() => onChange(level)}
              disabled={readOnly}
              style={[styles.satisfactionBtn, isSelected && styles.satisfactionBtnActive]}
            >
              <View style={[styles.radio, isSelected && styles.radioActive]}>
                {isSelected && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.satisfactionText, isSelected && styles.satisfactionTextActive]}>{level}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderRatingNumber = () => {
    return (
      <View style={styles.numberGrid}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
          const isSelected = String(value) === String(num);
          return (
            <TouchableOpacity
              key={num}
              onPress={() => onChange(String(num))}
              disabled={readOnly}
              style={[styles.numberBtn, isSelected && styles.numberBtnActive]}
            >
              <Text style={[styles.numberText, isSelected && styles.numberTextActive]}>{num}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {type === 'emoji-star' && renderStarRating()}
      {type === 'emoji-reaction' && renderEmojiReaction()}
      {type === 'satisfaction' && renderSatisfaction()}
      {type === 'rating-number' && renderRatingNumber()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 8 },
  starRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  starBtn: { alignItems: 'center', gap: 6 },
  starNum: { fontSize: 12, fontWeight: '700', color: '#cbd5e1' },
  starNumActive: { color: '#facc15' },
  reactionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  reactionBtn: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 16, borderWidth: 2, borderColor: '#f1f5f9', backgroundColor: '#fff' },
  reactionLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', marginTop: 8, textTransform: 'uppercase' },
  satisfactionCol: { gap: 8 },
  satisfactionBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f1f5f9' },
  satisfactionBtnActive: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1', marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: '#3b82f6' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6' },
  satisfactionText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  satisfactionTextActive: { color: '#1e3a8a', fontWeight: '700' },
  numberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  numberBtn: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  numberBtnActive: { backgroundColor: '#1e3a8a', borderColor: '#1e3a8a' },
  numberText: { fontSize: 16, fontWeight: '700', color: '#64748b' },
  numberTextActive: { color: '#fff' }
});
