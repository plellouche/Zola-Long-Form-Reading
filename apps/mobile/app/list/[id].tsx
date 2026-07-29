import React from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArticleCard } from '@/components/ArticleCard';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonList } from '@/components/SkeletonCard';
import { useColors } from '@/hooks/useColors';
import { getList } from '@/lib/api';
import type { ReadingListItem } from '@/lib/types';

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const listQuery = useQuery({
    queryKey: ['list', id],
    queryFn: () => getList(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });

  const list = listQuery.data?.list;
  const items = listQuery.data?.items ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 6,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.listName, { color: colors.foreground }]} numberOfLines={1}>
            {list?.name ?? 'List'}
          </Text>
          {list?.description ? (
            <Text style={[styles.listDesc, { color: colors.mutedForeground }]} numberOfLines={1}>
              {list.description}
            </Text>
          ) : null}
        </View>
        {!list?.is_public && <Feather name="lock" size={14} color={colors.mutedForeground} />}
      </View>

      {/* Content */}
      {listQuery.isLoading ? (
        <View style={{ marginTop: 8 }}>
          <SkeletonList count={4} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title="This list is empty"
          subtitle="Save articles to this list from the article detail view"
        />
      ) : (
        <FlatList<ReadingListItem>
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <ArticleCard
              article={item.article}
              onPress={() => router.push(`/article/${item.article_id}`)}
            />
          )}
          contentContainerStyle={{
            paddingVertical: 8,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0),
          }}
          ListHeaderComponent={
            items.length > 0 ? (
              <Text style={[styles.count, { color: colors.mutedForeground }]}>
                {items.length} article{items.length !== 1 ? 's' : ''}
              </Text>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={listQuery.isFetching}
              onRefresh={() => listQuery.refetch()}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerText: { flex: 1 },
  listName: { fontSize: 17, fontFamily: 'Spectral_600SemiBold' },
  listDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  count: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
});
