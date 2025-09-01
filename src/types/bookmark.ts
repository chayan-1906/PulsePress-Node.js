import {TSupportedSource} from "./news";
import {IBookmark} from "../models/BookmarkSchema";

export const SUPPORTED_BOOKMARK_SORTINGS = ['title', 'source', 'createdAt', 'updatedAt', 'publishedAt'];
type TSupportedBookmarkSorting = typeof SUPPORTED_BOOKMARK_SORTINGS[number];


/** ------------- API response types ------------- */

export interface IToggleBookmarkResponse {
    bookmark?: IBookmark | null;
    added?: boolean;
    deleted?: boolean;
    error?: string;
}

export interface IIsBookmarkedResponse {
    isBookmarked?: boolean;
    error?: string;
}

export interface IGetAllBookmarksResponse {
    bookmarkedArticles?: IBookmark[] | null;
    totalCount?: number;
    currentPage?: number;
    totalPages?: number;
    error?: string;
}

export interface IGetBookmarkCountResponse {
    count?: number;
    error?: string;
}

export interface ISearchBookmarksResponse {
    bookmarks?: IBookmark[] | null;
    totalCount?: number;
    currentPage?: number;
    totalPages?: number;
    error?: string;
}


/** ------------- function params ------------- */

export interface IToggleBookmarkParams {
    email: string;  // for authMiddleware
    articleUrl: string;
    title: string;
    source: string
    description?: string;
    imageUrl?: string;
    publishedAt: Date;
}

export interface IIsBookmarkedParams {
    email: string;  // for authMiddleware
    articleUrl: string;
}

export interface IGetAllBookmarksParams {
    email: string;
    pageSize?: number;
    page?: number;
}

export interface ISearchBookmarksParams {
    email: string;
    q?: string;
    sources?: TSupportedSource;
    sortBy?: TSupportedBookmarkSorting;
    sortOrder?: 'asc' | 'desc';
    pageSize?: number;
    page?: number;
}
