import NetInfo from '@react-native-community/netinfo';
import { ApiError, hasAuthToken, isApiConfigured } from '../api/apiClient';
import {
    createRemoteOffence,
    deleteRemoteOffence,
    fetchRemoteOffences,
    updateRemoteOffence,
} from '../api/offencesApi';
import { uploadPhoto } from '../api/cloudinary';
import {
    SYNC_STATUS,
    applyRemoteOffences,
    buildOffencePayload,
    fetchOffenceImage,
    fetchPendingOffences,
    markOffenceSyncError,
    markOffenceSynced,
    purgeOffence,
    setOffenceImageUrl,
} from '../database/offencesDatabase';

const RETRY_DELAYS_MS = [5000, 15000, 45000, 120000, 300000];

let syncing = false;
let pulling = false;
let rerunRequested = false;
let retryTimer = null;
let retryAttempt = 0;

const isOnline = async () => {
    const state = await NetInfo.fetch();
    return !!state.isConnected && state.isInternetReachable !== false;
};

const clearRetry = () => {
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
};

const scheduleRetry = (userId) => {
    clearRetry();
    const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
    retryAttempt += 1;
    retryTimer = setTimeout(() => {
        retryTimer = null;
        runSync(userId);
    }, delay);
};

// Sends one queued record to the server according to its sync_status.
const syncOne = async (offence) => {
    if (offence.sync_status === SYNC_STATUS.PENDING_DELETE) {
        if (offence.server_id != null) {
            try {
                await deleteRemoteOffence(offence.server_id);
            } catch (error) {
                if (!(error instanceof ApiError && error.status === 404)) throw error;
            }
        }
        await purgeOffence(offence.id);
        return;
    }

    let imageUrl = offence.image_url;
    if (!imageUrl && offence.has_image) {
        const bytes = await fetchOffenceImage(offence.id);
        if (bytes) {
            imageUrl = await uploadPhoto(bytes);
            await setOffenceImageUrl(offence.id, imageUrl);
        }
    }

    const payload = buildOffencePayload({ ...offence, image_url: imageUrl });
    const isCreate = offence.sync_status === SYNC_STATUS.PENDING_CREATE || offence.server_id == null;

    let result;
    if (isCreate) {
        result = await createRemoteOffence(payload);
    } else {
        try {
            result = await updateRemoteOffence(offence.server_id, payload);
        } catch (error) {
            // The server no longer has the record: re-create it (idempotent by client_uuid).
            if (error instanceof ApiError && error.status === 404) {
                result = await createRemoteOffence(payload);
            } else {
                throw error;
            }
        }
    }

    const serverId = result?.id ?? offence.server_id;
    if (serverId == null) {
        throw new ApiError('The server response does not contain an offence id.');
    }

    const update = await markOffenceSynced(offence.id, {
        serverId,
        imageUrl,
        expectedUpdatedAt: offence.updated_at,
    });

    // The record was deleted locally while the request was in flight: remove it from the server too.
    if (update.changes === 0) {
        try {
            await deleteRemoteOffence(serverId);
        } catch (error) {
            console.error('Could not remove an orphaned server record:', error);
        }
    }
};

// Push: sends the local queue (pending_create / pending_update / pending_delete) to the server.
export const runSync = async (userId) => {
    if (!userId) return { status: 'skipped', reason: 'No user is logged in.' };
    if (!isApiConfigured()) {
        return { status: 'skipped', reason: 'The server is not configured (EXPO_PUBLIC_API_URL is missing).' };
    }
    if (!hasAuthToken()) {
        return { status: 'skipped', reason: 'Sync is available after logging in to the server while online.' };
    }
    if (syncing) {
        rerunRequested = true;
        return { status: 'busy' };
    }

    syncing = true;
    clearRetry();
    const summary = { status: 'done', synced: 0, failed: 0 };

    try {
        if (!(await isOnline())) {
            return { status: 'offline' };
        }

        const pending = await fetchPendingOffences(userId);
        for (const offence of pending) {
            try {
                await syncOne(offence);
                summary.synced += 1;
            } catch (error) {
                if (error instanceof ApiError && error.isNetwork) {
                    summary.status = 'network_error';
                    break;
                }
                if (error instanceof ApiError && error.status === 401) {
                    summary.status = 'unauthorized';
                    break;
                }
                summary.failed += 1;
                await markOffenceSyncError(offence.id, error.message || 'Sync failed.');
            }
        }
        if (summary.status === 'done' && summary.failed > 0) summary.status = 'partial';
    } catch (error) {
        console.error('Sync error:', error);
        return { status: 'error', message: 'Sync failed because of a local error.' };
    } finally {
        syncing = false;
        if (rerunRequested) {
            rerunRequested = false;
            setTimeout(() => runSync(userId), 0);
        }
    }

    if (summary.status === 'network_error') {
        scheduleRetry(userId);
    } else {
        retryAttempt = 0;
    }
    return summary;
};

// Pull: downloads all offences from the server so guests (and other devices) can see them.
// Works without logging in because reading offences is public.
export const runPull = async () => {
    if (!isApiConfigured()) {
        return { status: 'skipped', reason: 'The server is not configured (EXPO_PUBLIC_API_URL is missing).' };
    }
    if (pulling) return { status: 'busy' };

    pulling = true;
    try {
        if (!(await isOnline())) return { status: 'offline' };
        const data = await fetchRemoteOffences();
        if (!Array.isArray(data?.offences)) {
            throw new ApiError('Unexpected response from the server.');
        }
        await applyRemoteOffences(data.offences);
        return { status: 'done', count: data.offences.length };
    } catch (error) {
        if (error instanceof ApiError && error.isNetwork) return { status: 'network_error' };
        console.error('Pull error:', error);
        return { status: 'error', message: error.message || 'Could not download offences.' };
    } finally {
        pulling = false;
    }
};

// Push first (so local deletions and edits reach the server), then pull.
export const syncAll = async (userId) => {
    const push = await runSync(userId);
    const pull = await runPull();
    return { ...push, pull };
};

// Runs a full sync whenever the device reports a working connection (including right at start-up).
// userId may be null for guests: they only pull.
export const startAutoSync = (userId) => {
    const unsubscribe = NetInfo.addEventListener((state) => {
        if (state.isConnected && state.isInternetReachable !== false) {
            syncAll(userId);
        }
    });
    return () => {
        unsubscribe();
        clearRetry();
        retryAttempt = 0;
    };
};

export const describeSyncResult = (result) => {
    switch (result.status) {
        case 'done':
            return result.synced > 0 ? `Synced ${result.synced} item(s).` : 'Everything is up to date.';
        case 'partial':
            return `Synced ${result.synced}, failed ${result.failed}. Failed items stay on the device and will be retried.`;
        case 'offline':
            return 'No internet connection. Changes will sync automatically when you are back online.';
        case 'network_error':
            return 'The server is unreachable. Sync will be retried automatically.';
        case 'unauthorized':
            return 'Your server session has expired. Log in again to sync.';
        case 'busy':
            return 'Sync is already running.';
        case 'skipped':
            return result.reason;
        default:
            return result.message || 'Sync failed.';
    }
};
