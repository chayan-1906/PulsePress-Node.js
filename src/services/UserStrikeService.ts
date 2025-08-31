import "colors";
import AuthService from "./AuthService";
import StrikeService from "./StrikeService";
import {STRIKE_COOLDOWN_COUNT, STRIKE_LONG_BLOCK_DURATION, STRIKE_TEMPORARY_BLOCK_COUNT, STRIKE_TEMPORARY_BLOCK_DURATION} from "../config/config";
import {GetUserStrikeHistoryParams, GetUserStrikeHistoryResponse, GetUserStrikeStatusParams, GetUserStrikeStatusResponse, UserStrikeHistory, UserStrikeStatus} from "../types/ai";
import {generateNotFoundCode} from "../utils/generateErrorCodes";

class UserStrikeService {
    static async getUserStrikeStatus({email}: GetUserStrikeStatusParams): Promise<GetUserStrikeStatusResponse> {
        try {
            const {user} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
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

            const nextStrikePenalty = await this.getNextStrikePenalty(strikeData.count);

            const tempBlockCount = Number.parseInt(STRIKE_TEMPORARY_BLOCK_COUNT!) || 3;

            const strikeStatus: UserStrikeStatus = {
                currentStrikes: strikeData.count,
                maxStrikes: tempBlockCount + 1,
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

    static async getUserStrikeHistory({email, limit = 10}: GetUserStrikeHistoryParams): Promise<GetUserStrikeHistoryResponse> {
        try {
            const {user} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
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
    private static async getNextStrikePenalty(currentCount: number) {
        const cooldownCount = Number.parseInt(STRIKE_COOLDOWN_COUNT!) || 2;
        const tempBlockCount = Number.parseInt(STRIKE_TEMPORARY_BLOCK_COUNT!) || 3;

        if (currentCount < cooldownCount) {
            return `Warning ${currentCount + 1}/${cooldownCount}`;
        } else if (currentCount === cooldownCount) {
            return `${STRIKE_TEMPORARY_BLOCK_DURATION}-minute cooldown`;
        } else {
            return `${STRIKE_LONG_BLOCK_DURATION}-day block`;
        }
    }
}

export default UserStrikeService;
