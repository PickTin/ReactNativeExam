import { ApiError, api } from './apiClient';
import { bytesToBase64 } from '../utils/imageUtils';

const UPLOAD_TIMEOUT_MS = 30000;

export const uploadPhoto = async (bytes) => {
    const upload = await api.post('/uploads/signature');

    if (!upload?.signature || !upload?.cloud_name || !upload?.api_key) {
        throw new ApiError('Unexpected response from the upload signature endpoint.');
    }

    const base64 = bytesToBase64(bytes);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${upload.cloud_name}/image/upload`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                file: `data:image/jpeg;base64,${base64}`,
                api_key: String(upload.api_key),
                timestamp: String(upload.timestamp),
                folder: upload.folder,
                signature: upload.signature,
            }).toString(),
        }
    );

    const data = await response.json();

    if (!response.ok || !data?.secure_url) {
        throw new ApiError(data?.error?.message || 'Photo upload failed.', {
            status: response.status,
            data,
        });
    }

    return data.secure_url;
};
