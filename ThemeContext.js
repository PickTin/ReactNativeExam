import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const themes = {
    light: {
        background: '#F5F5F2',
        surface: '#FFFFFF',
        card: '#FFFFFF',
        text: '#242424',
        secondaryText: '#70706B',
        border: '#DDDDD7',
        button: '#30302D',
        buttonText: '#FFFFFF',
        input: '#FFFFFF',
        placeholder: '#888880',
        danger: '#C74646',
        dot: '#C74646',
        today: '#30302D',
        todayText: '#FFFFFF',
        primary: '#30302D',
        mutedDay: '#A5A59E',
    },
    dark: {
        background: '#121212',
        surface: '#1B1B1B',
        card: '#222222',
        text: '#F2F2EE',
        secondaryText: '#B7B7AF',
        border: '#393939',
        button: '#E5E5DF',
        buttonText: '#181818',
        input: '#202020',
        placeholder: '#A6A69E',
        danger: '#FF7777',
        dot: '#FF7777',
        today: '#E5E5DF',
        todayText: '#181818',
        primary: '#E5E5DF',
        mutedDay: '#777770',
    },
};

const ThemeContext = createContext(null);
export { ThemeContext };

export function ThemeProvider({ children }) {
    const [themeName, setThemeName] = useState('light');
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let active = true;
        const loadTheme = async () => {
            try {
                const saved = await AsyncStorage.getItem('appTheme');
                if (active && (saved === 'light' || saved === 'dark')) {
                    setThemeName(saved);
                }
            } catch (error) {
                console.error('Не вдалося завантажити тему:', error);
            } finally {
                if (active) setReady(true);
            }
        };
        loadTheme();
        return () => { active = false; };
    }, []);

    const toggleTheme = async () => {
        const next = themeName === 'light' ? 'dark' : 'light';
        setThemeName(next);
        try {
            await AsyncStorage.setItem('appTheme', next);
        } catch (error) {
            console.error('Не вдалося зберегти тему:', error);
        }
    };

    if (!ready) return null;

    return (
        <ThemeContext.Provider
            value={{
                theme: themeName,
                colors: themes[themeName],
                toggleTheme,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

export function useAppTheme() {
    const value = useContext(ThemeContext);
    if (!value) {
        throw new Error('useAppTheme має використовуватися всередині ThemeProvider');
    }
    return value;
}
