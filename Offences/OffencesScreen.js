import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
    fetchAllOffences, fetchOffencesByDate, toDateString, SYNC_STATUS,
} from '../database/offencesDatabase';
import { useAppTheme } from '../ThemeContext';
import { useAuth } from '../Auth/AuthContext';

const OffencesScreen = ({ route, navigation }) => {
    const date = route.params?.date;
    const [offences, setOffences] = useState([]);
    const { colors } = useAppTheme();
    const { user } = useAuth();
    const styles = makeStyles(colors);

    useFocusEffect(useCallback(() => {
        const load = async () => {
            try {
                setOffences(date ? await fetchOffencesByDate(date) : await fetchAllOffences());
            } catch (error) {
                console.error('Error loading offences:', error);
            }
        };
        load();
    }, [date]));

    const handleAdd = () => {
        if (!user) {
            Alert.alert(
                'Login Required',
                'To add an offence, please log in to your account.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Log In', onPress: () => navigation.navigate('Login') },
                ]
            );
            return;
        }
        navigation.navigate('OffenceDetails', { date: date ?? toDateString() });
    };

    const buildMeta = (item) => {
        const parts = [];
        if (!date) parts.push(item.time ? `${item.date} ${item.time.slice(0, 5)}` : item.date);
        if (user && item.user_id === user.id) {
            parts.push(item.sync_status === SYNC_STATUS.SYNCED ? 'Synced' : 'Pending sync');
        }
        return parts.join(' · ');
    };

    return (
        <View style={styles.container}>
            {date ? <Text style={styles.date}>{date}</Text> : null}
            {!user && (
                <Text style={styles.guestNote}>Guest mode: view-only access.</Text>
            )}
            <Pressable style={styles.addButton} onPress={handleAdd}>
                <Text style={styles.addButtonText}>+ Add Offence</Text>
            </Pressable>
            <FlatList
                data={offences}
                keyExtractor={(item) => item.id.toString()}
                ListEmptyComponent={<Text style={styles.empty}>No offences found.</Text>}
                renderItem={({ item }) => (
                    <Pressable
                        style={styles.item}
                        onPress={() => navigation.navigate('OffenceDetails', { offenceId: item.id, date: item.date })}
                    >
                        <View style={styles.itemBody}>
                            <Text style={styles.itemTitle} numberOfLines={2}>{item.description}</Text>
                            {buildMeta(item) ? <Text style={styles.itemMeta}>{buildMeta(item)}</Text> : null}
                        </View>
                        <Text style={styles.arrow}>›</Text>
                    </Pressable>
                )}
            />
        </View>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: colors.background },
    date: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: colors.text },
    guestNote: { color: colors.secondaryText, marginBottom: 12 },
    addButton: {
        backgroundColor: colors.button,
        padding: 13,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 16,
    },
    addButtonText: { color: colors.buttonText, fontWeight: 'bold' },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        borderRadius: 10,
        marginBottom: 8,
    },
    itemBody: { flex: 1 },
    itemTitle: { fontSize: 16, color: colors.text },
    itemMeta: { fontSize: 12, marginTop: 4, color: colors.secondaryText },
    arrow: { fontSize: 24, marginLeft: 10, color: colors.secondaryText },
    empty: { textAlign: 'center', marginTop: 30, color: colors.secondaryText },
});

export default OffencesScreen;