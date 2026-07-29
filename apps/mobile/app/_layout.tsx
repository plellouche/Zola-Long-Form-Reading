import React, { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import {
  loadNotificationPrefs,
  registerForPushNotificationsAsync,
  scheduleWeeklyDigest,
} from '@/lib/notifications';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  Spectral_400Regular,
  Spectral_500Medium,
  Spectral_600SemiBold,
} from '@expo-google-fonts/spectral';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30 * 1000 },
  },
});

function RootLayoutNav() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="article/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="list/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="user/[username]" options={{ headerShown: false }} />
      <Stack.Screen name="topic/[slug]" options={{ headerShown: false }} />
      <Stack.Screen name="source/[slug]" options={{ headerShown: false }} />
      <Stack.Screen
        name="auth/login"
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <Stack.Screen
        name="auth/signup"
        options={{ headerShown: false, presentation: 'modal' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Spectral_400Regular,
    Spectral_500Medium,
    Spectral_600SemiBold,
  });

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Request permission and schedule digest on first load
    registerForPushNotificationsAsync().then((granted) => {
      if (granted) {
        loadNotificationPrefs().then((prefs) => scheduleWeeklyDigest(prefs));
      }
    });

    // Navigate to article when user taps a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, string>;
        if (data?.articleId) {
          router.push(`/article/${data.articleId}`);
        }
      },
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
