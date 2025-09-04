import "colors";

/**
 * Validate and process AI-generated tags
 */
const validateAndProcessTags = (parsed: any, maxTags: number = 5): string[] => {
    console.log('Service: validateAndProcessTags called'.cyan.italic, {parsed, maxTags});

    if (!Array.isArray(parsed)) {
        console.error('Service Error: Response is not an array:'.red.bold, parsed);
        return [];
    }

    const validTags: string[] = parsed
        .filter((tag: string) => tag.trim().length > 0 && tag.trim().length <= 20)
        .map(tag => tag.trim());

    if (validTags.length === 0) {
        console.error('Service Error: No valid tags found in response:'.red.bold, parsed);
        return [];
    }

    return validTags.slice(0, maxTags);
}

export {validateAndProcessTags};
