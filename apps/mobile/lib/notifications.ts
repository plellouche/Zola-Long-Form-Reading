import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ─── Constants ────────────────────────────────────────────────────────────────
const PREFS_KEY = 'notification_prefs';
const REMINDER_ID_PREFIX = 'reminder_';

export interface NotificationPrefs {
  digestEnabled: boolean;
  digestDayOfWeek: number; // 0 = Sunday … 6 = Saturday
  digestHour: number; // 0–23
}

export const DEFAULT_PREFS: NotificationPrefs = {
  digestEnabled: true,
  digestDayOfWeek: 0, // Sunday
  digestHour: 9, // 9 AM
};

// ─── Handler (call once at app startup) ───────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Permission & Registration ────────────────────────────────────────────────
export async function registerForPushNotificationsAsync(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return false;

  // Set Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reading Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync('digest', {
      name: 'Weekly Digest',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return true;
}

// ─── Read Reminder ─────────────────────────────────────────────────────────────
export async function scheduleReadReminder(article: {
  id: string;
  title: string;
  source_name?: string;
}): Promise<void> {
  // Cancel any existing reminder for this article first
  await cancelReadReminder(article.id);

  // Schedule 3 hours from now
  const trigger = new Date(Date.now() + 3 * 60 * 60 * 1000);

  await Notifications.scheduleNotificationAsync({
    identifier: `${REMINDER_ID_PREFIX}${article.id}`,
    content: {
      title: '📖 Time to finish reading',
      body: article.title,
      subtitle: article.source_name ?? undefined,
      data: { articleId: article.id },
      categoryIdentifier: 'reminders',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
  });
}

export async function cancelReadReminder(articleId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(
    `${REMINDER_ID_PREFIX}${articleId}`,
  );
}

export async function hasActiveReminder(articleId: string): Promise<boolean> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some((n) => n.identifier === `${REMINDER_ID_PREFIX}${articleId}`);
}

// ─── Weekly Digest ─────────────────────────────────────────────────────────────
const DIGEST_ID = 'weekly_digest';

export async function scheduleWeeklyDigest(prefs: NotificationPrefs): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DIGEST_ID);

  if (!prefs.digestEnabled) return;

  await Notifications.scheduleNotificationAsync({
    identifier: DIGEST_ID,
    content: {
      title: '📚 Your weekly reading digest',
      body: "New articles from your favorite sources are waiting for you.",
      data: { type: 'digest' },
      categoryIdentifier: 'digest',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: prefs.digestDayOfWeek + 1, // expo uses 1=Sun … 7=Sat
      hour: prefs.digestHour,
      minute: 0,
    },
  });
}

export async function cancelWeeklyDigest(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DIGEST_ID);
}

// ─── Preferences (persisted via AsyncStorage) ─────────────────────────────────
export async function loadNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function saveNotificationPrefs(
  prefs: NotificationPrefs,
): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  await scheduleWeeklyDigest(prefs);
}
