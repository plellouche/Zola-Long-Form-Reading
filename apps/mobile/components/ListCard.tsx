import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { ReadingList } from '@/lib/types';

interface Props {
  list: ReadingList;
  onPress: () => void;
}

export function ListCard({ list, onPress }: Props) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: colors.primary + '18' }]}>
        <Feather name="bookmark" size={22} color={colors.primary} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {list.name}
        </Text>
        {list.description ? (
          <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={1}>
            {list.description}
          </Text>
        ) : null}
        <View style={styles.footer}>
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {list.item_count ?? 0} articles
          </Text>
          {!list.is_public && (
            <View style={styles.privateTag}>
              <Feather name="lock" size={9} color={colors.mutedForeground} />
              <Text style={[styles.privateText, { color: colors.mutedForeground }]}>Private</Text>
            </View>
          )}
        </View>
      </View>

      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 5,
    padding: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  desc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  count: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  privateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  privateText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
  },
});
