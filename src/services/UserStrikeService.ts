import "colors";
import AuthService from "./AuthService";
import StrikeService from "./StrikeService";
import {STRIKE_TEMPORARY_BLOCK_COUNT} from "../config/config";
import {generateNotFoundCode} from "../utils/generateErrorCodes";
import {IGetUserStrikeHistoryParams, IGetUserStrikeHistoryResponse, IGetUserStrikeStatusParams, IGetUserStrikeStatusResponse, IUserStrikeStatus} from "../types/ai";
import {calculateBlockTimeRemaining, calculateNextStrikePenalty, calculateTimeUntilReset, processStrikeHistory, validateAndNormalizeLimit} from "../utils/serviceHelpers/strikeHelpers";

class UserStrikeService {
    /**
     * Get user strike status including blocks and time calculations
     */
    static async getUserStrikeStatus({email}: IGetUserStrikeStatusParams): Promise<IGetUserStrikeStatusResponse> {
        console.log('Service: UserStrikeService.getUserStrikeStatus called'.cyan.italic, {email});

        try {
            const {user} = await AuthService.getUserByEmail({email});
            if (!user) {
                console.warn('Client Error: User not found'.yellow, {email});
                return {error: generateNotFoundCode('user')};
            }

            const strikeData = await StrikeService.getUserStrikes(email);
            if (!strikeData) {
                return {error: 'STRIKE_DATA_UNAVAILABLE'};
            }

            const {isBlocked, blockType, blockedUntil, message} = await StrikeService.checkUserBlock(email);

            const timeUntilReset = strikeData.count > 0 ? calculateTimeUntilReset(strikeData.lastStrikeAt) : undefined;
            const blockTimeRemaining = isBlocked ? calculateBlockTimeRemaining(blockedUntil) : undefined;
            const nextStrikePenalty = calculateNextStrikePenalty(strikeData.count);

            const tempBlockCount = Number.parseInt(STRIKE_TEMPORARY_BLOCK_COUNT!) || 3;

            const strikeStatus: IUserStrikeStatus = {
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

            console.log('User strike status retrieval completed successfully'.green.bold, {strikeStatus});
            return {strikeStatus};
        } catch (error: any) {
            console.error('Service Error: UserStrikeService.getUserStrikeStatus failed:'.red.bold, error);
            throw error;
        }
    }

    /**
     * Get paginated user strike history sorted by most recent first
     */
    static async getUserStrikeHistory({email, limit = 10}: IGetUserStrikeHistoryParams): Promise<IGetUserStrikeHistoryResponse> {
        console.log('Service: UserStrikeService.getUserStrikeHistory called'.cyan.italic, {email, limit});

        try {
            const {user} = await AuthService.getUserByEmail({email});
            if (!user) {
                console.warn('Client Error: User not found'.yellow, {email});
                return {error: generateNotFoundCode('user')};
            }

            const strikeData = await StrikeService.getUserStrikes(email);
            if (!strikeData) {
                return {error: 'STRIKE_DATA_UNAVAILABLE'};
            }

            const finalLimit = validateAndNormalizeLimit(limit, 1, 50);
            const strikeHistory = processStrikeHistory(strikeData.history, finalLimit);

            const result = {strikeHistory, totalStrikes: strikeData.count};
            console.log('User strike history retrieval completed successfully'.green.bold, result);
            return result;
        } catch (error: any) {
            console.error('Service Error: UserStrikeService.getUserStrikeHistory failed:'.red.bold, error);
            throw error;
        }
    }

}

export default UserStrikeService;
