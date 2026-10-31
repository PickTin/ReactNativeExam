import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useAppTheme } from './ThemeContext';

const DEFAULT_REGION = { latitude: 49, longitude: 31.5, latitudeDelta: 12, longitudeDelta: 12 };

// Full-screen map: tap anywhere or drag the marker to choose the offence location.
const LocationPickerModal = ({ visible, initialLocation, onConfirm, onCancel }) => {
    const [picked, setPicked] = useState(initialLocation);
    const { colors } = useAppTheme();
    const styles = makeStyles(colors);

    useEffect(() => {
        if (visible) setPicked(initialLocation);
    }, [visible]);

    const initialRegion = initialLocation
        ? { ...initialLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }
        : DEFAULT_REGION;

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
            <View style={styles.container}>
                <MapView
                    style={StyleSheet.absoluteFill}
                    initialRegion={initialRegion}
                    onPress={(event) => setPicked(event.nativeEvent.coordinate)}
                >
                    {picked && (
                        <Marker
                            coordinate={picked}
                            draggable
                            onDragEnd={(event) => setPicked(event.nativeEvent.coordinate)}
                        />
                    )}
                </MapView>

                <View style={styles.hint}>
                    <Text style={styles.hintText}>Tap the map or drag the marker to set the location</Text>
                </View>

                <View style={styles.controls}>
                    <Pressable style={styles.cancelButton} onPress={onCancel}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.confirmButton, !picked && styles.disabled]}
                        onPress={() => picked && onConfirm(picked)}
                        disabled={!picked}
                    >
                        <Text style={styles.confirmText}>Use this location</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    hint: {
        position: 'absolute',
        top: 50,
        alignSelf: 'center',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 14,
    },
    hintText: { color: colors.text },
    controls: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    cancelButton: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingVertical: 14,
        paddingHorizontal: 22,
    },
    cancelText: { color: colors.text, fontWeight: '600' },
    confirmButton: {
        backgroundColor: colors.button,
        borderRadius: 10,
        paddingVertical: 14,
        paddingHorizontal: 22,
    },
    confirmText: { color: colors.buttonText, fontWeight: 'bold' },
    disabled: { opacity: 0.5 },
});

export default LocationPickerModal;
