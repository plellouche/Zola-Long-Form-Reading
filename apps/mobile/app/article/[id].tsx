import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopicChip } from '@/components/TopicChip';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { addToList, getArticle, getLists, markArticleFinished } from '@/lib/api';
import {
  cancelReadReminder,
  hasActiveReminder,
  scheduleReadReminder,
} from '@/lib/notifications';

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const qc = useQueryClient();
  const [showListPicker, setShowListPicker] = useState(false);
  const [markedRead, setMarkedRead] = useState(false);
  const [reminderSet, setReminderSet] = useState(false);

  const articleQuery = useQuery({
    queryKey: ['article', id],
    queryFn: () => getArticle(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const listsQuery = useQuery({
    queryKey: ['lists'],
    queryFn: getLists,
    enabled: !!session && showListPicker,
    staleTime: 30 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: ({ listId }: { listId: string }) =>
      addToList(listId, id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowListPicker(false);
    },
    onError: (e) => Alert.alert('Error', (e as Error).message),
  });

  const markReadMutation = useMutation({
    mutationFn: () => markArticleFinished(id),
    onSuccess: () => {
      setMarkedRead(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const article = articleQuery.data;
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  // Check if a reminder is already scheduled for this article
  useEffect(() => {
    if (!id || Platform.OS === 'web') return;
    hasActiveReminder(id).then(setReminderSet);
  }, [id]);

  const openArticle = async () => {
    if (!article?.canonical_url) return;
    await WebBrowser.openBrowserAsync(article.canonical_url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
  };

  const handleReminder = async () => {
    if (!article) return;

    if (reminderSet) {
      await cancelReadReminder(id);
      setReminderSet(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Reminder cancelled', 'We removed your reading reminder.');
    } else {
      try {
        await scheduleReadReminder({
          id,
          title: article.title,
          source_name: article.source?.name ?? article.source_name ?? undefined,
        });
        setReminderSet(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Reminder set ✓',
          "We'll remind you to finish this article in 3 hours.",
        );
      } catch {
        Alert.alert(
          'Notifications blocked',
          'Enable notifications in your device settings to set reading reminders.',
        );
      }
    }
  };

  const sourceName = article?.source?.name ?? article?.source_name ?? '';

  if (articleQuery.isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading…</Text>
      </View>
    );
  }

  if (!article) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          Article not found
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back header */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: topPad + 6,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.topBarActions}>
          {session && !markedRead && (
            <Pressable
              onPress={() => markReadMutation.mutate()}
              style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
              hitSlop={8}
            >
              <Feather name="check-circle" size={20} color={markedRead ? colors.accent : colors.mutedForeground} />
            </Pressable>
          )}
          {/* Remind me button */}
          {session && Platform.OS !== 'web' && (
            <Pressable
              onPress={handleReminder}
              style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
              hitSlop={8}
              accessibilityLabel={reminderSet ? 'Cancel reading reminder' : 'Set reading reminder'}
            >
              <Feather
                name="bell"
                size={20}
                color={reminderSet ? colors.accent : colors.mutedForeground}
              />
            </Pressable>
          )}
          {session && (
            <Pressable
              onPress={() => setShowListPicker((v) => !v)}
              style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
              hitSlop={8}
            >
              <Feather name="bookmark" size={20} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* List picker */}
      {showListPicker && (
        <View
          style={[
            styles.listPicker,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.listPickerTitle, { color: colors.foreground }]}>
            Save to list
          </Text>
          {listsQuery.isLoading ? (
            <Text style={[styles.listPickerHint, { color: colors.mutedForeground }]}>
              Loading lists…
            </Text>
          ) : listsQuery.data?.length === 0 ? (
            <Text style={[styles.listPickerHint, { color: colors.mutedForeground }]}>
              No lists yet — create one first
            </Text>
          ) : (
            <FlatList
              data={listsQuery.data ?? []}
              keyExtractor={(l) => l.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => addMutation.mutate({ listId: item.id })}
                  style={({ pressed }) => [
                    styles.listOption,
                    { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Feather name="bookmark" size={16} color={colors.accent} />
                  <Text style={[styles.listOptionText, { color: colors.foreground }]}>
                    {item.name}
                  </Text>
                </Pressable>
              )}
              style={{ maxHeight: 180 }}
            />
          )}
        </View>
      )}

      {/* Main content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 16),
        }}
      >
        {article.og_image_url ? (
          <Image source={{ uri: article.og_image_url }} style={styles.hero} resizeMode="cover" />
        ) : null}

        <View style={styles.content}>
          {/* Source + meta */}
          <View style={styles.metaRow}>
            {sourceName ? (
              <Pressable onPress={() => {
                const slug = article.source?.slug ?? article.source_slug;
                if (slug) router.push(`/source/${slug}`);
              }}>
                <Text style={[styles.source, { color: colors.accent }]}>
                  {sourceName.toUpperCase()}
                </Text>
              </Pressable>
            ) : null}
            {article.reading_time_minutes ? (
              <Text style={[styles.readTime, { color: colors.mutedForeground }]}>
                {article.reading_time_minutes} min read
              </Text>
            ) : null}
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.foreground }]}>{article.title}</Text>

          {/* Author + date */}
          {(article.author || article.created_at) && (
            <Text style={[styles.byline, { color: colors.mutedForeground }]}>
              {article.author ? `By ${article.author}` : ''}
              {article.author && article.created_at ? ' · ' : ''}
              {article.created_at
                ? new Date(article.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })
                : ''}
            </Text>
          )}

          {/* Description */}
          {article.description && (
            <Text style={[styles.description, { color: colors.foreground }]}>
              {article.description}
            </Text>
          )}

          {/* Topics */}
          {article.topics && article.topics.length > 0 && (
            <View style={styles.topics}>
              {article.topics.map((t) =>
                t.name ? (
                  <TopicChip
                    key={t.topic_id}
                    label={t.name}
                    small
                    onPress={() => t.slug && router.push(`/topic/${t.slug}`)}
                  />
                ) : null,
              )}
            </View>
          )}

          {/* Stats */}
          <View style={[styles.statsRow, { borderColor: colors.border }]}>
            <View style={styles.stat}>
              <Text style={[styles.statVal, { color: colors.foreground }]}>
                {article.save_count ?? 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>saves</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statVal, { color: colors.foreground }]}>
                {article.finish_count ?? 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>reads</Text>
            </View>
            {article.word_count ? (
              <View style={styles.stat}>
                <Text style={[styles.statVal, { color: colors.foreground }]}>
                  {Math.round(article.word_count / 1000)}k
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>words</Text>
              </View>
            ) : null}
          </View>

          {/* Remind me banner */}
          {session && Platform.OS !== 'web' && (
            <Pressable
              onPress={handleReminder}
              style={({ pressed }) => [
                styles.reminderBanner,
                {
                  backgroundColor: reminderSet ? colors.accent + '18' : colors.card,
                  borderColor: reminderSet ? colors.accent : colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Feather
                name="bell"
                size={16}
                color={reminderSet ? colors.accent : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.reminderText,
                  { color: reminderSet ? colors.accent : colors.mutedForeground },
                ]}
              >
                {reminderSet ? 'Reminder set — tap to cancel' : 'Remind me to read this'}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Open Article CTA */}
      <View
        style={[
          styles.cta,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 8),
          },
        ]}
      >
        <Pressable
          onPress={openArticle}
          style={({ pressed }) => [
            styles.ctaBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Feather name="external-link" size={16} color={colors.primaryForeground} />
          <Text style={[styles.ctaBtnText, { color: colors.primaryForeground }]}>
            Open Article
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  topBarActions: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  iconBtn: { padding: 6 },
  listPicker: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  listPickerTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  listPickerHint: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  listOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  listOptionText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  hero: { width: '100%', height: 220 },
  content: { padding: 20, gap: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  source: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  readTime: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  title: { fontSize: 26, fontFamily: 'Spectral_600SemiBold', lineHeight: 33 },
  byline: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  description: { fontSize: 16, fontFamily: 'Spectral_400Regular', lineHeight: 26 },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
  },
  stat: { alignItems: 'center', gap: 2 },
  statVal: { fontSize: 18, fontFamily: 'Spectral_600SemiBold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  reminderText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  cta: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
  },
  ctaBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
