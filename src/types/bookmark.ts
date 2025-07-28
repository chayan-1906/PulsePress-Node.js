import {SupportedSource} from "./news";
import {IBookmark} from "../models/BookmarkSchema";

export const SUPPORTED_BOOKMARK_SORTINGS = ['title', 'source', 'createdAt', 'updatedAt', 'publishedAt'];
type SupportedBookmarkSorting = typeof SUPPORTED_BOOKMARK_SORTINGS[number];


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

export interface SearchBookmarksResponse {
    bookmarks?: IBookmark[] | null;
    totalCount?: number;
    currentPage?: number;
    totalPages?: number;
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
    publishedAt: Date;
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

export interface SearchBookmarksParams {
    email: string;
    q?: string;
    sources?: SupportedSource;
    sortBy?: SupportedBookmarkSorting;
    sortOrder?: 'asc' | 'desc';
    pageSize?: number;
    page?: number;
}
