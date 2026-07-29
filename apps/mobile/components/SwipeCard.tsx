import React, { useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { ArticleSummary } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;
const SWIPE_OUT_DURATION = 220;

interface Props {
  article: ArticleSummary;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  onPress: () => void;
  stackIndex: number; // 0 = top, 1 = behind, 2 = further behind
}

function sourceName(a: ArticleSummary): string {
  return a.source?.name ?? a.source_name ?? '';
}

export function SwipeCard({
  article,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onPress,
  stackIndex,
}: Props) {
  const colors = useColors();
  const position = useRef(new Animated.ValueXY()).current;
  const isTop = stackIndex === 0;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isTop,
      onMoveShouldSetPanResponder: () => isTop,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          forceSwipe('right');
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          forceSwipe('left');
        } else if (gesture.dy < -SWIPE_THRESHOLD) {
          forceSwipe('up');
        } else {
          resetPosition();
        }
      },
    }),
  ).current;

  const forceSwipe = (direction: 'left' | 'right' | 'up') => {
    const x =
      direction === 'right'
        ? SCREEN_WIDTH * 1.5
        : direction === 'left'
          ? -SCREEN_WIDTH * 1.5
          : 0;
    const y = direction === 'up' ? -SCREEN_WIDTH * 1.5 : 0;
    Animated.timing(position, {
      toValue: { x, y },
      duration: SWIPE_OUT_DURATION,
      useNativeDriver: true,
    }).start(() => {
      if (direction === 'right') onSwipeRight();
      else if (direction === 'left') onSwipeLeft();
      else onSwipeUp();
    });
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
    }).start();
  };

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-12deg', '0deg', '12deg'],
    extrapolate: 'clamp',
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 4, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, SCREEN_WIDTH / 4],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const saveOpacity = position.y.interpolate({
    inputRange: [-SCREEN_WIDTH / 4, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const cardScale = stackIndex === 0 ? 1 : stackIndex === 1 ? 0.95 : 0.9;
  const cardTranslateY = stackIndex === 0 ? 0 : stackIndex === 1 ? 10 : 20;

  const animatedStyle = isTop
    ? {
        transform: [
          { translateX: position.x },
          { translateY: position.y },
          { rotate },
        ],
      }
    : {
        transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
      };

  return (
    <Animated.View
      style={[styles.card, animatedStyle, { zIndex: 10 - stackIndex }]}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      <Pressable onPress={isTop ? onPress : undefined} style={styles.inner}>
        {/* Image */}
        {article.og_image_url ? (
          <Image
            source={{ uri: article.og_image_url }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.primary }]}>
            <Text style={styles.placeholderLetter}>
              {(sourceName(article) || article.title)[0]?.toUpperCase() ?? 'Z'}
            </Text>
          </View>
        )}

        {/* Swipe indicators */}
        {isTop && (
          <>
            <Animated.View style={[styles.badgeNope, { opacity: nopeOpacity }]}>
              <Text style={styles.badgeNopeText}>SKIP</Text>
            </Animated.View>
            <Animated.View style={[styles.badgeLike, { opacity: likeOpacity }]}>
              <Text style={styles.badgeLikeText}>SAVE</Text>
            </Animated.View>
            <Animated.View style={[styles.badgeSave, { opacity: saveOpacity }]}>
              <Text style={styles.badgeSaveText}>READING LIST</Text>
            </Animated.View>
          </>
        )}

        {/* Content */}
        <View style={[styles.content, { backgroundColor: colors.background }]}>
          <View style={styles.metaRow}>
            {sourceName(article) ? (
              <Text style={[styles.source, { color: colors.accent }]}>
                {sourceName(article).toUpperCase()}
              </Text>
            ) : null}
            {article.reading_time_minutes ? (
              <Text style={[styles.readTime, { color: colors.mutedForeground }]}>
                {article.reading_time_minutes} min
              </Text>
            ) : null}
          </View>

          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={3}>
            {article.title}
          </Text>

          {article.description ? (
            <Text
              style={[styles.description, { color: colors.mutedForeground }]}
              numberOfLines={3}
            >
              {article.description}
            </Text>
          ) : null}

          {article.author ? (
            <Text style={[styles.author, { color: colors.mutedForeground }]}>
              {article.author}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: SCREEN_WIDTH - 32,
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  inner: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: 240,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderLetter: {
    fontSize: 64,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Spectral_600SemiBold',
  },
  content: {
    padding: 16,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  source: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
  },
  readTime: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Spectral_600SemiBold',
    lineHeight: 26,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  author: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  badgeNope: {
    position: 'absolute',
    top: 20,
    right: 20,
    borderWidth: 3,
    borderColor: '#ef4444',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    transform: [{ rotate: '15deg' }],
  },
  badgeNopeText: {
    color: '#ef4444',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  badgeLike: {
    position: 'absolute',
    top: 20,
    left: 20,
    borderWidth: 3,
    borderColor: '#40916C',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    transform: [{ rotate: '-15deg' }],
  },
  badgeLikeText: {
    color: '#40916C',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  badgeSave: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    borderWidth: 3,
    borderColor: '#22577A',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeSaveText: {
    color: '#22577A',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
});
