import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
    SESSION: 'session',
    LOCAL_USERS: 'localUsers',
    LAST_SYNC_PREFIX: 'lastSyncAt:',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const restoreSession = async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_KEYS.SESSION);
                if (active && saved) setUser(JSON.parse(saved));
            } catch (error) {
                console.error('No session:', error);
            } finally {
                if (active) setLoading(false);
            }
        };
        restoreSession();
        return () => { active = false; };
    }, []);

    const register = async ({ firstName, lastName, email, password }) => {
        const cleanEmail = email.trim().toLowerCase();
        if (!EMAIL_REGEX.test(cleanEmail)) {
            throw new Error('Enter correct email.');
        }
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters:');
        }

        const stored = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_USERS);
        const users = stored ? JSON.parse(stored) : {};
        if (users[cleanEmail]) {
            throw new Error('User with the same email already exists.');
        }

        users[cleanEmail] = {
            id: `local-${Date.now()}`,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: cleanEmail,
            password,
        };
        await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_USERS, JSON.stringify(users));
    };

    const login = async (email, password) => {
        const cleanEmail = email.trim().toLowerCase();
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_USERS);
        const users = stored ? JSON.parse(stored) : {};
        const found = users[cleanEmail];

        if (!found || found.password !== password) {
            throw new Error('Incorrect email or password.');
        }

        const session = {
            id: found.id,
            firstName: found.firstName,
            lastName: found.lastName,
            email: found.email,
        };
        await AsyncStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
        setUser(session);
    };

    const logout = async () => {
        await AsyncStorage.removeItem(STORAGE_KEYS.SESSION);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isGuest: !user, loading, register, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const value = useContext(AuthContext);
    if (!value) {
        throw new Error('useAuth must be used in AuthProvider');
    }
    return value;
}
