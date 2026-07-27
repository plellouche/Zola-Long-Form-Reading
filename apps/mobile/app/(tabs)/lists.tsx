import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { ListCard } from '@/components/ListCard';
import { SkeletonList } from '@/components/SkeletonCard';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { createList, getLists } from '@/lib/api';
import type { ReadingList } from '@/lib/types';

export default function ListsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const listsQuery = useQuery({
    queryKey: ['lists'],
    queryFn: getLists,
    enabled: !!session,
    staleTime: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: createList,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lists'] });
      setNewName('');
      setShowCreate(false);
    },
    onError: (e) => Alert.alert('Error', (e as Error).message),
  });

  const topPad = Platform.OS === 'web' ? 67 : 0;

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="bookmark"
          title="Your reading lists"
          subtitle="Sign in to create and manage your reading lists"
          actionLabel="Sign In"
          onAction={() => router.push('/auth/login')}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Create list inline form */}
      {showCreate && (
        <View
          style={[
            styles.createForm,
            { backgroundColor: colors.card, borderColor: colors.border, marginTop: topPad + 4 },
          ]}
        >
          <TextInput
            style={[styles.createInput, { color: colors.foreground, borderColor: colors.border }]}
            placeholder="List name…"
            placeholderTextColor={colors.mutedForeground}
            value={newName}
            onChangeText={setNewName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => {
              if (newName.trim()) createMutation.mutate({ name: newName.trim() });
            }}
          />
          <View style={styles.createActions}>
            <Pressable
              onPress={() => {
                setShowCreate(false);
                setNewName('');
              }}
              style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (newName.trim()) createMutation.mutate({ name: newName.trim() });
              }}
              style={({ pressed }) => [
                styles.createBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.createBtnText, { color: colors.primaryForeground }]}>
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {listsQuery.isLoading ? (
        <View style={{ marginTop: topPad }}>
          <SkeletonList count={4} />
        </View>
      ) : listsQuery.data?.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title="No lists yet"
          subtitle="Create a reading list to save articles for later"
          actionLabel="Create List"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <FlatList<ReadingList>
          data={listsQuery.data ?? []}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => (
            <ListCard list={item} onPress={() => router.push(`/list/${item.id}`)} />
          )}
          contentContainerStyle={{
            paddingTop: showCreate ? 8 : topPad + 8,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0),
          }}
          refreshControl={
            <RefreshControl
              refreshing={listsQuery.isFetching}
              onRefresh={() => listsQuery.refetch()}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* FAB */}
      {!showCreate && (
        <Pressable
          onPress={() => setShowCreate(true)}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: colors.primary,
              bottom: insets.bottom + (Platform.OS === 'web' ? 34 : 16),
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="plus" size={24} color={colors.primaryForeground} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  createForm: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  createInput: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    borderBottomWidth: 1,
    paddingVertical: 6,
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    alignItems: 'center',
  },
  cancelBtn: { padding: 8 },
  cancelText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  createBtn: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  createBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
});
