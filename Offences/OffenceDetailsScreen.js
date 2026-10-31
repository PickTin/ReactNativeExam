import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef, useState } from 'react';
import {
    View, Text, TextInput, StyleSheet, Pressable, Alert, ScrollView, Image, Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import {
    fetchOffence, insertOffence, updateOffence, deleteOffence, toDateString, toTimeString,
} from '../database/offencesDatabase';
import { runSync } from '../sync/syncService';
import { bytesToBase64 } from '../utils/imageUtils';
import { useAppTheme } from '../ThemeContext';
import { useAuth } from '../Auth/AuthContext';
import LocationPickerModal from '../LocationPickerModal';

const LOCATION_TIMEOUT_MS = 10000;

// Rejects if the promise does not settle in time (GPS can hang with a weak signal).
const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Location request timed out.')), ms);
    promise.then(
        (value) => { clearTimeout(timer); resolve(value); },
        (error) => { clearTimeout(timer); reject(error); }
    );
});

const OffenceDetailsScreen = ({ route, navigation }) => {
    const { offenceId, date } = route.params;
    const [description, setDescription] = useState('');
    const [offenceDate, setOffenceDate] = useState(offenceId ? null : (date ?? toDateString()));
    const [offenceTime, setOffenceTime] = useState(null);
    const [createdAt, setCreatedAt] = useState(null);
    const [ownerId, setOwnerId] = useState(null);
    const [photoUri, setPhotoUri] = useState(null);
    const [location, setLocation] = useState(null);
    const [locationStatus, setLocationStatus] = useState('idle');
    const [cameraOpen, setCameraOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [taking, setTaking] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!offenceId);
    const cameraRef = useRef(null);
    const manualLocationRef = useRef(false);
    const [permission, requestPermission] = useCameraPermissions();
    const { colors } = useAppTheme();
    const { user } = useAuth();
    const styles = makeStyles(colors);

    const isNew = !offenceId;
    const canEdit = !!user && (isNew || ownerId === user.id);

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
                    setOffenceTime(offence.time);
                    const created = new Date(offence.created_at);
                    setCreatedAt(`${toDateString(created)} ${toTimeString(created).slice(0, 5)}`);
                    setOwnerId(offence.user_id);
                    if (offence.latitude != null && offence.longitude != null) {
                        setLocation({ latitude: offence.latitude, longitude: offence.longitude });
                    }
                    if (offence.image_url) {
                        setPhotoUri(offence.image_url);
                    } else if (offence.image) {
                        setPhotoUri(`data:image/jpeg;base64,${bytesToBase64(offence.image)}`);
                    }
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

    // Location is optional: failures never block the form. With silent = true no alerts are shown.
    const fetchLocation = async (silent = false) => {
        setLocationStatus('loading');
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationStatus('unavailable');
                if (!silent) {
                    Alert.alert('Permission denied', 'Location permission was denied. You can still choose the location on the map.');
                }
                return;
            }
            const position = await withTimeout(
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                LOCATION_TIMEOUT_MS
            );
            if (silent && manualLocationRef.current) {
                setLocationStatus('ready');
                return;
            }
            manualLocationRef.current = false;
            setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
            setLocationStatus('ready');
        } catch (error) {
            console.error('Error getting location:', error);
            setLocationStatus('unavailable');
            if (!silent) {
                Alert.alert('Location unavailable', 'Could not get your location. Check that location services are enabled, or choose the location on the map.');
            }
        }
    };

    useEffect(() => {
        if (isNew && canEdit) fetchLocation(true);
    }, [isNew, canEdit]);

    const confirmPickedLocation = (coordinate) => {
        manualLocationRef.current = true;
        setLocation({ latitude: coordinate.latitude, longitude: coordinate.longitude });
        setLocationStatus('ready');
        setPickerOpen(false);
    };

    const clearLocation = () => {
        manualLocationRef.current = true;
        setLocation(null);
        setLocationStatus('idle');
    };

    const openCamera = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('Permission required', 'Camera permission is needed to take a photo. You can save the offence without a photo.');
                return;
            }
        }
        setCameraOpen(true);
    };

    const takePhoto = async () => {
        if (!cameraRef.current || taking) return;
        setTaking(true);
        try {
            const picture = await cameraRef.current.takePictureAsync({ quality: 0.5 });
            setPhotoUri(picture.uri);
            setCameraOpen(false);
        } catch (error) {
            console.error('Error taking photo:', error);
            Alert.alert('Error', 'Failed to take a photo.');
        } finally {
            setTaking(false);
        }
    };

    const saveOffence = async () => {
        if (!canEdit || saving) return;
        if (!description.trim()) {
            Alert.alert('Warning', 'Please enter an offence description.');
            return;
        }
        if (isNew && offenceDate > toDateString()) {
            Alert.alert('Warning', 'The offence date cannot be in the future.');
            return;
        }
        setSaving(true);
        try {
            const latitude = location ? location.latitude : null;
            const longitude = location ? location.longitude : null;
            if (isNew) {
                let image = null;
                if (photoUri) {
                    const base64 = await FileSystem.readAsStringAsync(photoUri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });
                    const binary = atob(base64);
                    image = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) {
                        image[i] = binary.charCodeAt(i);
                    }
                }
                await insertOffence({
                    description: description.trim(),
                    date: offenceDate,
                    time: toTimeString(),
                    userId: user.id,
                    latitude,
                    longitude,
                    image,
                });
            } else {
                await updateOffence(offenceId, user.id, {
                    description: description.trim(),
                    date: offenceDate,
                    latitude,
                    longitude,
                });
            }
            const syncResult = await runSync(user.id);
            console.log('[SYNC DIAGNOSTICS]', JSON.stringify(syncResult));
            navigation.goBack();
        } catch (error) {
            console.error('Error saving offence:', error);
            Alert.alert('Error', 'Failed to save offence.');
        } finally {
            setSaving(false);
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
                        runSync(user.id);
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

    let locationText = 'Location: not set';
    if (location) {
        locationText = `Location: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
    } else if (locationStatus === 'loading') {
        locationText = 'Location: detecting...';
    } else if (locationStatus === 'unavailable') {
        locationText = 'Location: not set (GPS unavailable)';
    }

    return (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            {!canEdit && (
                <Text style={styles.note}>View-only mode: editing unavailable.</Text>
            )}

            {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
            ) : (
                <View style={[styles.photo, styles.photoPlaceholder]}>
                    <Text style={styles.meta}>{isNew ? 'No photo (optional)' : 'No photo'}</Text>
                </View>
            )}

            {isNew && canEdit && (
                <View style={styles.row}>
                    <Pressable style={styles.chip} onPress={openCamera}>
                        <Text style={styles.chipText}>{photoUri ? 'Retake photo' : 'Take photo'}</Text>
                    </Pressable>
                    {photoUri && (
                        <Pressable style={styles.chip} onPress={() => setPhotoUri(null)}>
                            <Text style={styles.chipText}>Remove photo</Text>
                        </Pressable>
                    )}
                </View>
            )}

            <Text style={styles.meta}>{`Offence date: ${offenceDate ?? '-'}`}</Text>
            <Text style={styles.meta}>
                {offenceTime ? `Offence time: ${offenceTime.slice(0, 5)}` : 'Offence time: set automatically when saved'}
            </Text>
            {createdAt && <Text style={styles.meta}>{`Added: ${createdAt}`}</Text>}

            <Text style={styles.meta}>{locationText}</Text>
            {canEdit && (
                <View style={styles.row}>
                    <Pressable
                        style={[styles.chip, locationStatus === 'loading' && styles.disabled]}
                        onPress={() => fetchLocation(false)}
                        disabled={locationStatus === 'loading'}
                    >
                        <Text style={styles.chipText}>Use my location</Text>
                    </Pressable>
                    <Pressable style={styles.chip} onPress={() => setPickerOpen(true)}>
                        <Text style={styles.chipText}>Choose on map</Text>
                    </Pressable>
                    {location && (
                        <Pressable style={styles.chip} onPress={clearLocation}>
                            <Text style={styles.chipText}>Clear location</Text>
                        </Pressable>
                    )}
                </View>
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
                <Pressable style={[styles.saveButton, saving && styles.disabled]} onPress={saveOffence} disabled={saving}>
                    <Text style={styles.buttonText}>{isNew ? 'Add' : 'Save Changes'}</Text>
                </Pressable>
            )}
            {canEdit && !isNew && (
                <Pressable style={styles.deleteButton} onPress={removeOffence}>
                    <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
            )}

            <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
                <View style={styles.cameraContainer}>
                    <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
                    <View style={styles.cameraControls}>
                        <Pressable style={styles.cameraCancel} onPress={() => setCameraOpen(false)}>
                            <Text style={styles.cameraCancelText}>Cancel</Text>
                        </Pressable>
                        <Pressable style={[styles.shutter, taking && styles.disabled]} onPress={takePhoto} disabled={taking} />
                        <View style={styles.cameraCancel} />
                    </View>
                </View>
            </Modal>

            <LocationPickerModal
                visible={pickerOpen}
                initialLocation={location}
                onConfirm={confirmPickedLocation}
                onCancel={() => setPickerOpen(false)}
            />
        </ScrollView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flexGrow: 1, padding: 20, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    note: { marginBottom: 16, color: colors.secondaryText },
    photo: { width: '100%', height: 220, borderRadius: 10, marginBottom: 12 },
    photoPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    meta: { fontSize: 15, marginBottom: 8, color: colors.secondaryText },
    row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
    chip: {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        borderRadius: 10,
        paddingVertical: 9,
        paddingHorizontal: 14,
        marginRight: 8,
        marginBottom: 8,
    },
    chipText: { color: colors.text, fontWeight: '600' },
    label: { fontSize: 16, fontWeight: 'bold', marginTop: 12, marginBottom: 8, color: colors.text },
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
    description: { minHeight: 120 },
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
    disabled: { opacity: 0.6 },
    buttonText: { color: colors.buttonText, fontSize: 16, fontWeight: 'bold' },
    deleteButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    cameraContainer: { flex: 1, backgroundColor: '#000000' },
    cameraControls: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    cameraCancel: { width: 80 },
    cameraCancelText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    shutter: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#FFFFFF',
        borderWidth: 4,
        borderColor: '#BBBBBB',
    },
});

export default OffenceDetailsScreen;
