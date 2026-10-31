import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
    createDrawerNavigator, DrawerContentScrollView, DrawerItem, DrawerToggleButton,
} from '@react-navigation/drawer';

import Calendar from '../calendar/Calendar';
import OffencesScreen from '../Offences/OffencesScreen';
import OffenceDetailsScreen from '../Offences/OffenceDetailsScreen';
import AuthScreen from '../Auth/AuthScreen';
import MapScreen from '../Offences/MapScreen';
import { useAppTheme } from '../ThemeContext';
import { useAuth } from '../Auth/AuthContext';
import { syncAll, describeSyncResult } from '../sync/syncService';

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const tabIcon = (name) => ({ focused, color, size }) => (
    <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />
);

function MainTabs() {
    const { colors } = useAppTheme();
    return (
        <Tab.Navigator
            screenOptions={{
                headerLeft: () => <DrawerToggleButton tintColor={colors.text} />,
                headerStyle: { backgroundColor: colors.card },
                headerTintColor: colors.text,
                headerShadowVisible: false,
                sceneStyle: { backgroundColor: colors.background },
                tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.secondaryText,
            }}
        >
            <Tab.Screen name="CalendarTab" component={Calendar}
                        options={{ title: 'Calendar', tabBarIcon: tabIcon('calendar') }} />
            <Tab.Screen name="OffencesTab" component={OffencesScreen}
                        options={{ title: 'Offences', tabBarIcon: tabIcon('folder') }} />
            <Tab.Screen name="MapTab" component={MapScreen}
                        options={{ title: 'Map', tabBarIcon: tabIcon('map') }} />
        </Tab.Navigator>
    );
}

function MainStack() {
    const { colors } = useAppTheme();
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: colors.card },
                headerTintColor: colors.text,
                headerTitleStyle: { color: colors.text },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.background },
            }}
        >
            <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="DayOffences" component={OffencesScreen}
                          options={({ route }) => ({ title: route.params?.date ?? 'Offences' })} />
            <Stack.Screen name="OffenceDetails" component={OffenceDetailsScreen}
                          options={{ title: 'Offence Details' }} />
        </Stack.Navigator>
    );
}

function CustomDrawerContent(props) {
    const { navigation, state } = props;
    const { colors, theme, toggleTheme } = useAppTheme();
    const { user, logout } = useAuth();
    const activeRoute = state.routes[state.index].name;

    const itemProps = (routeName) => ({
        focused: activeRoute === routeName,
        activeTintColor: colors.primary,
        inactiveTintColor: colors.text,
        activeBackgroundColor: colors.background,
    });

    const handleLogout = async () => {
        try {
            await logout();
            navigation.navigate('Main');
            navigation.closeDrawer();
        } catch (error) {
            Alert.alert('Error', 'Failed to log out.');
        }
    };

    const handleSync = async () => {
        const result = await syncAll(user.id);
        Alert.alert('Sync', describeSyncResult(result));
    };

    return (
        <DrawerContentScrollView {...props}>
            <View style={[styles.drawerHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.drawerTitle, { color: colors.text }]}>Law-Abiding Citizen</Text>
                <Text style={{ color: colors.secondaryText }}>
                    {user ? `${user.firstName} ${user.lastName}` : 'Guest (View Only)'}
                </Text>
            </View>

            <DrawerItem label="Home" onPress={() => navigation.navigate('Main')} {...itemProps('Main')} />
            {!user && (
                <>
                    <DrawerItem label="Log In" onPress={() => navigation.navigate('Login')} {...itemProps('Login')} />
                    <DrawerItem label="Sign Up" onPress={() => navigation.navigate('Register')} {...itemProps('Register')} />
                </>
            )}
            {user && (
                <DrawerItem label="Sync now" onPress={handleSync} inactiveTintColor={colors.text} />
            )}
            {user && (
                <DrawerItem label="Log Out" onPress={handleLogout} inactiveTintColor={colors.danger} />
            )}
            <DrawerItem
                label={theme === 'light' ? 'Dark Theme' : 'Light Theme'}
                onPress={toggleTheme}
                inactiveTintColor={colors.text}
            />
        </DrawerContentScrollView>
    );
}

export default function AppNavigator() {
    const { colors } = useAppTheme();
    return (
        <Drawer.Navigator
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={{
                headerStyle: { backgroundColor: colors.card },
                headerTintColor: colors.text,
                headerShadowVisible: false,
                drawerStyle: { backgroundColor: colors.card },
                sceneStyle: { backgroundColor: colors.background },
            }}
        >
            <Drawer.Screen name="Main" component={MainStack} options={{ headerShown: false, title: 'Home' }} />
            <Drawer.Screen name="Login" component={AuthScreen} options={{ title: 'Log In' }} />
            <Drawer.Screen name="Register" component={AuthScreen} options={{ title: 'Sign Up' }} />
        </Drawer.Navigator>
    );
}

const styles = StyleSheet.create({
    drawerHeader: { padding: 16, marginBottom: 8, borderBottomWidth: 1 },
    drawerTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
});
