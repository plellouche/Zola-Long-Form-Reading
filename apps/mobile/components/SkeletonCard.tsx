import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

function SkeletonLine({ width, height = 14 }: { width: string | number; height?: number }) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: 6,
        backgroundColor: colors.muted,
        opacity,
      }}
    />
  );
}

export function SkeletonCard() {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.imagePh, { backgroundColor: colors.muted }]} />
      <View style={styles.body}>
        <SkeletonLine width="40%" height={10} />
        <SkeletonLine width="95%" height={16} />
        <SkeletonLine width="85%" height={16} />
        <SkeletonLine width="70%" height={12} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 6,
    overflow: 'hidden',
  },
  imagePh: {
    width: '100%',
    height: 140,
  },
  body: {
    padding: 14,
    gap: 10,
  },
});
