import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, isApiConfigured, setAuthToken } from '../api/apiClient';
import { registerUser, loginUser } from '../api/authApi';

export const STORAGE_KEYS = {
    SESSION: 'session',
    LOCAL_USERS: 'localUsers',
    LAST_SYNC_PREFIX: 'lastSyncAt:',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AuthContext = createContext(null);

const readUsers = async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_USERS);
    return stored ? JSON.parse(stored) : {};
};

const saveUsers = (users) => AsyncStorage.setItem(STORAGE_KEYS.LOCAL_USERS, JSON.stringify(users));

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const restoreSession = async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_KEYS.SESSION);
                if (active && saved) {
                    const session = JSON.parse(saved);
                    setAuthToken(session.token);
                    setUser(session);
                }
            } catch (error) {
                console.error('No session:', error);
            } finally {
                if (active) setLoading(false);
            }
        };
        restoreSession();
        return () => { active = false; };
    }, []);

    // With a configured API the account is created on the server (internet required);
    // without it, accounts stay local as before.
    const register = async ({ firstName, lastName, email, password }) => {
        const cleanEmail = email.trim().toLowerCase();
        if (!EMAIL_REGEX.test(cleanEmail)) {
            throw new Error('Enter correct email.');
        }
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters.');
        }

        const users = await readUsers();
        const profile = { firstName: firstName.trim(), lastName: lastName.trim(), email: cleanEmail };

        if (isApiConfigured()) {
            try {
                const data = await registerUser({
                    first_name: profile.firstName,
                    last_name: profile.lastName,
                    email: cleanEmail,
                    password,
                });
                if (!data?.user?.id) throw new Error('Unexpected server response.');
                users[cleanEmail] = { id: String(data.user.id), ...profile, password };
            } catch (error) {
                if (error instanceof ApiError && error.isNetwork) {
                    throw new Error('Registration requires an internet connection.');
                }
                throw new Error(error.message || 'Registration failed.');
            }
        } else {
            if (users[cleanEmail]) {
                throw new Error('User with the same email already exists.');
            }
            users[cleanEmail] = { id: `local-${Date.now()}`, ...profile, password };
        }

        await saveUsers(users);
    };

    // With a configured API the server is asked first. If it cannot be reached,
    // the user can still log in offline with the credentials saved on this device.
    const login = async (email, password) => {
        const cleanEmail = email.trim().toLowerCase();
        const users = await readUsers();
        let session = null;

        if (isApiConfigured()) {
            try {
                const data = await loginUser({ email: cleanEmail, password });
                if (!data?.user?.id || !data?.token) throw new Error('Unexpected server response.');
                session = {
                    id: String(data.user.id),
                    firstName: data.user.first_name,
                    lastName: data.user.last_name,
                    email: data.user.email,
                    token: data.token,
                };
                users[cleanEmail] = { ...session, password };
                await saveUsers(users);
            } catch (error) {
                if (!(error instanceof ApiError && error.isNetwork)) {
                    throw new Error(error.status === 401
                        ? 'Incorrect email or password.'
                        : error.message || 'Login failed.');
                }
            }
        }

        if (!session) {
            const found = users[cleanEmail];
            if (!found || found.password !== password) {
                throw new Error('Incorrect email or password.');
            }
            session = {
                id: found.id,
                firstName: found.firstName,
                lastName: found.lastName,
                email: found.email,
                token: found.token ?? null,
            };
        }

        await AsyncStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
        setAuthToken(session.token);
        setUser(session);
    };

    const logout = async () => {
        await AsyncStorage.removeItem(STORAGE_KEYS.SESSION);
        setAuthToken(null);
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
