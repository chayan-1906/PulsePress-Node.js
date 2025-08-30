import {GUARDIAN_QUOTA_REQUESTS, NEWSAPI_QUOTA_REQUESTS, NEWSAPIORG_QUOTA_MS} from "./config";

const API_ENDPOINTS = {
    newsapi: {
        baseUrl: 'https://newsapi.org/v2',
        quotaRequests: Number(NEWSAPI_QUOTA_REQUESTS),
        quotaWindowMs: Number(NEWSAPIORG_QUOTA_MS),
    },
    guardian: {
        baseUrl: 'https://content.guardianapis.com',
        quotaRequests: Number(GUARDIAN_QUOTA_REQUESTS),
    },
    nyTimes: {
        baseUrl: 'https://content.guardianapis.com',
        quotaRequests: Number(GUARDIAN_QUOTA_REQUESTS),
    },
}

export {API_ENDPOINTS};
