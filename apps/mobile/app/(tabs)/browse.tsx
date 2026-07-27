import React, { useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArticleCard } from '@/components/ArticleCard';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonList } from '@/components/SkeletonCard';
import { TopicChip } from '@/components/TopicChip';
import { useColors } from '@/hooks/useColors';
import { getArticles, getTopics } from '@/lib/api';
import type { ArticleSummary, Topic } from '@/lib/types';

const SORTS = [
  { key: 'mixed', label: 'Mixed' },
  { key: 'newest', label: 'Newest' },
  { key: 'popular', label: 'Popular' },
  { key: 'reading_time_asc', label: 'Short reads' },
];

export default function BrowseScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [sort, setSort] = useState('mixed');

  const topicsQuery = useQuery({
    queryKey: ['topics'],
    queryFn: getTopics,
    staleTime: 5 * 60 * 1000,
  });

  const articlesQuery = useQuery({
    queryKey: ['articles', sort, selectedTopic?.slug],
    queryFn: () =>
      getArticles({
        sort,
        limit: 30,
        topic_slug: selectedTopic?.slug,
      }),
    staleTime: 60 * 1000,
  });

  const articles = articlesQuery.data?.items ?? [];
  const isLoading = articlesQuery.isLoading;

  const topPad = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sticky filter header */}
      <View
        style={[
          styles.filterHeader,
          { backgroundColor: colors.background, borderBottomColor: colors.border, paddingTop: topPad + 8 },
        ]}
      >
        {/* Sort row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {SORTS.map((s) => (
            <TopicChip
              key={s.key}
              label={s.label}
              selected={sort === s.key}
              onPress={() => setSort(s.key)}
            />
          ))}
        </ScrollView>

        {/* Topics row */}
        {topicsQuery.data && topicsQuery.data.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <TopicChip
              label="All topics"
              selected={selectedTopic === null}
              onPress={() => setSelectedTopic(null)}
              small
            />
            {topicsQuery.data.map((t) => (
              <TopicChip
                key={t.id}
                label={t.name}
                selected={selectedTopic?.id === t.id}
                onPress={() =>
                  setSelectedTopic((prev) => (prev?.id === t.id ? null : t))
                }
                small
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Article list */}
      {isLoading ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
          <SkeletonList count={5} />
        </ScrollView>
      ) : articles.length === 0 ? (
        <EmptyState
          icon="file-text"
          title="No articles found"
          subtitle="Try a different topic or sort order"
        />
      ) : (
        <FlatList<ArticleSummary>
          data={articles}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <ArticleCard
              article={item}
              onPress={() => router.push(`/article/${item.id}`)}
            />
          )}
          contentContainerStyle={{
            paddingVertical: 8,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0),
          }}
          refreshControl={
            <RefreshControl
              refreshing={articlesQuery.isFetching}
              onRefresh={() => articlesQuery.refetch()}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterHeader: {
    borderBottomWidth: 1,
    paddingBottom: 8,
    gap: 6,
  },
  chipRow: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
