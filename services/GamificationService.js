import User from "../models/User.model.js";

class GamificationService {
  /**
   * Updates the user's daily login streak.
   * If the last check-in was yesterday, increments current streak.
   * If it was earlier than yesterday, resets streak to 1.
   * If it was today, does nothing.
   * Updates longest streak if current > longest.
   */
  static async updateStreak(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const now = new Date();
      const lastCheckIn = user.gamification?.streak?.lastCheckIn;
      
      let newCurrent = user.gamification?.streak?.current || 0;
      let newLongest = user.gamification?.streak?.longest || 0;

      if (!lastCheckIn) {
        // First time checking in
        newCurrent = 1;
        newLongest = 1;
      } else {
        const lastDate = new Date(lastCheckIn);
        // Normalize to midnight to avoid time-of-day issues
        const lastMidnight = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const diffTime = Math.abs(todayMidnight - lastMidnight);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays === 1) {
          // Logged in yesterday, increment streak
          newCurrent += 1;
        } else if (diffDays > 1) {
          // Missed a day, reset streak
          newCurrent = 1;
        }
        // If diffDays === 0, they already logged in today, do nothing to current streak
      }

      if (newCurrent > newLongest) {
        newLongest = newCurrent;
      }

      await User.updateOne(
        { _id: userId },
        { 
          $set: { 
            "gamification.streak.current": newCurrent,
            "gamification.streak.longest": newLongest,
            "gamification.streak.lastCheckIn": now
          }
        }
      );
    } catch (error) {
      console.error("[GamificationService] Failed to update streak:", error);
    }
  }
}

export default GamificationService;
