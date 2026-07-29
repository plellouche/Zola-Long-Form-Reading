import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonList } from '@/components/SkeletonCard';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { getLists, getUser, getUserStats } from '@/lib/api';
import type { ReadingList } from '@/lib/types';
import {
  DEFAULT_PREFS,
  type NotificationPrefs,
  loadNotificationPrefs,
  saveNotificationPrefs,
} from '@/lib/notifications';

type ProfileTab = 'lists' | 'top' | 'saved' | 'read' | 'interested';

const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'lists', label: 'Lists' },
  { key: 'top', label: 'Top' },
  { key: 'saved', label: 'Saved' },
  { key: 'read', label: 'Read' },
  { key: 'interested', label: 'Interested' },
];

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  const ampm = i < 12 ? 'AM' : 'PM';
  return `${h}:00 ${ampm}`;
});

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session, user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>('lists');

  const username =
    (user?.user_metadata?.username as string | undefined) ??
    (user?.email?.split('@')[0]);

  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['profile', username],
    queryFn: () => getUser(username!),
    enabled: !!username,
    staleTime: 60 * 1000,
  });

  const statsQuery = useQuery({
    queryKey: ['user-stats', username],
    queryFn: () => getUserStats(username!),
    enabled: !!username,
    staleTime: 60 * 1000,
  });

  const listsQuery = useQuery({
    queryKey: ['lists'],
    queryFn: getLists,
    enabled: !!session && activeTab === 'lists',
    staleTime: 60 * 1000,
  });

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); } },
    ]);
  };

  // Load notification preferences once
  useEffect(() => {
    if (Platform.OS === 'web') return;
    loadNotificationPrefs().then((prefs) => {
      setNotifPrefs(prefs);
      setPrefsLoaded(true);
    });
  }, []);

  const handleToggleDigest = async (enabled: boolean) => {
    const updated = { ...notifPrefs, digestEnabled: enabled };
    setNotifPrefs(updated);
    try {
      await saveNotificationPrefs(updated);
    } catch {
      setNotifPrefs((p) => ({ ...p, digestEnabled: !enabled }));
      Alert.alert(
        'Notifications blocked',
        'Enable notifications in your device settings to receive the weekly digest.',
      );
    }
  };

  const handleSelectDay = async (day: number) => {
    const updated = { ...notifPrefs, digestDayOfWeek: day };
    setNotifPrefs(updated);
    setShowDayPicker(false);
    await saveNotificationPrefs(updated);
  };

  const handleSelectHour = async (hour: number) => {
    const updated = { ...notifPrefs, digestHour: hour };
    setNotifPrefs(updated);
    setShowTimePicker(false);
    await saveNotificationPrefs(updated);
  };

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState
          icon="user"
          title="Your profile"
          subtitle="Sign in to see your reading history and stats"
          actionLabel="Sign In"
          onAction={() => router.push('/auth/login')}
        />
      </View>
    );
  }

  const profile = profileQuery.data;
  const stats = statsQuery.data;
  const isRefreshing = profileQuery.isFetching || statsQuery.isFetching;

  const displayName = profile?.display_name ?? profile?.username ?? user?.email ?? 'Reader';
  const handle = profile?.username ? `@${profile.username}` : '';

  const statCards = [
    {
      label: 'FINISHED',
      value: stats ? String(stats.finished_count) : '—',
      sub: null,
    },
    {
      label: 'HOURS READ',
      value: stats ? String(stats.hours_read) : '—',
      sub: stats?.avg_minutes ? `~${stats.avg_minutes}m avg` : null,
    },
    {
      label: 'STREAK',
      value: stats ? (stats.current_streak > 0 ? `${stats.current_streak}d` : '—') : '—',
      sub: stats?.current_streak === 0 ? 'No active streak' : null,
    },
    {
      label: 'SOURCES',
      value: stats ? String(stats.sources_explored) : '—',
      sub: 'explored',
    },
    {
      label: 'TOP SOURCE',
      value: stats?.top_source?.name ?? '—',
      sub: stats?.top_source ? `${stats.top_source.count} finished` : null,
      large: true,
    },
    {
      label: 'AVG LENGTH',
      value: stats?.avg_minutes ? `${stats.avg_minutes}m` : '—',
      sub: 'per article',
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20),
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            profileQuery.refetch();
            statsQuery.refetch();
          }}
          tintColor={colors.primary}
        />
      }
    >
      {/* ── Top nav bar ── */}
      <View style={[styles.navBar, { paddingTop: topPad, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Profile</Text>
        <Pressable onPress={handleSignOut} hitSlop={10}>
          <Feather name="log-out" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* ── Header: avatar + name + username ── */}
      <View style={styles.header}>
        {/* Avatar */}
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarInitial, { color: colors.primaryForeground }]}>
              {displayName[0].toUpperCase()}
            </Text>
          </View>
        )}

        {/* Name block */}
        <View style={styles.nameBlock}>
          <Text style={[styles.displayName, { color: colors.foreground }]} numberOfLines={1}>
            {displayName}
          </Text>
          {handle ? (
            <Text style={[styles.handle, { color: colors.mutedForeground }]}>{handle}</Text>
          ) : null}

          {/* Followers / Following */}
          <View style={styles.followRow}>
            <Pressable hitSlop={6}>
              <Text style={[styles.followText, { color: colors.foreground }]}>
                <Text style={styles.followBold}>{profile?.followers_count ?? 0}</Text>
                <Text style={[styles.followLabel, { color: colors.mutedForeground }]}> follower{profile?.followers_count !== 1 ? 's' : ''}</Text>
              </Text>
            </Pressable>
            <Text style={[styles.followDot, { color: colors.mutedForeground }]}>·</Text>
            <Pressable hitSlop={6}>
              <Text style={[styles.followText, { color: colors.foreground }]}>
                <Text style={styles.followBold}>{profile?.following_count ?? 0}</Text>
                <Text style={[styles.followLabel, { color: colors.mutedForeground }]}> following</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Bio */}
      {profile?.bio ? (
        <Text style={[styles.bio, { color: colors.foreground }]}>{profile.bio}</Text>
      ) : null}

      {/* ── Reading stats ── */}
      <View style={styles.readingSection}>
        <Text style={[styles.readingLabel, { color: colors.mutedForeground }]}>READING</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statScrollRow}
        >
          {statCards.map((card) => (
            <View
              key={card.label}
              style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>{card.label}</Text>
              <Text
                style={[
                  card.large ? styles.statCardValueLarge : styles.statCardValue,
                  { color: colors.foreground },
                ]}
                numberOfLines={2}
              >
                {card.value}
              </Text>
              {card.sub ? (
                <Text style={[styles.statCardSub, { color: colors.mutedForeground }]}>{card.sub}</Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* ── Content tabs ── */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              style={styles.tabItem}
            >
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === t.key ? colors.foreground : colors.mutedForeground,
                    fontFamily: activeTab === t.key ? 'Inter_600SemiBold' : 'Inter_400Regular',
                  },
                ]}
              >
                {t.label}
              </Text>
              {activeTab === t.key && (
                <View style={[styles.tabUnderline, { backgroundColor: colors.foreground }]} />
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── Tab content ── */}
      {activeTab === 'lists' && (
        <View style={styles.tabContent}>
          {listsQuery.isLoading ? (
            <SkeletonList count={4} />
          ) : listsQuery.data && listsQuery.data.length > 0 ? (
            <View style={styles.listsGrid}>
              {listsQuery.data.map((list: ReadingList) => (
                <Pressable
                  key={list.id}
                  onPress={() => router.push(`/list/${list.id}`)}
                  style={({ pressed }) => [
                    styles.listCard,
                    { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Text style={[styles.listCardName, { color: colors.foreground }]} numberOfLines={2}>
                    {list.name}
                  </Text>
                  {list.item_count != null && (
                    <Text style={[styles.listCardCount, { color: colors.mutedForeground }]}>
                      {list.item_count}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="bookmark"
              title="No lists yet"
              subtitle="Create a list to organise articles you want to read"
              actionLabel="Go to Lists"
              onAction={() => router.push('/lists')}
            />
          )}
        </View>
      )}

      {(activeTab === 'top' || activeTab === 'saved' || activeTab === 'read' || activeTab === 'interested') && (
        <View style={styles.tabContent}>
          <EmptyState
            icon="file-text"
            title={`Your ${activeTab} articles`}
            subtitle="Coming soon — track your reading history here"
          />
        </View>
      )}

      {/* ── Notification Settings ── */}
      {Platform.OS !== 'web' && prefsLoaded && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NOTIFICATIONS</Text>
          <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Weekly digest toggle */}
            <View style={styles.menuItem}>
              <Feather name="mail" size={18} color={colors.foreground} />
              <Text style={[styles.menuText, { color: colors.foreground }]}>Weekly digest</Text>
              <Switch
                value={notifPrefs.digestEnabled}
                onValueChange={handleToggleDigest}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.primaryForeground}
              />
            </View>

            {/* Day and time pickers — only shown when digest is on */}
            {notifPrefs.digestEnabled && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Pressable
                  onPress={() => {
                    setShowTimePicker(false);
                    setShowDayPicker((v) => !v);
                  }}
                  style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Feather name="calendar" size={18} color={colors.foreground} />
                  <Text style={[styles.menuText, { color: colors.foreground }]}>Send on</Text>
                  <Text style={[styles.menuValue, { color: colors.mutedForeground }]}>
                    {DAY_LABELS[notifPrefs.digestDayOfWeek]}
                  </Text>
                  <Feather
                    name={showDayPicker ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.mutedForeground}
                  />
                </Pressable>

                {showDayPicker && (
                  <View style={[styles.pickerList, { borderColor: colors.border }]}>
                    {DAY_LABELS.map((label, i) => (
                      <Pressable
                        key={label}
                        onPress={() => handleSelectDay(i)}
                        style={({ pressed }) => [
                          styles.pickerItem,
                          {
                            backgroundColor:
                              notifPrefs.digestDayOfWeek === i
                                ? colors.accent + '18'
                                : 'transparent',
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pickerItemText,
                            {
                              color:
                                notifPrefs.digestDayOfWeek === i
                                  ? colors.accent
                                  : colors.foreground,
                              fontFamily:
                                notifPrefs.digestDayOfWeek === i
                                  ? 'Inter_600SemiBold'
                                  : 'Inter_400Regular',
                            },
                          ]}
                        >
                          {label}
                        </Text>
                        {notifPrefs.digestDayOfWeek === i && (
                          <Feather name="check" size={14} color={colors.accent} />
                        )}
                      </Pressable>
                    ))}
                  </View>
                )}

                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Pressable
                  onPress={() => {
                    setShowDayPicker(false);
                    setShowTimePicker((v) => !v);
                  }}
                  style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Feather name="clock" size={18} color={colors.foreground} />
                  <Text style={[styles.menuText, { color: colors.foreground }]}>Send at</Text>
                  <Text style={[styles.menuValue, { color: colors.mutedForeground }]}>
                    {HOUR_LABELS[notifPrefs.digestHour]}
                  </Text>
                  <Feather
                    name={showTimePicker ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.mutedForeground}
                  />
                </Pressable>

                {showTimePicker && (
                  <View style={[styles.pickerList, { borderColor: colors.border }]}>
                    {HOUR_LABELS.map((label, i) => (
                      <Pressable
                        key={label}
                        onPress={() => handleSelectHour(i)}
                        style={({ pressed }) => [
                          styles.pickerItem,
                          {
                            backgroundColor:
                              notifPrefs.digestHour === i ? colors.accent + '18' : 'transparent',
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pickerItemText,
                            {
                              color:
                                notifPrefs.digestHour === i ? colors.accent : colors.foreground,
                              fontFamily:
                                notifPrefs.digestHour === i
                                  ? 'Inter_600SemiBold'
                                  : 'Inter_400Regular',
                            },
                          ]}
                        >
                          {label}
                        </Text>
                        {notifPrefs.digestHour === i && (
                          <Feather name="check" size={14} color={colors.accent} />
                        )}
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const STAT_CARD_W = 130;

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Nav bar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 28,
    fontFamily: 'Spectral_600SemiBold',
  },
  nameBlock: {
    flex: 1,
    gap: 2,
    paddingTop: 4,
  },
  displayName: {
    fontSize: 22,
    fontFamily: 'Spectral_600SemiBold',
    lineHeight: 27,
  },
  handle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  followText: { fontSize: 13 },
  followBold: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  followLabel: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  followDot: { fontSize: 13, fontFamily: 'Inter_400Regular' },

  // Bio
  bio: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },

  // Reading stats
  readingSection: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  readingLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  statScrollRow: {
    paddingHorizontal: 20,
    gap: 10,
    flexDirection: 'row',
  },
  statCard: {
    width: STAT_CARD_W,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 2,
  },
  statCardLabel: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statCardValue: {
    fontSize: 22,
    fontFamily: 'Spectral_600SemiBold',
    lineHeight: 26,
  },
  statCardValueLarge: {
    fontSize: 16,
    fontFamily: 'Spectral_600SemiBold',
    lineHeight: 20,
  },
  statCardSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },

  // Tabs
  tabBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 16,
  },
  tabRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 0,
  },
  tabItem: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 4,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 14,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 12,
    right: 12,
    height: 2,
    borderRadius: 1,
  },
  tabContent: {
    paddingTop: 16,
  },

  // Lists grid
  listsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  listCard: {
    width: '47.5%',
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    minHeight: 70,
    justifyContent: 'space-between',
  },
  listCardName: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    lineHeight: 20,
  },
  listCardCount: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 6,
  },

  // Notification settings
  section: { marginTop: 24, marginHorizontal: 16, marginBottom: 4 },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  menuText: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium' },
  menuValue: { fontSize: 14, fontFamily: 'Inter_400Regular', marginRight: 4 },
  divider: { height: 1, marginLeft: 44 },
  pickerList: {
    borderTopWidth: 1,
    maxHeight: 220,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  pickerItemText: {
    fontSize: 14,
  },
});
