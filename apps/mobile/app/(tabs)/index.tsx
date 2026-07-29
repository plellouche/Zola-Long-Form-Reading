import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArticleCard } from '@/components/ArticleCard';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonList } from '@/components/SkeletonCard';
import { SwipeCard } from '@/components/SwipeCard';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { getArticles, getDiscoverDeck, getFeed, postSwipe } from '@/lib/api';
import type { ArticleSummary } from '@/lib/types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_STACK_HEIGHT = Math.min(SCREEN_HEIGHT * 0.62, 520);

type Tab = 'feed' | 'deck';

export default function DiscoverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('feed');
  const [deckCards, setDeckCards] = useState<ArticleSummary[]>([]);
  const deckInitialized = useRef(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  // Feed query — uses personalized /api/feed when signed in, public /api/articles otherwise
  const feedQuery = useQuery({
    queryKey: ['feed', !!session],
    queryFn: () => (session ? getFeed(30) : getArticles({ sort: 'newest', limit: 30 }).then((r) => r.items)),
    enabled: tab === 'feed',
    staleTime: 2 * 60 * 1000,
  });

  // Deck query
  const deckQuery = useQuery({
    queryKey: ['deck'],
    queryFn: () => getDiscoverDeck(25),
    enabled: !!session && tab === 'deck',
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (deckQuery.data && !deckInitialized.current) {
      setDeckCards(deckQuery.data);
      deckInitialized.current = true;
    }
  }, [deckQuery.data]);

  const swipeMutation = useMutation({
    mutationFn: postSwipe,
  });

  const handleSwipe = useCallback(
    (article: ArticleSummary, direction: 'left' | 'right' | 'up') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      swipeMutation.mutate({ article_id: article.id, direction });
      setDeckCards((prev) => prev.filter((a) => a.id !== article.id));
      // Refetch when running low
      if (deckCards.length <= 3) {
        deckInitialized.current = false;
        qc.invalidateQueries({ queryKey: ['deck'] });
      }
    },
    [deckCards.length, swipeMutation, qc],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 10, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.wordmark, { color: colors.primary }]}>Zola</Text>

        {/* Tab switcher */}
        <View style={[styles.tabRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Pressable
            onPress={() => setTab('feed')}
            style={[
              styles.tabBtn,
              tab === 'feed' && [styles.tabBtnActive, { backgroundColor: colors.background }],
            ]}
          >
            <Text
              style={[
                styles.tabBtnText,
                { color: tab === 'feed' ? colors.foreground : colors.mutedForeground },
              ]}
            >
              For You
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('deck')}
            style={[
              styles.tabBtn,
              tab === 'deck' && [styles.tabBtnActive, { backgroundColor: colors.background }],
            ]}
          >
            <Text
              style={[
                styles.tabBtnText,
                { color: tab === 'deck' ? colors.foreground : colors.mutedForeground },
              ]}
            >
              Discover
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Feed view */}
      {tab === 'feed' && (
        <>
          {feedQuery.isLoading ? (
            <View style={{ marginTop: 8 }}>
              <SkeletonList count={4} />
            </View>
          ) : feedQuery.isError ? (
            <EmptyState
              icon="alert-circle"
              title="Couldn't load feed"
              actionLabel="Retry"
              onAction={() => feedQuery.refetch()}
            />
          ) : !feedQuery.data || feedQuery.data.length === 0 ? (
            <EmptyState
              icon="book-open"
              title="Your feed is empty"
              subtitle="Browse articles and save some to build your taste profile"
              actionLabel="Browse Articles"
              onAction={() => router.push('/browse')}
            />
          ) : (
            <FlatList<ArticleSummary>
              data={feedQuery.data}
              keyExtractor={(a) => a.id}
              ListHeaderComponent={
                !session ? (
                  <Pressable
                    onPress={() => router.push('/auth/login')}
                    style={[styles.signInBanner, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}
                  >
                    <Text style={[styles.signInBannerText, { color: colors.primary }]}>
                      Sign in for a personalised feed based on your reading history →
                    </Text>
                  </Pressable>
                ) : null
              }
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
                  refreshing={feedQuery.isFetching}
                  onRefresh={() => feedQuery.refetch()}
                  tintColor={colors.primary}
                />
              }
            />
          )}
        </>
      )}

      {/* Deck / swipe view */}
      {tab === 'deck' && (
        <View style={styles.deckContainer}>
          {deckQuery.isLoading ? (
            <View style={[styles.deckLoading]}>
              <Text style={[styles.deckLoadingText, { color: colors.mutedForeground }]}>
                Loading articles…
              </Text>
            </View>
          ) : deckCards.length === 0 ? (
            <EmptyState
              icon="check-circle"
              title="You've seen everything!"
              subtitle="Come back later for fresh recommendations"
              actionLabel="Refresh"
              onAction={() => {
                deckInitialized.current = false;
                qc.invalidateQueries({ queryKey: ['deck'] });
              }}
            />
          ) : (
            <>
              <View style={[styles.deck, { height: CARD_STACK_HEIGHT }]}>
                {/* Render up to 3 cards (bottom to top so top card is on top) */}
                {deckCards
                  .slice(0, 3)
                  .reverse()
                  .map((article, reverseIdx) => {
                    const stackIndex = 2 - reverseIdx; // 0=top, 1=mid, 2=back
                    return (
                      <SwipeCard
                        key={article.id}
                        article={article}
                        stackIndex={stackIndex}
                        onSwipeLeft={() => handleSwipe(article, 'left')}
                        onSwipeRight={() => handleSwipe(article, 'right')}
                        onSwipeUp={() => handleSwipe(article, 'up')}
                        onPress={() => router.push(`/article/${article.id}`)}
                      />
                    );
                  })}
              </View>

              {/* Swipe hints */}
              <View style={styles.hints}>
                <View style={styles.hint}>
                  <Text style={[styles.hintIcon, { color: '#ef4444' }]}>←</Text>
                  <Text style={[styles.hintLabel, { color: colors.mutedForeground }]}>Skip</Text>
                </View>
                <View style={styles.hint}>
                  <Text style={[styles.hintIcon, { color: colors.primary }]}>↑</Text>
                  <Text style={[styles.hintLabel, { color: colors.mutedForeground }]}>Save</Text>
                </View>
                <View style={styles.hint}>
                  <Text style={[styles.hintIcon, { color: colors.accent }]}>→</Text>
                  <Text style={[styles.hintLabel, { color: colors.mutedForeground }]}>Interested</Text>
                </View>
              </View>

              <Text style={[styles.remaining, { color: colors.mutedForeground }]}>
                {deckCards.length} article{deckCards.length !== 1 ? 's' : ''} remaining
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  brandHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  wordmark: {
    fontSize: 28,
    fontFamily: 'Spectral_600SemiBold',
    letterSpacing: -0.5,
  },
  tabRow: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    alignSelf: 'flex-start',
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  tabBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  deckContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  deck: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  deckLoading: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckLoadingText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  hints: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 20,
  },
  hint: { alignItems: 'center', gap: 2 },
  hintIcon: { fontSize: 22, fontFamily: 'Inter_600SemiBold' },
  hintLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  remaining: {
    marginTop: 12,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  browseHint: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 20,
    borderTopWidth: 1,
  },
  browseHintText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  browseLink: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  signInBanner: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  signInBannerText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    lineHeight: 18,
  },
});
