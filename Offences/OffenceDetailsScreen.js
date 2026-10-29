import { useEffect, useState } from 'react';
import {
    View, Text, TextInput, StyleSheet, Pressable, Alert, ScrollView,
} from 'react-native';
import { fetchOffence, insertOffence, updateOffence, deleteOffence } from '../database/offencesDatabase';
import { useAppTheme } from '../ThemeContext';
import { useAuth } from '../Auth/AuthContext';

const OffenceDetailsScreen = ({ route, navigation }) => {
    const { offenceId, date } = route.params;
    const [description, setDescription] = useState('');
    const [offenceDate, setOffenceDate] = useState(date);
    const [ownerId, setOwnerId] = useState(null);
    const [loading, setLoading] = useState(!!offenceId);
    const { colors } = useAppTheme();
    const { user } = useAuth();
    const styles = makeStyles(colors);

    const canEdit = !!user && (!offenceId || ownerId === user.id);

    useEffect(() => {
        const loadOffence = async () => {
            if (!offenceId) {
                setLoading(false);
                return;
            }
            try {
                const offence = await fetchOffence(offenceId);
                if (offence) {
                    setDescription(offence.description);
                    setOffenceDate(offence.date);
                    setOwnerId(offence.user_id);
                }
            } catch (error) {
                console.error('Error loading offence:', error);
                Alert.alert('Error', 'Failed to load offence.');
            } finally {
                setLoading(false);
            }
        };
        loadOffence();
    }, [offenceId]);

    const saveOffence = async () => {
        if (!canEdit) return;
        if (!description.trim()) {
            Alert.alert('Warning', 'Please enter an offence description.');
            return;
        }
        try {
            if (offenceId) {
                await updateOffence(offenceId, user.id, { description: description.trim(), date: offenceDate });
            } else {
                await insertOffence({ description: description.trim(), date: offenceDate, userId: user.id });
            }
            navigation.goBack();
        } catch (error) {
            console.error('Error saving offence:', error);
            Alert.alert('Error', 'Failed to save offence.');
        }
    };

    const removeOffence = () => {
        Alert.alert('Delete', 'Are you sure you want to delete this offence?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteOffence(offenceId, user.id);
                        navigation.goBack();
                    } catch (error) {
                        console.error('Error deleting offence:', error);
                        Alert.alert('Error', 'Failed to delete offence.');
                    }
                },
            },
        ]);
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.text }}>Loading...</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Text style={styles.date}>Date: {offenceDate}</Text>
            {!canEdit && (
                <Text style={styles.note}>View-only mode: editing unavailable.</Text>
            )}
            <Text style={styles.label}>Description</Text>
            <TextInput
                style={[styles.input, styles.description]}
                placeholder="Describe the offence"
                placeholderTextColor={colors.placeholder}
                value={description}
                onChangeText={setDescription}
                editable={canEdit}
                multiline
                textAlignVertical="top"
                selectionColor={colors.primary}
            />
            {canEdit && (
                <Pressable style={styles.saveButton} onPress={saveOffence}>
                    <Text style={styles.buttonText}>{offenceId ? 'Save Changes' : 'Add'}</Text>
                </Pressable>
            )}
            {canEdit && offenceId && (
                <Pressable style={styles.deleteButton} onPress={removeOffence}>
                    <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
            )}
        </ScrollView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flexGrow: 1, padding: 20, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    date: { fontSize: 18, marginBottom: 16, color: colors.secondaryText },
    note: { marginBottom: 16, color: colors.secondaryText },
    label: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: colors.text },
    input: {
        backgroundColor: colors.input,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        padding: 12,
        marginBottom: 20,
        fontSize: 16,
        color: colors.text,
    },
    description: { minHeight: 140 },
    saveButton: {
        backgroundColor: colors.button,
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 12,
    },
    deleteButton: {
        backgroundColor: colors.danger,
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    buttonText: { color: colors.buttonText, fontSize: 16, fontWeight: 'bold' },
    deleteButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

export default OffenceDetailsScreen;