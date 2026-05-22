import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions, Image, Text } from 'react-native';

const SplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800, // Reduced from 1500
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6, // Adjusted for slightly snappier feel
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(onFinish, 300); // Reduced from 1000
    });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Image 
          source={require('../../assets/logo.jpeg')} 
          style={styles.logo} 
          resizeMode="contain" 
        />
        <View style={styles.textContainer}>
          <Text style={styles.projectTitle}>THREE-WHEELERS PROJECT</Text>
          <View style={styles.line} />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    gap: 20,
  },
  logo: {
    width: Dimensions.get('window').width * 0.7,
    height: 150,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: -20,
  },
  projectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e3a8a', // Deep blue matching the logo
    letterSpacing: 2,
    marginTop: 10,
  },
  line: {
    width: 100,
    height: 3,
    backgroundColor: '#3b82f6',
    marginTop: 8,
    borderRadius: 2,
  }
});

export default SplashScreen;
