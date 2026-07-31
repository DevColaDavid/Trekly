import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Lets the in-app browser used for OAuth (Google/Apple) close itself and
// hand control back to the app once the provider redirects back.
WebBrowser.maybeCompleteAuthSession();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// SecureStore has a 2048 byte limit; Supabase sessions fit under it, and it's
// only used on native. Web falls back to AsyncStorage (-> localStorage).
const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? AsyncStorage : secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // true so the web build can pick up the ?access_token=... redirect
    // Google/Apple OAuth lands on; native uses the WebBrowser flow in
    // lib/auth.tsx instead and doesn't rely on this.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
