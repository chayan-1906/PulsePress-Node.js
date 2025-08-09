import "colors";
import StrikeService from "./StrikeService";
import {getUserByEmail} from "./AuthService";
import {STRIKE_LONG_BLOCK, STRIKE_TEMPORARY_BLOCK} from "../config/config";
import {GetUserStrikeHistoryParams, GetUserStrikeHistoryResponse, GetUserStrikeStatusParams, GetUserStrikeStatusResponse, UserStrikeHistory, UserStrikeStatus} from "../types/ai";

const getUserStrikeStatus = async ({email}: GetUserStrikeStatusParams): Promise<GetUserStrikeStatusResponse> => {
    try {
        const {user} = await getUserByEmail({email});
        if (!user) {
            return {error: 'USER_NOT_FOUND'};
        }

        const strikeData = await StrikeService.getUserStrikes(email);
        if (!strikeData) {
            return {error: 'STRIKE_DATA_UNAVAILABLE'};
        }

        const {isBlocked, blockType, blockedUntil, message} = await StrikeService.checkUserBlock(email);

        let timeUntilReset: string | undefined;
        if (strikeData.lastStrikeAt && strikeData.count > 0) {
            const resetTime = new Date(strikeData.lastStrikeAt.getTime() + (48 * 60 * 60 * 1000));
            const now = new Date();

            if (resetTime > now) {
                const hoursLeft = Math.ceil((resetTime.getTime() - now.getTime()) / (1000 * 60 * 60));
                if (hoursLeft > 24) {
                    const daysLeft = Math.floor(hoursLeft / 24);
                    const remainingHours = hoursLeft % 24;
                    timeUntilReset = `${daysLeft}d ${remainingHours}h`;
                } else {
                    timeUntilReset = `${hoursLeft}h`;
                }
            }
        }

        let blockTimeRemaining: string | undefined;
        if (isBlocked && blockedUntil) {
            const now = new Date();
            const remainingMs = blockedUntil.getTime() - now.getTime();
            const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));

            if (remainingMinutes > 60) {
                const hours = Math.floor(remainingMinutes / 60);
                const minutes = remainingMinutes % 60;
                blockTimeRemaining = `${hours}h ${minutes}m`;
            } else {
                blockTimeRemaining = `${remainingMinutes}m`;
            }
        }

        const nextStrikePenalty = getNextStrikePenalty(strikeData.count);

        const strikeStatus: UserStrikeStatus = {
            currentStrikes: strikeData.count,
            maxStrikes: 4,
            isBlocked,
            blockType,
            blockedUntil,
            lastStrikeAt: strikeData.lastStrikeAt,
            timeUntilReset,
            blockTimeRemaining,
            nextStrikePenalty,
        };

        return {strikeStatus};
    } catch (error: any) {
        console.error('ERROR: getUserStrikeStatus:'.red.bold, error);
        throw error;
    }
}

const getUserStrikeHistory = async ({email, limit = 10}: GetUserStrikeHistoryParams): Promise<GetUserStrikeHistoryResponse> => {
    try {
        const {user} = await getUserByEmail({email});
        if (!user) {
            return {error: 'USER_NOT_FOUND'};
        }

        const strikeData = await StrikeService.getUserStrikes(email);
        if (!strikeData) {
            return {error: 'STRIKE_DATA_UNAVAILABLE'};
        }

        const finalLimit = Math.min(Math.max(limit, 1), 50);

        const strikeHistory: UserStrikeHistory[] = [];

        if (strikeData.history && strikeData.history.length > 0) {
            const sortedHistory = strikeData.history
                .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()) // Most recent first
                .slice(0, finalLimit);

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

        return {strikeHistory, totalStrikes: strikeData.count};
    } catch (error: any) {
        console.error('ERROR: getUserStrikeHistory:'.red.bold, error);
        throw error;
    }
}

// Helper functions
const getNextStrikePenalty = (currentCount: number): string => {
    // TODO: Make it (2, 3) dynamic -- take from env variable
    if (currentCount === 0 || currentCount === 1) {
        return `Warning ${currentCount}/2`;
    } else if (currentCount === 2) {
        return `${STRIKE_TEMPORARY_BLOCK}-minute cooldown`;
    } else {
        return `${STRIKE_LONG_BLOCK}-day block`;
    }
}

export {getUserStrikeStatus, getUserStrikeHistory};
