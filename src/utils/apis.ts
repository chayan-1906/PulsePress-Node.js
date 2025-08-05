const NEWSAPI_BASE_URL = 'https://newsapi.org/v2';
const GUARDIAN_BASE_URL = 'https://content.guardianapis.com';
const NYTIMES_BASE_URL = 'https://api.nytimes.com/svc';

const apis = {
    // NewsAPI.org endpoints
    topHeadlinesApi: function ({country, category, sources, q, pageSize, page}: { country?: string; category?: string; sources?: string; q?: string; pageSize?: number; page?: number; }) {
        let baseUrl = `${NEWSAPI_BASE_URL}/top-headlines`;
        let queryParams = [];
        if (country) {
            queryParams.push(`country=${country}`);
        }
        if (category) {
            queryParams.push(`category=${category}`);
        }
        if (sources) {
            queryParams.push(`sources=${sources}`);
        }
        if (q) {
            queryParams.push(`q=${q}`);
        }
        if (pageSize && pageSize !== 0) {
            queryParams.push(`pageSize=${pageSize}`);
        }
        if (page && page !== 0) {
            queryParams.push(`page=${page}`);
        }

        if (queryParams.length > 0) {
            baseUrl += '?' + queryParams.join('&');
        }

        return baseUrl;
    },
    fetchEverythingApi: function ({sources, from, to, sortBy, language, q, pageSize, page}: {
        sources?: string;
        from?: string;
        to?: string;
        sortBy?: string;
        language?: string;
        q?: string;
        pageSize?: number;
        page?: number;
    }) {
        let baseUrl = `${NEWSAPI_BASE_URL}/everything`;
        let queryParams = [];
        if (sources) {
            queryParams.push(`sources=${sources}`);
        }
        if (from) {
            queryParams.push(`from=${from}`);
        }
        if (to) {
            queryParams.push(`to=${to}`);
        }
        if (sortBy) {
            queryParams.push(`sortBy=${sortBy}`);
        }
        if (language) {
            queryParams.push(`language=${language}`);
        }
        if (q) {
            queryParams.push(`q=${q}`);
        }
        if (pageSize && pageSize !== 0) {
            queryParams.push(`pageSize=${pageSize}`);
        }
        if (page && page !== 0) {
            queryParams.push(`page=${page}`);
        }

        if (queryParams.length > 0) {
            baseUrl += '?' + queryParams.join('&');
        }

        return baseUrl;
    },

    // Guardian API endpoints
    guardianSearchApi: function ({q, section, fromDate, toDate, orderBy, pageSize, page}: {
        q?: string;
        section?: string;
        fromDate?: string;
        toDate?: string;
        orderBy?: string;
        pageSize?: number;
        page?: number;
    }) {
        let baseUrl = `${GUARDIAN_BASE_URL}/search`;
        let queryParams = ['show-fields=headline,byline,thumbnail,short-url,body-text'];

        if (q) {
            queryParams.push(`q=${encodeURIComponent(q)}`);
        }
        if (section) {
            queryParams.push(`section=${section}`);
        }
        if (fromDate) {
            queryParams.push(`from-date=${fromDate}`);
        }
        if (toDate) {
            queryParams.push(`to-date=${toDate}`);
        }
        if (orderBy) {
            queryParams.push(`order-by=${orderBy}`);
        }
        if (pageSize && pageSize !== 0) {
            queryParams.push(`page-size=${pageSize}`);
        }
        if (page && page !== 0) {
            queryParams.push(`page=${page}`);
        }

        return `${baseUrl}?${queryParams.join('&')}`;
    },

    // NYTimes API endpoints
    nytimesSearchApi: function ({q, section, sort, fromDate, toDate, pageSize, page}: {
        q?: string;
        section?: string;
        sort?: string;
        fromDate?: string;
        toDate?: string;
        pageSize?: number;
        page?: number;
    }) {
        let baseUrl = `${NYTIMES_BASE_URL}/search/v2/articlesearch.json`;
        let queryParams = [];

        if (q) {
            queryParams.push(`q=${encodeURIComponent(q)}`);
        }
        if (section) {
            queryParams.push(`fq=section_name:("${section}")`);
        }
        if (sort) {
            queryParams.push(`sort=${sort}`);
        }
        if (fromDate) {
            queryParams.push(`begin_date=${fromDate.replace(/-/g, '')}`);
        }
        if (toDate) {
            queryParams.push(`end_date=${toDate.replace(/-/g, '')}`);
        }
        if (page && page !== 0) {
            queryParams.push(`page=${page - 1}`); // 0-based indexing
        }

        return `${baseUrl}?${queryParams.join('&')}`;
    },

    nytimesTopStoriesApi: function ({section}: { section?: string }) {
        const sectionPath = section || 'home';
        return `${NYTIMES_BASE_URL}/topstories/v2/${sectionPath}.json`;
    }
}

export {apis};
