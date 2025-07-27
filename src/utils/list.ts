const isListEmpty = (list: unknown[] | undefined): list is undefined => {
    return !list || !Array.isArray(list) || list.length === 0;
}

const hasInvalidItems = (list: unknown[], validList: unknown[]): boolean => !isListEmpty(list) && !list.every(item => validList.includes(item));

export {isListEmpty, hasInvalidItems};
