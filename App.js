import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';

import { ThemeProvider, useAppTheme } from './ThemeContext';
import { AuthProvider, useAuth } from './Auth/AuthContext';
import { initDatabase } from './database/offencesDatabase';
import AppNavigator from './navigation/AppNavigator';
import { startAutoSync } from './sync/syncService';

function AppContent() {
    const { theme, colors } = useAppTheme();
    const { user, loading: authLoading } = useAuth();
    const [dbReady, setDbReady] = useState(false);

    useEffect(() => {
        const initialize = async () => {
            try {
                await initDatabase();
            } catch (error) {
                console.error('Database initialization error:', error);
                Alert.alert('Error', 'Failed to initialize local database.');
            } finally {
                setDbReady(true);
            }
        };
        initialize();
    }, []);

    useEffect(() => {
        if (!dbReady || !user) return undefined;
        return startAutoSync(user.id);
    }, [dbReady, user?.id]);

    if (authLoading || !dbReady) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const baseTheme = theme === 'dark' ? DarkTheme : DefaultTheme;
    const navigationTheme = {
        ...baseTheme,
        colors: {
            ...baseTheme.colors,
            primary: colors.primary,
            background: colors.background,
            card: colors.card,
            text: colors.text,
            border: colors.border,
            notification: colors.danger,
        },
    };

    return (
        <NavigationContainer theme={navigationTheme}>
            <AppNavigator />
        </NavigationContainer>
    );
}

export default function App() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemeProvider>
                <AuthProvider>
                    <AppContent />
                </AuthProvider>
            </ThemeProvider>
        </GestureHandlerRootView>
    );
}