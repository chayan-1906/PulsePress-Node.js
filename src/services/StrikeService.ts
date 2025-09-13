import "colors";
import UserModel, {IUser} from "../models/UserSchema";
import NonNewsViolationLogModel from "../models/NonNewsViolationLogSchema";
import {IStrikeCheckResult, IStrikeHistoryEvent, IStrikeResult, TUserStrikeBlock} from "../types/ai";
import {STRIKE_COOLDOWN_COUNT, STRIKE_LONG_BLOCK_DURATION, STRIKE_TEMPORARY_BLOCK_COUNT, STRIKE_TEMPORARY_BLOCK_DURATION} from "../config/config";

class StrikeService {
    /**
     * Check if user is currently blocked and handle 48-hour reset
     */
    static async checkUserBlock(email: string): Promise<IStrikeCheckResult> {
        console.log('Service: StrikeService.checkUserBlock called'.cyan.italic, {email});

        try {
            const user = await UserModel.findOne({email});
            if (!user) {
                return {isBlocked: false};
            }

            const strikes = user.newsClassificationStrikes;
            if (!strikes || strikes.count === 0) {
                return {isBlocked: false};
            }

            const now = new Date();

            // 48-HOUR RESET LOGIC
            if (strikes.lastStrikeAt) {
                const hoursSinceLastStrike = (now.getTime() - strikes.lastStrikeAt.getTime()) / (1000 * 60 * 60);

                if (hoursSinceLastStrike >= Number.parseInt(STRIKE_LONG_BLOCK_DURATION!) * 24) {
                    console.log(`48-hour reset triggered for ${email}, clearing strikes from ${strikes.count} to 0`.cyan);

                    // Reset strikes to 0 and clear history
                    await UserModel.updateOne(
                        {email},
                        {
                            $set: {
                                'newsClassificationStrikes.count': 0,
                                'newsClassificationStrikes.history': [],
                            },
                            $unset: {
                                'newsClassificationStrikes.lastStrikeAt': 1,
                                'newsClassificationStrikes.blockedUntil': 1,
                                'newsClassificationStrikes.blockType': 1,
                            },
                        },
                    );

                    return {isBlocked: false, wasReset: true};
                }
            }

            // Check if user is currently blocked (not expired)
            if (!strikes.blockedUntil) {
                return {isBlocked: false};
            }

            if (strikes.blockedUntil > now) {
                // User is still blocked
                const remainingTime = this.formatRemainingTime(strikes.blockedUntil, now);
                const result = {
                    isBlocked: true,
                    blockType: strikes.blockType,
                    blockedUntil: strikes.blockedUntil,
                    message: `You are temporarily blocked for making non-news queries. Block expires in ${remainingTime}.`,
                };
                console.log('User block check completed successfully'.green.bold, result);
                return result;
            } else {
                // Block has expired, clear it (but keep strike count and history)
                await UserModel.updateOne(
                    {email},
                    {
                        $unset: {
                            'newsClassificationStrikes.blockedUntil': 1,
                            'newsClassificationStrikes.blockType': 1,
                        },
                    },
                );
                return {isBlocked: false};
            }
        } catch (error: any) {
            console.error('Service Error: StrikeService.checkUserBlock failed:'.red.bold, error);
            return {isBlocked: false};
        }
    }

    /**
     * Log non-news violation for admin tracking
     */
    static async logNonNewsViolation(email: string, violationType: string, content: string): Promise<void> {
        console.log('Service: StrikeService.logNonNewsViolation called'.cyan.italic, {email, violationType});

        try {
            const user = await UserModel.findOne({email});
            if (!user) {
                console.warn('Client Error: User not found for violation logging'.yellow, {email});
                return;
            }

            await NonNewsViolationLogModel.create({
                userExternalId: user.userExternalId,
                email: user.email,
                violationType,
                content: content.substring(0, 2000),
                violatedAt: new Date(),
            });

            console.log('Non-news violation logged successfully'.cyan, {email, violationType});
        } catch (error: any) {
            console.error('Service Error: StrikeService.logNonNewsViolation failed:'.red.bold, error);
        }
    }

