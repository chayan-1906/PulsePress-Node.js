const generateMissingCode = (missingField: string) => {
    if (missingField) return `${missingField.toUpperCase()}_MISSING`
    else return '';
}

const generateNotFoundCode = (model: string) => {
    if (model) return `${model.toUpperCase()}_NOT_FOUND`;
    else return '';
}

const generateInvalidCode = (model: string) => {
    if (model) return `INVALID_${model.toUpperCase()}`;
    else return '';
}


export {generateMissingCode, generateNotFoundCode, generateInvalidCode};
