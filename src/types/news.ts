interface Article {
    source: {
        id: string | null;
        name: string | null;
    };
    author: string | null;
    title: string | null;
    description: string | null;
    url: string | null;
    urlToImage: string | null;
    publishedAt: string | null;
    content: string | null;
}

export interface TopHeadlinesAPIResponse {
    status: string;
    totalResults: number;
    articles: Article[];
}

export interface TopHeadlinesParams {
    country?: string;
    category?: string;
    sources?: string
    q?: string;
    pageSize?: number;
    page?: number;
}
