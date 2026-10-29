import React, { useEffect, useState } from 'react';
import { Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { useAppTheme } from '../ThemeContext';
import { useAuth } from './AuthContext';

export default function AuthScreen({ navigation, route }) {
    const isRegister = route.name === 'Register';
    const { colors } = useAppTheme();
    const { login, register } = useAuth();
    const styles = makeStyles(colors);

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState(route.params?.email ?? '');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (route.params?.email) setEmail(route.params.email);
    }, [route.params?.email]);

    const handleSubmit = async () => {
        if (!email.trim() || !password || (isRegister && (!firstName.trim() || !lastName.trim()))) {
            Alert.alert('Error', 'Fill all fields.');
            return;
        }

        try {
            setSubmitting(true);
            if (isRegister) {
                await register({ firstName, lastName, email, password });
                Alert.alert('Ready', 'Account created. Now login.');
                setPassword('');
                navigation.navigate('Login', { email: email.trim() });
            } else {
                await login(email, password);
                setPassword('');
                navigation.navigate('Main');
            }
        } catch (error) {
            Alert.alert('Error', error.message || 'Something went wrong.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{isRegister ? 'Create an account' : 'Welcome back'}</Text>

            {isRegister && (
                <>
                    <TextInput
                        style={styles.input}
                        placeholder="Name"
                        placeholderTextColor={colors.placeholder}
                        value={firstName}
                        onChangeText={setFirstName}
                        selectionColor={colors.primary}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Surname"
                        placeholderTextColor={colors.placeholder}
                        value={lastName}
                        onChangeText={setLastName}
                        selectionColor={colors.primary}
                    />
                </>
            )}
            <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.placeholder}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                selectionColor={colors.primary}
            />
            <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                selectionColor={colors.primary}
            />

            <Pressable style={[styles.button, submitting && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting}>
                <Text style={styles.buttonText}>{isRegister ? 'Register' : 'Login'}</Text>
            </Pressable>

            <Pressable onPress={() => navigation.navigate(isRegister ? 'Login' : 'Register')}>
                <Text style={styles.link}>
                    {isRegister ? 'Already have an account? Login' : 'No account? Register'}
                </Text>
            </Pressable>
        </ScrollView>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
        backgroundColor: colors.background,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 30,
        color: colors.text,
    },
    input: {
        backgroundColor: colors.input,
        color: colors.text,
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: colors.border,
        fontSize: 16,
    },
    button: {
        backgroundColor: colors.button,
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 5,
        marginBottom: 20,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: colors.buttonText, fontSize: 16, fontWeight: 'bold' },
    link: { color: colors.primary, textAlign: 'center', fontSize: 14 },
});