    /**
     * Apply a strike to user for non-news query
     */
    static async applyStrike(email: string, violationType: string = 'search_query', content: string = ''): Promise<IStrikeResult> {
        console.log('Service: StrikeService.applyStrike called'.cyan.italic, {email});

        try {
            await this.logNonNewsViolation(email, violationType, content);

            const blockCheck = await this.checkUserBlock(email);
            const wasReset = blockCheck.wasReset || false;

            const user = await UserModel.findOne({email});
            if (!user) {
                return {newStrikeCount: 0, isBlocked: false, message: 'User not found'};
            }

            const currentStrikes = user.newsClassificationStrikes?.count || 0;
            const newStrikeCount = currentStrikes + 1;
            const now = new Date();

            let updateData: any = {
                'newsClassificationStrikes.count': newStrikeCount,
                'newsClassificationStrikes.lastStrikeAt': now,
            };

            let message: string;
            let isBlocked = false;
            let blockType: TUserStrikeBlock | undefined;
            let blockedUntil: Date | undefined;
            let reason: string;
            let blockDuration: string | undefined;

            const cooldownCount = Number.parseInt(STRIKE_COOLDOWN_COUNT!) || 2;
            const tempBlockCount = Number.parseInt(STRIKE_TEMPORARY_BLOCK_COUNT!) || 3;

            if (newStrikeCount <= cooldownCount) {
                // Strike 1-2: Warning only
                reason = `Warning ${newStrikeCount}/${cooldownCount} for non-news query`;
                message = `⚠️ Warning ${newStrikeCount}/${cooldownCount}: Your query appears to be non-news related. PulsePress is designed for news queries only. Please ask about current events, news, or recent developments`;
            } else if (newStrikeCount === tempBlockCount) {
                // Strike 3: 15-30 min cooldown
                const cooldownMinutes = Number.parseInt(STRIKE_TEMPORARY_BLOCK_DURATION!);
                blockedUntil = new Date(now.getTime() + cooldownMinutes * 60 * 1000);
                blockType = 'cooldown';
                isBlocked = true;
                reason = 'Non-news query - Cooldown applied';
                blockDuration = `${cooldownMinutes} minutes`;

                updateData['newsClassificationStrikes.blockedUntil'] = blockedUntil;
                updateData['newsClassificationStrikes.blockType'] = blockType;

                message = `🚫 Strike ${tempBlockCount}: You are temporarily blocked for ${cooldownMinutes} minutes due to repeated non-news queries. Please return later with news-related questions.`;
            } else if (newStrikeCount > tempBlockCount) {
                // Strike 4+: 2-day block
                const blockDays = Number.parseInt(STRIKE_LONG_BLOCK_DURATION!); // 2 days
                blockedUntil = new Date(now.getTime() + blockDays * 24 * 60 * 60 * 1000);
                blockType = 'long_block';
                isBlocked = true;
                reason = 'Non-news query - Long block applied';
                blockDuration = `${blockDays} days`;

                updateData['newsClassificationStrikes.blockedUntil'] = blockedUntil;
                updateData['newsClassificationStrikes.blockType'] = blockType;

                message = `🔒 Strike ${newStrikeCount}: You are blocked for ${STRIKE_LONG_BLOCK_DURATION} days due to continued misuse. PulsePress is exclusively for news-related queries. Please respect our terms of use.`;
            } else {
                reason = `Strike ${newStrikeCount} applied`;
                message = `Strike ${newStrikeCount} applied.`;
            }

            const historyEvent: IStrikeHistoryEvent = {
                strikeNumber: newStrikeCount,
                appliedAt: now,
                reason,
                blockType,
                blockDuration,
            };

            updateData['$push'] = {
                'newsClassificationStrikes.history': historyEvent,
            };

            await UserModel.updateOne({email}, {$set: updateData, $push: updateData['$push']});

            console.log(`Strike applied to ${email}:`.cyan, {previousCount: currentStrikes, newStrikeCount, isBlocked, blockType, blockedUntil, wasReset, historyEvent});

            const result = {newStrikeCount, isBlocked, blockType, blockedUntil, message, wasReset};
            console.log('Strike application completed successfully'.green.bold, result);
            return result;
        } catch (error: any) {
            console.error('Service Error: StrikeService.applyStrike failed:'.red.bold, error);
            return {newStrikeCount: 0, isBlocked: false, message: 'Failed to apply strike'};
        }
    }

    /**
     * Manually reset strikes for user (admin function)
     */
    private static async resetStrikes(email: string): Promise<boolean> {
        console.log('Service: StrikeService.resetStrikes called'.cyan.italic, {email});

        try {
            await UserModel.updateOne(
                {email},
                {
                    $set: {
                        'newsClassificationStrikes.count': 0,
                        'newsClassificationStrikes.history': [],
                    },
                    $unset: {
                        'newsClassificationStrikes.lastStrikeAt': 1,
                        'newsClassificationStrikes.blockedUntil': 1,
                        'newsClassificationStrikes.blockType': 1,
                    },
                },
            );
            console.log(`Strikes manually reset for ${email}`.cyan);
            return true;
        } catch (error: any) {
            console.error('Service Error: StrikeService.resetStrikes failed:'.red.bold, error);
            return false;
        }
    }

