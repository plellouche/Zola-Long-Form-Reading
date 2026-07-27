import React, { useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArticleCard } from '@/components/ArticleCard';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonList } from '@/components/SkeletonCard';
import { useColors } from '@/hooks/useColors';
import { searchArticles } from '@/lib/api';
import type { ArticleSummary } from '@/lib/types';

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');

  const searchQuery = useQuery({
    queryKey: ['search', submitted],
    queryFn: () => searchArticles(submitted),
    enabled: submitted.length > 0,
    staleTime: 60 * 1000,
  });

  const topPad = Platform.OS === 'web' ? 67 : 0;

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (trimmed) setSubmitted(trimmed);
  };

  const handleClear = () => {
    setQuery('');
    setSubmitted('');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search bar */}
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            paddingTop: topPad + 10,
          },
        ]}
      >
        <View
          style={[
            styles.inputRow,
            { backgroundColor: colors.muted, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Search essays, authors, topics…"
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={handleClear} hitSlop={8}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Results */}
      {!submitted ? (
        <EmptyState
          icon="search"
          title="Search Zola"
          subtitle="Find essays, articles, and long reads by title, author, or topic"
        />
      ) : searchQuery.isLoading ? (
        <View style={{ marginTop: 8 }}>
          <SkeletonList count={4} />
        </View>
      ) : searchQuery.isError ? (
        <EmptyState
          icon="alert-circle"
          title="Search failed"
          subtitle="Check your connection and try again"
          actionLabel="Retry"
          onAction={() => searchQuery.refetch()}
        />
      ) : !searchQuery.data || searchQuery.data.length === 0 ? (
        <EmptyState
          icon="file-text"
          title={`No results for "${submitted}"`}
          subtitle="Try different keywords or a broader search"
        />
      ) : (
        <FlatList<ArticleSummary>
          data={searchQuery.data}
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
          ListHeaderComponent={
            <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
              {searchQuery.data.length} result{searchQuery.data.length !== 1 ? 's' : ''} for &quot;
              {submitted}&quot;
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    padding: 0,
  },
  resultCount: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
});
