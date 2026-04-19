import ButtonTemplate from "../models/Template.model.js";
import asyncHandler from "express-async-handler";

export const getTemplateAnalytics = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { range = '7d' } = req.query;
    const userId = req.user._id || req.user.id;

    const template = await ButtonTemplate.findById(id);
    if (!template) return res.status(404).json({ message: "Template not found" });

    // Authorization
    if (template.user?.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Determine Time Range
    const now = new Date();
    let startTime = new Date();
    let interval = 'day';

    switch(range) {
        case '1h':
            startTime.setHours(startTime.getHours() - 1);
            interval = 'minute';
            break;
        case '24h':
            startTime.setHours(startTime.getHours() - 24);
            interval = 'hour';
            break;
        case '7d':
            startTime.setDate(startTime.getDate() - 7);
            interval = 'day';
            break;
        case '30d':
            startTime.setDate(startTime.getDate() - 30);
            interval = 'day';
            break;
        default: 
            startTime.setDate(startTime.getDate() - 7);
            interval = 'day';
    }

    // Process view history - extract individual viewer timestamps
    const viewTimestamps = [];
    template.viewHistory?.forEach(history => {
        history.viewers?.forEach(viewer => {
            if (new Date(viewer.timestamp) >= startTime) {
                viewTimestamps.push(new Date(viewer.timestamp));
            }
        });
    });
    
    const sharesInPeriod = template.shareHistory?.filter(s => new Date(s.timestamp) >= startTime) || [];
    const impressionsInPeriod = template.impressionHistory?.filter(i => new Date(i.date) >= startTime) || [];
    
    // Create trend data with proper interval alignment
    const trendMap = new Map();
    let current = new Date(startTime);
    
    // Align current to start of interval
    if (interval === 'day') current.setHours(0,0,0,0);
    if (interval === 'hour') current.setMinutes(0,0,0);
    if (interval === 'minute') current.setSeconds(0,0);

    while (current <= now) {
        trendMap.set(current.toISOString(), { views: 0, likes: 0, downloads: 0, shares: 0, impressions: 0 });
        
        if (interval === 'minute') current.setMinutes(current.getMinutes() + 1);
        else if (interval === 'hour') current.setHours(current.getHours() + 1);
        else current.setDate(current.getDate() + 1);
    }

    // Fill views from timestamps
    viewTimestamps.forEach(timestamp => {
        const key = new Date(timestamp);
        if (interval === 'day') key.setHours(0,0,0,0);
        else if (interval === 'hour') key.setMinutes(0,0,0);
        else if (interval === 'minute') key.setSeconds(0,0);
        
        const keyStr = key.toISOString();
        if (trendMap.has(keyStr)) {
            trendMap.get(keyStr).views++;
        }
    });

    // Fill likes
    likesInPeriod.forEach(l => {
        const key = new Date(l.timestamp);
        if (interval === 'day') key.setHours(0,0,0,0);
        else if (interval === 'hour') key.setMinutes(0,0,0);
        else if (interval === 'minute') key.setSeconds(0,0);
        
        const keyStr = key.toISOString();
        if (trendMap.has(keyStr)) {
            trendMap.get(keyStr).likes++;
        }
    });

    // Fill downloads
    downloadsInPeriod.forEach(d => {
        const key = new Date(d.timestamp);
        if (interval === 'day') key.setHours(0,0,0,0);
        else if (interval === 'hour') key.setMinutes(0,0,0);
        else if (interval === 'minute') key.setSeconds(0,0);
        
        const keyStr = key.toISOString();
        if (trendMap.has(keyStr)) {
            trendMap.get(keyStr).downloads++;
        }
    });

    // Fill shares
    sharesInPeriod.forEach(s => {
        const key = new Date(s.timestamp);
        if (interval === 'day') key.setHours(0,0,0,0);
        else if (interval === 'hour') key.setMinutes(0,0,0);
        else if (interval === 'minute') key.setSeconds(0,0);
        
        const keyStr = key.toISOString();
        if (trendMap.has(keyStr)) {
            trendMap.get(keyStr).shares++;
        }
    });
    
    // Fill impressions (Stored as aggregated count per day/date)
    impressionsInPeriod.forEach(imp => {
        // Since impressions are day-bucketed in model, distribution to hours/mins is approximation or just singular point
        // If interval is day, perfect mapping. If hour, put all at 00:00 or distribute?
        // Model: [{ date: Date, count: Num }]
        const key = new Date(imp.date);
        if (interval === 'day') {
             key.setHours(0,0,0,0);
             const keyStr = key.toISOString();
             if (trendMap.has(keyStr)) {
                 trendMap.get(keyStr).impressions += imp.count;
             }
        } else {
             // For granular charts, day-bucketed data is hard. Put it at start of day.
             key.setHours(0,0,0,0); // Align to day start
             // Only add if this specific hour slot exists (00:00)
             const keyStr = key.toISOString();
             if (trendMap.has(keyStr)) {
                 trendMap.get(keyStr).impressions += imp.count;
             }
        }
    });

    // Convert to array
    // Convert to array
    const mergedTrend = Array.from(trendMap, ([date, counts]) => ({ 
        date, 
        views: counts.views,
        likes: counts.likes,
        downloads: counts.downloads,
        shares: counts.shares,
        impressions: counts.impressions
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    const periodViews = viewTimestamps.length;

    // Country distribution and age demographics from view history
    const countryStats = {};
    const ageGroups = {
      '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, 'Unknown': 0
    };

    // Populate template with user details for age calculation
    const populatedTemplate = await ButtonTemplate.findById(id)
        .populate({
            path: 'viewHistory.viewers.userId',
            select: 'dateOfBirth'
        });

    populatedTemplate?.viewHistory?.forEach(history => {
        history.viewers?.forEach(viewer => {
            if (new Date(viewer.timestamp) >= startTime) {
                // Country stats
                const country = viewer.country || "Unknown";
                countryStats[country] = (countryStats[country] || 0) + 1;

                // Age demographics
                if (viewer.userId && viewer.userId.dateOfBirth) {
                    const dob = new Date(viewer.userId.dateOfBirth);
                    const diff_ms = Date.now() - dob.getTime();
                    const age_dt = new Date(diff_ms);
                    const age = Math.abs(age_dt.getUTCFullYear() - 1970);
                    
                    if (age >= 18 && age <= 24) ageGroups['18-24']++;
                    else if (age >= 25 && age <= 34) ageGroups['25-34']++;
                    else if (age >= 35 && age <= 44) ageGroups['35-44']++;
                    else if (age >= 45 && age <= 54) ageGroups['45-54']++;
                    else if (age >= 55) ageGroups['55+']++;
                    else ageGroups['Unknown']++;
                } else {
                    ageGroups['Unknown']++;
                }
            }
        });
    });

    const countryDistribution = Object.entries(countryStats)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const ageDistribution = Object.entries(ageGroups)
        .map(([name, value]) => ({ name, value }));



    // ... (rest of country/age stats logic unchanged) ...
    // Note: I need to wrap this properly to not break the file structure.
    // Wait, the "Convert to array" block is at line 116.
    // I should target lines 116-121 first. 
    // BUT replace_file_content requires contiguous block.
    // The previous tool call covered lines 55-113.
    // I need to update 116-121 AND 172-180.
    // I will use multi_replace for this.
    
    // THIS TOOL CALL IS JUST FOR THE RETURN OBJECT (Lines 172-180)
    // AND THE ARRAY MAP (Lines 116-121)
    // Since I can't use multi_replace in parallel easily, I will just continue with replace for the return object
    // and rely on the fact I already updated the loop logic above implicitly (wait, no I didn't update the array map).
    // The previous replace *ended* at line 113.
    // So lines 116-121 are still old. I must update them.
    
    const response = {
      totalViews: template.viewsCount || 0,
      totalLikes: template.likeCount || 0,
      totalDownloads: template.downloadsCount || 0,
      totalShares: template.sharesCount || 0,
      totalImpressions: template.impressionsCount || 0,
      periodViews,
      viewsTrend: mergedTrend,
      countryDistribution,
      ageDistribution
    };


    res.status(200).json(response);

  } catch (error) {
    console.error("GET TEMPLATE ANALYTICS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
});
