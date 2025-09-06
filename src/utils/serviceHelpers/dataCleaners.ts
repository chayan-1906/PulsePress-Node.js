import "colors";

/**
 * Clean and filter arrays of strings, removing empty or invalid items
 */
const cleanArray = (arr: any): string[] => {
    console.log('Service: cleanArray called'.cyan.italic, {inputType: typeof arr, isArray: Array.isArray(arr)});

    return Array.isArray(arr) ? arr.filter(item => item && item.trim().length > 0) : [];
}

/**
 * Clean stakeholder analysis object by filtering arrays and ensuring proper structure
 */
const cleanStakeholderAnalysis = (stakeholderAnalysis: any) => {
    console.log('Service: cleanStakeholderAnalysis called'.cyan.italic, {stakeholderAnalysis});

    const safeAnalysis = stakeholderAnalysis || {};

    return {
        winners: cleanArray(safeAnalysis.winners || []),
        losers: cleanArray(safeAnalysis.losers || []),
        affected: cleanArray(safeAnalysis.affected || []),
    };
}

export {cleanArray, cleanStakeholderAnalysis};
