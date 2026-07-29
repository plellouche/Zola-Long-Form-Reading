import React from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { getUser } from '@/lib/api';

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const profileQuery = useQuery({
    queryKey: ['user', username],
    queryFn: () => getUser(username),
    enabled: !!username,
    staleTime: 60 * 1000,
  });

  const profile = profileQuery.data;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.topBar,
          { paddingTop: topPad + 6, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: colors.foreground }]}>
          {profile?.display_name ?? `@${username}`}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 16),
        }}
        refreshControl={
          <RefreshControl
            refreshing={profileQuery.isFetching}
            onRefresh={() => profileQuery.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {profileQuery.isLoading ? (
          <Text style={[styles.loading, { color: colors.mutedForeground }]}>Loading…</Text>
        ) : !profile ? (
          <Text style={[styles.loading, { color: colors.mutedForeground }]}>User not found</Text>
        ) : (
          <>
            <View style={styles.header}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
                  {(profile.display_name ?? profile.username)[0].toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.displayName, { color: colors.foreground }]}>
                {profile.display_name ?? profile.username}
              </Text>
              <Text style={[styles.handle, { color: colors.mutedForeground }]}>
                @{profile.username}
              </Text>
              {profile.bio && (
                <Text style={[styles.bio, { color: colors.mutedForeground }]}>{profile.bio}</Text>
              )}
            </View>

            <View style={[styles.statsRow, { borderColor: colors.border }]}>
              <View style={styles.stat}>
                <Text style={[styles.statVal, { color: colors.foreground }]}>
                  {profile.article_count ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Articles</Text>
              </View>
              <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
              <View style={styles.stat}>
                <Text style={[styles.statVal, { color: colors.foreground }]}>
                  {profile.hours_read != null ? Math.round(profile.hours_read) : '—'}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Hours read</Text>
              </View>
              <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
              <View style={styles.stat}>
                <Text style={[styles.statVal, { color: colors.foreground }]}>
                  {profile.follower_count ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Followers</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  topBarTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', flex: 1 },
  loading: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  header: { alignItems: 'center', padding: 24, gap: 6 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarText: { fontSize: 28, fontFamily: 'Spectral_600SemiBold' },
  displayName: { fontSize: 20, fontFamily: 'Spectral_600SemiBold' },
  handle: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  bio: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center', gap: 2 },
  statVal: { fontSize: 20, fontFamily: 'Spectral_600SemiBold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  statDiv: { width: 1, height: '100%' },
});
