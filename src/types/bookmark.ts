import {IBookmark} from "../models/BookmarkSchema";


/** ------------- API response types ------------- */

export interface ToggleBookmarkResponse {
    bookmark?: IBookmark | null;
    added?: boolean;
    deleted?: boolean;
    error?: string;
}

export interface IsBookmarkedResponse {
    isBookmarked?: boolean;
    error?: string;
}

export interface GetAllBookmarksResponse {
    bookmarkedArticles?: IBookmark[] | null;
    totalCount?: number;
    currentPage?: number;
    totalPages?: number;
    error?: string;
}

export interface GetBookmarkCountResponse {
    count?: number;
    error?: string;
}


/** ------------- function params ------------- */

export interface ToggleBookmarkParams {
    email: string;
    articleUrl: string;
    title: string;
    source: string
    description?: string;
    imageUrl?: string;
}

export interface IsBookmarkedParams {
    email: string;
    articleUrl: string;
}

export interface GetAllBookmarksParams {
    email: string;
    pageSize?: number;
    page?: number;
}
