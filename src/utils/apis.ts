const BASE_URL = 'https://newsapi.org/v2';

const apis = {
    topHeadlinesApi: function ({country, category, sources, q, pageSize, page}: { country?: string; category?: string; sources?: string; q?: string; pageSize?: number; page?: number; }) {
        let baseUrl = `${BASE_URL}/top-headlines`;
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
}

export {apis};
