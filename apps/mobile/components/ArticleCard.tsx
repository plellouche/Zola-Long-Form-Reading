import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { ArticleSummary } from '@/lib/types';

interface Props {
  article: ArticleSummary;
  onPress: () => void;
}

function sourceName(a: ArticleSummary): string {
  return a.source?.name ?? a.source_name ?? '';
}

function readingTime(a: ArticleSummary): string {
  const min = a.reading_time_minutes;
  if (!min) return '';
  return `${min} min`;
}

export function ArticleCard({ article, onPress }: Props) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      {article.og_image_url ? (
        <Image
          source={{ uri: article.og_image_url }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: colors.primary + '22' }]}>
          <Text style={[styles.placeholderLetter, { color: colors.primary }]}>
            {(sourceName(article) || article.title)[0]?.toUpperCase() ?? 'Z'}
          </Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.meta}>
          {sourceName(article) ? (
            <Text
              style={[styles.source, { color: colors.accent }]}
              numberOfLines={1}
            >
              {sourceName(article).toUpperCase()}
            </Text>
          ) : null}
          {readingTime(article) ? (
            <Text style={[styles.readTime, { color: colors.mutedForeground }]}>
              {readingTime(article)}
            </Text>
          ) : null}
        </View>

        <Text
          style={[styles.title, { color: colors.foreground }]}
          numberOfLines={3}
        >
          {article.title}
        </Text>

        {article.description ? (
          <Text
            style={[styles.description, { color: colors.mutedForeground }]}
            numberOfLines={2}
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
  image: {
    width: '100%',
    height: 180,
  },
  imagePlaceholder: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderLetter: {
    fontSize: 48,
    fontFamily: 'Spectral_600SemiBold',
    opacity: 0.5,
  },
  body: {
    padding: 14,
    gap: 6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  source: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
  },
  readTime: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  title: {
    fontSize: 17,
    fontFamily: 'Spectral_600SemiBold',
    lineHeight: 23,
  },
  description: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
  },
  author: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
});
