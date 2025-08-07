import "colors";
import UserModel from "../models/UserSchema";
import {StrikeCheckResult, StrikeResult, UserStrikeBlock} from "../types/ai";
import {STRIKE_LONG_BLOCK, STRIKE_TEMPORARY_BLOCK} from "../config/config";

class StrikeService {

    /**
     * Check if user is currently blocked and handle 48-hour reset
     */
    async checkUserBlock(email: string): Promise<StrikeCheckResult> {
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

                if (hoursSinceLastStrike >= Number.parseInt(STRIKE_LONG_BLOCK!) * 24) {
                    console.log(`48-hour reset triggered for ${email}, clearing strikes from ${strikes.count} to 0`.green.italic);

                    // Reset strikes to 0
                    await UserModel.updateOne(
                        {email},
                        {
                            $set: {
                                'newsClassificationStrikes.count': 0,
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
                return {
                    isBlocked: true,
                    blockType: strikes.blockType,
                    blockedUntil: strikes.blockedUntil,
                    message: `You are temporarily blocked for making non-news queries. Block expires in ${remainingTime}.`,
                };
            } else {
                // Block has expired, clear it (but keep strike count)
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
            console.error('Error checking user block:'.red.bold, error);
            return {isBlocked: false};
        }
    }

    /**
     * Apply a strike to user for non-news query
     */
    async applyStrike(email: string): Promise<StrikeResult> {
        try {
            const blockCheck = await this.checkUserBlock(email);
            const wasReset = blockCheck.wasReset || false;

            const user = await UserModel.findOne({email});
            if (!user) {
                return {
                    success: false,
                    newStrikeCount: 0,
                    isBlocked: false,
                    message: 'User not found',
                };
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
            let blockType: UserStrikeBlock | undefined;
            let blockedUntil: Date | undefined;

            if (newStrikeCount === 1 || newStrikeCount === 2) {
                // Strike 1-2: Warning only
                message = `⚠️ Warning ${newStrikeCount}/2: Your query appears to be non-news related. PulsePress is designed for news queries only. Please ask about current events, news, or recent developments`;
            } else if (newStrikeCount === 3) {
                // Strike 3: 15-30 min cooldown
                const cooldownMinutes = Number.parseInt(STRIKE_TEMPORARY_BLOCK!);
                blockedUntil = new Date(now.getTime() + cooldownMinutes * 60 * 1000);
                blockType = 'cooldown';
                isBlocked = true;

                updateData['newsClassificationStrikes.blockedUntil'] = blockedUntil;
                updateData['newsClassificationStrikes.blockType'] = blockType;

                message = `🚫 Strike 3: You are temporarily blocked for ${cooldownMinutes} minutes due to repeated non-news queries. Please return later with news-related questions.`;
            } else if (newStrikeCount >= 4) {
                // Strike 4+: 2-day block
                const blockDays = Number.parseInt(STRIKE_LONG_BLOCK!); // 2 days
                blockedUntil = new Date(now.getTime() + blockDays * 24 * 60 * 60 * 1000);
                blockType = 'long_block';
                isBlocked = true;

                updateData['newsClassificationStrikes.blockedUntil'] = blockedUntil;
                updateData['newsClassificationStrikes.blockType'] = blockType;

                message = `🔒 Strike ${newStrikeCount}: You are blocked for ${STRIKE_LONG_BLOCK} days due to continued misuse. PulsePress is exclusively for news-related queries. Please respect our terms of use.`;
            } else {
                message = `Strike ${newStrikeCount} applied.`;
            }

            await UserModel.updateOne({email}, {$set: updateData});

            console.log(`Strike applied to ${email}:`.yellow.italic, {
                previousCount: currentStrikes,
                newStrikeCount,
                isBlocked,
                blockType,
                blockedUntil,
                wasReset,
            });

            return {
                success: true,
                newStrikeCount,
                isBlocked,
                blockType,
                blockedUntil,
                message,
                wasReset,
            }
        } catch (error: any) {
            console.error('Error applying strike:'.red.bold, error);
            return {
                success: false,
                newStrikeCount: 0,
                isBlocked: false,
                message: 'Failed to apply strike',
            };
        }
    }

    /**
     * Manually reset strikes for user (admin function)
     */
    async resetStrikes(email: string): Promise<boolean> {
        try {
            await UserModel.updateOne(
                {email},
                {
                    $set: {
                        'newsClassificationStrikes.count': 0
                    },
                    $unset: {
                        'newsClassificationStrikes.lastStrikeAt': 1,
                        'newsClassificationStrikes.blockedUntil': 1,
                        'newsClassificationStrikes.blockType': 1,
                    },
                },
            );
            console.log(`Strikes manually reset for ${email}`.green.italic);
            return true;
        } catch (error: any) {
            console.error('Error resetting strikes:'.red.bold, error);
            return false;
        }
    }

    /**
     * Get user's current strike information
     */
    async getUserStrikes(email: string): Promise<{ count: number; lastStrikeAt?: Date; blockedUntil?: Date } | null> {
        try {
            // Check for reset first
            await this.checkUserBlock(email);

            // Get fresh data after potential reset
            const user = await UserModel.findOne({email}, 'newsClassificationStrikes');
            return user?.newsClassificationStrikes || {count: 0};
        } catch (error: any) {
            console.error('Error getting user strikes:'.red.bold, error);
            return null;
        }
    }

    /**
     * Check if user strikes should be reset (48 hours since last strike)
     */
    async checkForAutoReset(email: string): Promise<boolean> {
        try {
            const user = await UserModel.findOne({email});
            if (!user || !user.newsClassificationStrikes?.lastStrikeAt || user.newsClassificationStrikes.count === 0) {
                return false;
            }

            const hoursSinceLastStrike = (Date.now() - user.newsClassificationStrikes.lastStrikeAt.getTime()) / (1000 * 60 * 60);

            if (hoursSinceLastStrike >= Number.parseInt(STRIKE_LONG_BLOCK!) * 24) {
                console.log(`Auto-reset conditions met for ${email} (${hoursSinceLastStrike.toFixed(1)} hours since last strike)`.cyan.italic);
                return true;
            }

            return false;
        } catch (error: any) {
            console.error('Error checking auto-reset conditions:'.red.bold, error);
            return false;
        }
    }

    /**
     * Format remaining block time in human-readable format
     */
    private formatRemainingTime(blockedUntil: Date, now: Date): string {
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

export default new StrikeService();
