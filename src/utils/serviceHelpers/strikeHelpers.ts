import "colors";
import {IStrikeHistoryEvent, IUserStrikeHistory} from "../../types/ai";
import {STRIKE_COOLDOWN_COUNT, STRIKE_LONG_BLOCK_DURATION, STRIKE_TEMPORARY_BLOCK_COUNT, STRIKE_TEMPORARY_BLOCK_DURATION} from "../../config/config";

/**
 * Calculate time until strike reset (48 hours from last strike)
 */
const calculateTimeUntilReset = (lastStrikeAt?: Date): string | undefined => {
    console.log('Service: calculateTimeUntilReset called'.cyan.italic, {lastStrikeAt});

    if (!lastStrikeAt) {
        return undefined;
    }

    const resetTime = new Date(lastStrikeAt.getTime() + (48 * 60 * 60 * 1000));
    const now = new Date();

    if (resetTime > now) {
        const hoursLeft = Math.ceil((resetTime.getTime() - now.getTime()) / (1000 * 60 * 60));
        if (hoursLeft > 24) {
            const daysLeft = Math.floor(hoursLeft / 24);
            const remainingHours = hoursLeft % 24;
            return `${daysLeft}d ${remainingHours}h`;
        } else {
            return `${hoursLeft}h`;
        }
    }

    return undefined;
}

/**
 * Calculate remaining block time in human-readable format
 */
const calculateBlockTimeRemaining = (blockedUntil?: Date): string | undefined => {
    console.log('Service: calculateBlockTimeRemaining called'.cyan.italic, {blockedUntil});

    if (!blockedUntil) {
        return undefined;
    }

    const now = new Date();
    const remainingMs = blockedUntil.getTime() - now.getTime();
    const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));

    if (remainingMinutes > 60) {
        const hours = Math.floor(remainingMinutes / 60);
        const minutes = remainingMinutes % 60;
        return `${hours}h ${minutes}m`;
    } else {
        return `${remainingMinutes}m`;
    }
};

/**
 * Process and sort strike history events
 */
const processStrikeHistory = (history?: IStrikeHistoryEvent[], limit: number = 10): IUserStrikeHistory[] => {
    console.log('Service: processStrikeHistory called'.cyan.italic, {historyLength: history?.length, limit});

    const strikeHistory: IUserStrikeHistory[] = [];

    if (history && history.length > 0) {
        const sortedHistory = history
            .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()) // Most recent first
            .slice(0, limit);

        for (const event of sortedHistory) {
            strikeHistory.push({
                date: event.appliedAt,
                strikeNumber: event.strikeNumber,
                reason: event.reason,
                blockType: event.blockType,
                blockDuration: event.blockDuration,
            });
        }
    }

    return strikeHistory;
}

/**
 * Calculate next strike penalty based on current strike count
 */
const calculateNextStrikePenalty = (currentCount: number): string => {
    console.log('Service: calculateNextStrikePenalty called'.cyan.italic, {currentCount});

    const cooldownCount = Number.parseInt(STRIKE_COOLDOWN_COUNT!) || 2;
    const tempBlockCount = Number.parseInt(STRIKE_TEMPORARY_BLOCK_COUNT!) || 3;

    if (currentCount < cooldownCount) {
        return `Warning ${currentCount + 1}/${cooldownCount}`;
    } else if (currentCount === cooldownCount) {
        return `${STRIKE_TEMPORARY_BLOCK_DURATION}-minute cooldown`;
    } else {
        return `${STRIKE_LONG_BLOCK_DURATION}-day block`;
    }
};

/**
 * Validate and normalize limit parameter
 */
const validateAndNormalizeLimit = (limit: number, min: number = 1, max: number = 50): number => {
    console.log('Service: validateAndNormalizeLimit called'.cyan.italic, {limit, min, max});

    return Math.min(Math.max(limit, min), max);
}

export {calculateTimeUntilReset, calculateBlockTimeRemaining, processStrikeHistory, calculateNextStrikePenalty, validateAndNormalizeLimit};
