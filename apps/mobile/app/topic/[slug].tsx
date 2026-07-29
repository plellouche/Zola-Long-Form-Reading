import React from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArticleCard } from '@/components/ArticleCard';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonList } from '@/components/SkeletonCard';
import { useColors } from '@/hooks/useColors';
import { getArticles } from '@/lib/api';
import type { ArticleSummary } from '@/lib/types';

export default function TopicScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const articlesQuery = useQuery({
    queryKey: ['articles', 'topic', slug],
    queryFn: () => getArticles({ topic_slug: slug, sort: 'mixed', limit: 30 }),
    enabled: !!slug,
    staleTime: 60 * 1000,
  });

  const articles = articlesQuery.data?.items ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.topBar,
          { paddingTop: topPad + 6, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {slug ? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ') : 'Topic'}
        </Text>
      </View>

      {articlesQuery.isLoading ? (
        <View style={{ marginTop: 8 }}><SkeletonList count={4} /></View>
      ) : articles.length === 0 ? (
        <EmptyState icon="tag" title="No articles" subtitle="No articles found for this topic yet" />
      ) : (
        <FlatList<ArticleSummary>
          data={articles}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <ArticleCard article={item} onPress={() => router.push(`/article/${item.id}`)} />
          )}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) }}
          refreshControl={<RefreshControl refreshing={articlesQuery.isFetching} onRefresh={() => articlesQuery.refetch()} tintColor={colors.primary} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, fontFamily: 'Spectral_600SemiBold', flex: 1 },
});
