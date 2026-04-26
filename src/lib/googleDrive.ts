/**
 * Google Drive API Utilities
 */

const DRIVE_API_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

declare const google: any;

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

interface DriveFileResponse {
  id: string;
  name: string;
  mimeType: string;
}

export const requestDriveAccess = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!CLIENT_ID) {
      reject(new Error('VITE_GOOGLE_CLIENT_ID is not configured. Please add it to your environment variables.'));
      return;
    }
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.access_token) {
            localStorage.setItem('google_access_token', response.access_token);
            localStorage.setItem('google_token_expiry', (Date.now() + (response.expires_in || 3600) * 1000).toString());
            resolve(response.access_token);
          } else {
            console.error('GIS Error response:', response);
            reject(new Error('Failed to get access token: ' + (response.error || 'User cancelled or failed to authorize')));
          }
        },
      });
      client.requestAccessToken();
    } catch (error) {
      reject(error);
    }
  });
};

export async function uploadToDrive(file: File): Promise<string> {
  let token = localStorage.getItem('google_access_token');
  const expiry = localStorage.getItem('google_token_expiry');

  if (!token || (expiry && Date.now() > parseInt(expiry))) {
    // Attempt to refresh or request new token
    try {
      token = await requestDriveAccess();
    } catch (err) {
      throw new Error('Google Drive access required. Please click "Connect Google Drive" or sign in with Google.');
    }
  }

  const metadata = {
    name: file.name,
    mimeType: file.type,
  };

  const boundary = 'foo_bar_baz';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const metadataPart = new Blob([
    delimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),
    '\r\n'
  ], { type: 'application/json' });

  const filePartHeader = new Blob([
    delimiter,
    'Content-Type: ', file.type, '\r\n\r\n'
  ]);

  const footer = new Blob([close_delim]);

  const body = new Blob([metadataPart, filePartHeader, file, footer], { type: 'multipart/related; boundary=' + boundary });

  const response = await fetch(DRIVE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: body,
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Drive upload error:', errorData);
    
    if (response.status === 401) {
      localStorage.removeItem('google_access_token');
      throw new Error('Google session expired. Please try connecting Google Drive again.');
    }
    
    if (errorData.error?.message?.includes('disabled')) {
      throw new Error(`Google Drive API is disabled. Please enable it in the Google Cloud Console.`);
    }

    throw new Error(errorData.error?.message || 'Failed to upload to Google Drive');
  }

  const data: DriveFileResponse = await response.json();
  
  // To get a webViewLink, we need to fetch the file metadata after upload
  const metaUrl = `https://www.googleapis.com/drive/v3/files/${data.id}?fields=webViewLink`;

  const fileMetaResponse = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (fileMetaResponse.ok) {
    const metaData = await fileMetaResponse.json();
    return metaData.webViewLink;
  }

  return `https://drive.google.com/open?id=${data.id}`;
}

export function hasDriveAccess(): boolean {
  const token = localStorage.getItem('google_access_token');
  const expiry = localStorage.getItem('google_token_expiry');
  return !!token && (!expiry || Date.now() < parseInt(expiry));
}

export function loadPicker(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!(window as any).gapi) {
      reject(new Error('Google API library not loaded'));
      return;
    }
    (window as any).gapi.load('picker', { callback: resolve });
  });
}

export const openPicker = async (): Promise<any> => {
  let token = localStorage.getItem('google_access_token');
  const expiry = localStorage.getItem('google_token_expiry');

  if (!token || (expiry && Date.now() > parseInt(expiry))) {
    token = await requestDriveAccess();
  }

  await loadPicker();

  if (!import.meta.env.VITE_GOOGLE_API_KEY) {
    throw new Error('VITE_GOOGLE_API_KEY is not configured. Please add it to your environment variables.');
  }

  return new Promise((resolve, reject) => {
    try {
      const picker = new (window as any).google.picker.PickerBuilder()
        .addView((window as any).google.picker.ViewId.DOCS)
        .setOAuthToken(token)
        .setDeveloperKey(import.meta.env.VITE_GOOGLE_API_KEY)
        .setCallback((data: any) => {
          if (data.action === (window as any).google.picker.Action.PICKED) {
            resolve(data.docs[0]);
          } else if (data.action === (window as any).google.picker.Action.CANCEL) {
            reject(new Error('Picker cancelled'));
          }
        })
        .build();
      picker.setVisible(true);
    } catch (e) {
      reject(e);
    }
  });
};

