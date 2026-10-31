import { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import { fetchAllOffences } from '../database/offencesDatabase';
import { useAppTheme } from '../ThemeContext';

const DEFAULT_REGION = { latitude: 49, longitude: 31.5, latitudeDelta: 12, longitudeDelta: 12 };

const getRegion = (items) => {
    if (items.length === 0) return DEFAULT_REGION;
    const lats = items.map((item) => item.latitude);
    const lngs = items.map((item) => item.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.01),
        longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.01),
    };
};

const MapScreen = ({ navigation }) => {
    const [offences, setOffences] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const { colors } = useAppTheme();
    const styles = makeStyles(colors);

    useFocusEffect(useCallback(() => {
        const load = async () => {
            try {
                const all = await fetchAllOffences();
                setOffences(all.filter((item) => item.latitude != null && item.longitude != null));
            } catch (error) {
                console.error('Error loading map data:', error);
            } finally {
                setLoaded(true);
            }
        };
        load();
    }, []));

    if (!loaded) {
        return (
            <View style={styles.center}>
                <Text style={styles.message}>Loading map...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <MapView
                key={offences.map((item) => item.id).join(',')}
                style={StyleSheet.absoluteFill}
                initialRegion={getRegion(offences)}
            >
                {offences.map((item) => (
                    <Marker
                        key={item.id}
                        coordinate={{ latitude: item.latitude, longitude: item.longitude }}
                        title={item.description}
                        description={item.time ? `${item.date} ${item.time.slice(0, 5)}` : item.date}
                        onCalloutPress={() => navigation.navigate('OffenceDetails', { offenceId: item.id, date: item.date })}
                    />
                ))}
            </MapView>
            {offences.length === 0 && (
                <View style={styles.banner}>
                    <Text style={styles.message}>No offences with location yet.</Text>
                </View>
            )}
        </View>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    message: { color: colors.text },
    banner: {
        position: 'absolute',
        top: 16,
        alignSelf: 'center',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 14,
    },
});

export default MapScreen;