    /**
     * Get user's current strike information
     */
    static async getUserStrikes(email: string): Promise<{ count: number; lastStrikeAt?: Date; blockedUntil?: Date; history?: IStrikeHistoryEvent[] } | null> {
        console.log('Service: StrikeService.getUserStrikes called'.cyan.italic, {email});

        try {
            // Check for reset first
            await this.checkUserBlock(email);

            // Get fresh data after potential reset
            const user = await UserModel.findOne({email}, 'newsClassificationStrikes');
            const result = user?.newsClassificationStrikes || {count: 0, history: []};
            console.log('User strikes retrieval completed successfully'.green.bold, result);
            return result;
        } catch (error: any) {
            console.error('Service Error: StrikeService.getUserStrikes failed:'.red.bold, error);
            return null;
        }
    }

    /**
     * Check if user strikes should be reset (48 hours since last strike)
     */
    private static async checkForAutoReset(email: string): Promise<boolean> {
        console.log('Service: StrikeService.checkForAutoReset called'.cyan.italic, {email});

        try {
            const user = await UserModel.findOne({email});
            if (!user || !user.newsClassificationStrikes?.lastStrikeAt || user.newsClassificationStrikes.count === 0) {
                return false;
            }

            const hoursSinceLastStrike = (Date.now() - user.newsClassificationStrikes.lastStrikeAt.getTime()) / (1000 * 60 * 60);

            if (hoursSinceLastStrike >= Number.parseInt(STRIKE_LONG_BLOCK_DURATION!) * 24) {
                console.log(`Auto-reset conditions met for ${email} (${hoursSinceLastStrike.toFixed(1)} hours since last strike)`.cyan);
                return true;
            }

            return false;
        } catch (error: any) {
            console.error('Service Error: StrikeService.checkForAutoReset failed:'.red.bold, error);
            return false;
        }
    }

    /**
     * Reset strikes for users who haven't violated in the last hour (cooling off period)
     * This runs every 15 minutes via cron job
     */
    static async resetExpiredStrikes(): Promise<void> {
        console.log('Service: StrikeService.resetExpiredStrikes called'.cyan.italic);

        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

            const usersToReset: IUser[] = await UserModel.find({
                'newsClassificationStrikes.count': {$gt: 0},
                'newsClassificationStrikes.lastStrikeAt': {$lt: oneHourAgo},
            });

            let resetCount = 0;
            for (const user of usersToReset) {
                const lastStrikeAt = user.newsClassificationStrikes?.lastStrikeAt;
                const currentStrikes = user.newsClassificationStrikes?.count || 0;

                if (lastStrikeAt && currentStrikes > 0) {
                    console.log(`Auto-resetting strikes for user ${user.email}: ${currentStrikes} strikes → 0 (last strike: ${lastStrikeAt.toISOString()})`.cyan);

                    await UserModel.updateOne(
                        {email: user.email},
                        {
                            $set: {
                                'newsClassificationStrikes.count': 0,
                                'newsClassificationStrikes.history': [],
                            },
                            $unset: {
                                'newsClassificationStrikes.lastStrikeAt': 1,
                                'newsClassificationStrikes.blockedUntil': 1,
                                'newsClassificationStrikes.blockType': 1,
                            },
                        },
                    );
                    resetCount++;
                }
            }

            if (resetCount > 0) {
                console.log(`Auto-reset completed: Reset strikes for ${resetCount} users`.green.bold);
            } else {
                console.log('Auto-reset check completed: No users eligible for reset'.cyan);
            }
        } catch (error: any) {
            console.error('Service Error: StrikeService.resetExpiredStrikes failed:'.red.bold, error);
        }
    }

    /**
     * Format remaining block time in human-readable format
     */
    private static formatRemainingTime(blockedUntil: Date, now: Date): string {
        console.log('Service: StrikeService.formatRemainingTime called'.cyan.italic, {blockedUntil, now});

        const remainingMs = blockedUntil.getTime() - now.getTime();
        const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));

        if (remainingMinutes > 60) {
            const hours = Math.floor(remainingMinutes / 60);
            const minutes = remainingMinutes % 60;
            return `${hours}h ${minutes}m`;
        } else {
            return `${remainingMinutes}m`;
        }
    }
}

export default StrikeService;
