import User from "../models/User.model.js";
import TokenTransaction from "../models/TokenTransaction.model.js";
import logger from "../utils/logger.js";

class GamificationService {
  constructor() {
    // XP Values for actions
    this.XP_TABLE = {
      DAILY_LOGIN: 50,
      CREATE_POST: 100,
      CREATE_DEVLOG: 300,
      CREATE_CODEX: 200,
      GET_LIKE: 10,
      GET_COMMENT: 20,
      COMPLETE_PROFILE: 500,
      VERIFY_IDENTITY: 1000
    };

    // Token Values for certain actions
    this.TOKEN_REWARDS = {
      DAILY_LOGIN: 0.5,
      DEVLOG_LAUNCH: 1,
      VERIFY_IDENTITY: 5,
      CODEX_100_READS: 1
    };
  }

  /**
   * Calculate Level based on XP
   * Formula: Level = Math.floor(0.1 * sqrt(XP)) + 1
   */
  calculateLevel(xp) {
    if (!xp || xp < 0) return 1;
    return Math.floor(0.1 * Math.sqrt(xp)) + 1;
  }

  /**
   * Award XP and optionally Tokens to a user atomically
   * This is designed for high-concurrency (millions of users)
   */
  async awardRewards(userId, action, metadata = {}) {
    try {
      const xpAmount = this.XP_TABLE[action] || 0;
      const tokenAmount = this.TOKEN_REWARDS[action] || 0;

      if (xpAmount === 0 && tokenAmount === 0) return null;

      // 1. Prepare Update Object
      const update = {
        $inc: {}
      };

      if (xpAmount > 0) update.$inc["gamification.xp"] = xpAmount;
      if (tokenAmount > 0) {
        update.$inc["walletBalance"] = tokenAmount;
        update.$inc["totalEarnings"] = tokenAmount;
      }

      // 2. Perform Atomic Update
      const updatedUser = await User.findOneAndUpdate(
        { _id: userId },
        update,
        { new: true, runValidators: false }
      );

      if (!updatedUser) {
        logger.error(`User ${userId} not found during reward distribution`);
        return null;
      }

      // 3. Handle Level Ups
      const newLevel = this.calculateLevel(updatedUser.gamification.xp);
      let leveledUp = false;

      if (newLevel > (updatedUser.gamification.level || 1)) {
        await User.updateOne(
          { _id: userId },
          { $set: { "gamification.level": newLevel } }
        );
        leveledUp = true;
        logger.info(`🎊 User ${userId} leveled up to ${newLevel}`);
      }

      // 4. Create Token Transaction Log (Audit Trail)
      if (tokenAmount > 0 || xpAmount > 0) {
        await TokenTransaction.create({
          user: userId,
          amount: tokenAmount,
          xpAmount: xpAmount,
          type: "reward",
          source: action.toLowerCase(),
          description: `Reward for ${action.replace(/_/g, ' ').toLowerCase()}`,
          metadata: {
            ...metadata,
            newBalance: updatedUser.walletBalance,
            xpEarned: xpAmount
          }
        });
      }

      return {
        xpEarned: xpAmount,
        tokensEarned: tokenAmount,
        newXP: updatedUser.gamification.xp,
        newLevel: leveledUp ? newLevel : updatedUser.gamification.level,
        leveledUp
      };

    } catch (error) {
      logger.error("Error in reward distribution:", error);
      throw error;
    }
  }

  /**
   * Award XP (Backward compatibility alias)
   */
  async awardXP(userId, action) {
    return this.awardRewards(userId, action);
  }

  /**
   * Update Daily Streak & Award Login Rewards
   * Scalable implementation using atomic date checks
   */
  async updateStreak(userId) {
    try {
      const user = await User.findById(userId).select("gamification.streak");
      if (!user) return null;

      const now = new Date();
      const lastCheckIn = user.gamification?.streak?.lastCheckIn;

      // Check if already checked in today (Server-side date check)
      if (lastCheckIn && 
          new Date(lastCheckIn).toDateString() === now.toDateString()) {
        return { checkedIn: false, streak: user.gamification?.streak?.current || 0 };
      }

      let newStreakCount = 1;
      if (lastCheckIn) {
        const diffHours = (now - new Date(lastCheckIn)) / (1000 * 60 * 60);
        if (diffHours < 48) {
          newStreakCount = (user.gamification?.streak?.current || 0) + 1;
        }
      }

      // Atomic Streak Update
      await User.updateOne(
        { _id: userId },
        { 
          $set: { 
            "gamification.streak.current": newStreakCount,
            "gamification.streak.lastCheckIn": now
          },
          $max: { "gamification.streak.longest": newStreakCount }
        }
      );

      // Award Rewards (Atomic)
      const rewards = await this.awardRewards(userId, 'DAILY_LOGIN', { 
        streak: newStreakCount 
      });

      return { 
        checkedIn: true, 
        streak: newStreakCount, 
        ...rewards 
      };

    } catch (error) {
      logger.error("Streak Update Error:", error);
      throw error;
    }
  }
}

export default new GamificationService();

