import User from "../models/User.model.js";
import logger from "../utils/logger.js";

class GamificationService {
  constructor() {
    // XP Values for actions
    this.XP_TABLE = {
      DAILY_LOGIN: 50,
      CREATE_POST: 100,
      CREATE_PROJECT: 300,
      CREATE_BLOG: 200,
      GET_LIKE: 10,
      GET_COMMENT: 20,
      COMPLETE_PROFILE: 500
    };

    // Badge Definitions
    this.BADGES = {
      EARLY_ADOPTER: {
        id: 'early_adopter',
        name: 'Early Adopter',
        icon: '🚀',
        description: 'Joined the platform in its early days.'
      },
      RISING_STAR: {
        id: 'rising_star',
        name: 'Rising Star',
        icon: '🌟',
        description: 'Reached 1000 XP.'
      },
      CONTENT_CREATOR: {
        id: 'content_creator',
        name: 'Creator',
        icon: '🎨',
        description: 'Published 5+ posts.'
      },
      EXPERT_AUTHOR: {
        id: 'expert_author',
        name: 'Expert Author',
        icon: '✍️',
        description: 'Published 10+ blogs.'
      },
      STREAK_MASTER: {
        id: 'streak_master',
        name: 'Streak Master',
        icon: '🔥',
        description: 'Maintained a 7-day streak.'
      }
    };
  }

  /**
   * Calculate Level based on XP
   * Formula: Level = Math.floor(0.1 * sqrt(XP)) + 1
   * Level 1: 0 XP
   * Level 2: 100 XP
   * Level 5: 1600 XP etc.
   */
  calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp)) + 1;
  }

  /**
   * Award XP to a user
   * @param {string} userId 
   * @param {string} action - Key from XP_TABLE
   */
  async awardXP(userId, action) {
    try {
      const amount = this.XP_TABLE[action] || 0;
      if (amount === 0) return;

      const user = await User.findById(userId);
      if (!user) return;

      // Initialize if missing
      if (!user.gamification) user.gamification = { xp: 0, level: 1, points: 0, badges: [] };

      const oldLevel = user.gamification.level;
      user.gamification.xp += amount;
      
      // Check Level Up
      const newLevel = this.calculateLevel(user.gamification.xp);
      let leveledUp = false;
      
      if (newLevel > oldLevel) {
        user.gamification.level = newLevel;
        leveledUp = true;
        // user.gamification.points += newLevel * 10; // Reward points on level up
      }

      await user.save();
      
      // Check for badges asynchronously
      this.checkBadges(user);

      return {
        newXP: user.gamification.xp,
        newLevel,
        leveledUp,
        xpEarned: amount
      };

    } catch (error) {
      logger.error("Error awarding XP:", error);
    }
  }

  /**
   * Check and award badges based on user stats
   */
  async checkBadges(user) {
    try {
        let newBadges = [];
        const currentBadges = new Set(user.gamification.badges.map(b => b.id));

        // 1. Rising Star (XP Check)
        if (!currentBadges.has(this.BADGES.RISING_STAR.id) && user.gamification.xp >= 1000) {
            user.gamification.badges.push(this.BADGES.RISING_STAR);
            newBadges.push(this.BADGES.RISING_STAR);
        }

        // 2. Streak Master
        if (!currentBadges.has(this.BADGES.STREAK_MASTER.id) && user.gamification.streak?.current >= 7) {
            user.gamification.badges.push(this.BADGES.STREAK_MASTER);
            newBadges.push(this.BADGES.STREAK_MASTER);
        }

        // Save if changes
        if (newBadges.length > 0) {
            await user.save();
            logger.info(`🏆 User ${user._id} earned badges: ${newBadges.map(b => b.name).join(', ')}`);
        }
    } catch (error) {
        logger.error("Badge Check Error:", error);
    }
  }

  /**
   * Update Daily Streak
   * Should be called on Login or First App Open
   */
  async updateStreak(userId) {
      try {
          const user = await User.findById(userId);
          if (!user) return;

          if (!user.gamification) user.gamification = { streak: { current: 0, longest: 0 } };
          const streak = user.gamification.streak;

          const now = new Date();
          const lastCheckIn = streak.lastCheckIn ? new Date(streak.lastCheckIn) : null;

          if (lastCheckIn) {
              const diffHours = (now - lastCheckIn) / (1000 * 60 * 60);
              
              if (diffHours < 24 && now.getDate() === lastCheckIn.getDate()) {
                  // Already checked in today
                  return { checkedIn: false, streak: streak.current };
              } else if (diffHours < 48) {
                  // Consecutive day
                  streak.current += 1;
              } else {
                  // Missed a day
                  streak.current = 1; 
              }
          } else {
              // First time
              streak.current = 1;
          }

          // Update Max
          if (streak.current > streak.longest) streak.longest = streak.current;
          streak.lastCheckIn = now;

          await user.save();
          
          // Award Daily XP
          await this.awardXP(userId, 'DAILY_LOGIN');

          return { checkedIn: true, streak: streak.current, xpAdded: this.XP_TABLE.DAILY_LOGIN };

      } catch (error) {
          logger.error("Streak Update Error:", error);
      }
  }
}

export default new GamificationService();
