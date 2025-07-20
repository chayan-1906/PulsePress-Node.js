import type {OAuth2Client} from 'google-auth-library';
import {GOOGLE_CLIENT_SECRET, REDIRECT_URI, WEB_GOOGLE_CLIENT_ID} from "../config/config";

let oauth2Client: OAuth2Client;

const getOAuth2Client = async (): Promise<OAuth2Client> => {
    if (!oauth2Client) {
        const {google} = await import('googleapis');
        oauth2Client = new google.auth.OAuth2(WEB_GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
    }
    return oauth2Client;
}

const getAuthUrl = async () => {
    await getOAuth2Client();
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
        ],
        prompt: 'consent',
    });
}

export {getOAuth2Client, getAuthUrl};
