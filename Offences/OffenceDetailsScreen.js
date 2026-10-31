import { useEffect, useRef, useState } from 'react';
import {
    View, Text, TextInput, StyleSheet, Pressable, Alert, ScrollView, Image, Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import {
    fetchOffence, insertOffence, updateOffence, deleteOffence, toDateString, toTimeString,
    buildOffencePayload,
} from '../database/offencesDatabase';
import { useAppTheme } from '../ThemeContext';
import { useAuth } from '../Auth/AuthContext';

const bytesToBase64 = (bytes) => {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
};

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
    const [taking, setTaking] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!offenceId);
    const cameraRef = useRef(null);
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
                        setLocationStatus('ready');
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

    const fetchLocation = async () => {
        setLocationStatus('loading');
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationStatus('error');
                Alert.alert('Permission required', 'Location permission is needed to record where the offence happened.');
                return;
            }
            const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            setLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            });
            setLocationStatus('ready');
        } catch (error) {
            console.error('Error getting location:', error);
            setLocationStatus('error');
            Alert.alert('Error', 'Could not get your location. Make sure location services are enabled.');
        }
    };

    const openCamera = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('Permission required', 'Camera permission is needed to photograph an offence.');
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
            const now = new Date();
            setLocation(null);
            setPhotoUri(picture.uri);
            setOffenceTime(toTimeString(now));
            setCameraOpen(false);
            fetchLocation();
        } catch (error) {
            console.error('Error taking photo:', error);
            Alert.alert('Error', 'Failed to take a photo.');
        } finally {
            setTaking(false);
        }
    };

    const saveOffence = async () => {
        if (!canEdit || saving) return;
        if (isNew && !photoUri) {
            Alert.alert('Warning', 'Take a photo of the offence first.');
            return;
        }
        if (!description.trim()) {
            Alert.alert('Warning', 'Please enter an offence description.');
            return;
        }
        if (isNew && !location) {
            Alert.alert('Warning', 'Location is not available yet. Tap "Update location" and try again.');
            return;
        }
        if (isNew && offenceDate > toDateString()) {
            Alert.alert('Warning', 'The offence date cannot be in the future.');
            return;
        }
        setSaving(true);
        try {
            if (isNew) {
                const response = await fetch(photoUri);
                const buffer = await response.arrayBuffer();
                const result = await insertOffence({
                    description: description.trim(),
                    date: offenceDate,
                    time: offenceTime,
                    userId: user.id,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    image: new Uint8Array(buffer),
                });
                const saved = await fetchOffence(result.lastInsertRowId);
                console.log('Prepared POST payload:', JSON.stringify(buildOffencePayload(saved)));
            } else {
                await updateOffence(offenceId, user.id, { description: description.trim(), date: offenceDate });
            }
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

    const locationText = {
        idle: 'Location: will be detected after the photo is taken',
        loading: 'Location: detecting...',
        error: 'Location: unavailable',
        ready: location
            ? `Location: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
            : 'Location: unavailable',
    }[locationStatus];

    return (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            {!canEdit && (
                <Text style={styles.note}>View-only mode: editing unavailable.</Text>
            )}

            {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
            ) : (
                <View style={[styles.photo, styles.photoPlaceholder]}>
                    <Text style={styles.meta}>No photo yet</Text>
                </View>
            )}

            {isNew && canEdit && (
                <Pressable style={styles.secondaryButton} onPress={openCamera}>
                    <Text style={styles.secondaryButtonText}>{photoUri ? 'Retake photo' : 'Take photo'}</Text>
                </Pressable>
            )}

            <Text style={styles.meta}>{`Offence date: ${offenceDate ?? '-'}`}</Text>
            <Text style={styles.meta}>
                {offenceTime ? `Offence time: ${offenceTime.slice(0, 5)}` : 'Offence time: recorded when the photo is taken'}
            </Text>
            {createdAt && <Text style={styles.meta}>{`Added: ${createdAt}`}</Text>}
            <Text style={styles.meta}>{locationText}</Text>
            {isNew && canEdit && photoUri && locationStatus !== 'loading' && (
                <Pressable style={styles.linkButton} onPress={fetchLocation}>
                    <Text style={styles.linkText}>Update location</Text>
                </Pressable>
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
    secondaryButton: {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 16,
    },
    secondaryButtonText: { color: colors.text, fontWeight: '600' },
    linkButton: { alignSelf: 'flex-start', marginBottom: 4 },
    linkText: { color: colors.primary, fontWeight: '600' },
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
