/**
 * notificationHelper.js
 *
 * Preference-aware notification dispatcher.
 *
 * Before any in-app notification is created, this module checks the
 * recipient's `notificationPreferences.inApp` settings.
 * Before any email is sent, it checks `notificationPreferences.email`.
 *
 * Mapping: notificationHelper event type → preference key
 *   follow   → newFollower
 *   like     → newLike
 *   comment  → newComment
 *   message  → (no preference gate – always allowed)
 *   purchase → (no preference gate – always allowed)
 *   job      → newJob
 *   challenge→ challengeUpdates
 */

import { createNotification } from "../controllers/notificationController.js";
import { sendEventEmail }      from "../services/email.service.js";
import User                    from "../models/User.model.js";

// ─── Preference keys per event type ───────────────────────────────────────────
const INAPP_PREF_KEY = {
  follow:    "newFollower",
  like:      "newLike",
  comment:   "newComment",
  job:       "newJob",
  challenge: "challengeUpdates",
  // message / purchase: always deliver → no key listed
};

const EMAIL_PREF_KEY = {
  follow:    "newFollower",
  like:      "newLike",
  comment:   "newComment",
  job:       "newJob",
  challenge: "challengeUpdates",
  // weeklyDigest / marketingEmails are triggered separately, not here
};

/**
 * Fetch only the notification prefs + email of a user.
 * Returns null if user not found.
 */
async function getRecipientPrefs(recipientId) {
  return User.findById(recipientId)
    .select("notificationPreferences email name")
    .lean();
}

/**
 * Returns true if in-app notification is allowed for this event type.
 * If the preference key doesn't exist for the type (e.g. message),
 * it defaults to allowed.
 */
function isInAppAllowed(prefs, eventType) {
  const key = INAPP_PREF_KEY[eventType];
  if (!key) return true; // no preference gate
  return prefs?.notificationPreferences?.inApp?.[key] !== false; // default true
}

/**
 * Returns true if email notification is allowed for this event type.
 */
function isEmailAllowed(prefs, eventType) {
  const key = EMAIL_PREF_KEY[eventType];
  if (!key) return true;
  return prefs?.notificationPreferences?.email?.[key] !== false; // default true
}

// ─── Core dispatcher ──────────────────────────────────────────────────────────

/**
 * Dispatch a preference-gated notification.
 *
 * @param {object} io         - Socket.IO instance
 * @param {string} recipientId
 * @param {string} eventType  - 'follow' | 'like' | 'comment' | 'message' | 'job' | 'challenge' | 'purchase'
 * @param {object} notifData  - { sender, title, message, link }
 * @param {object} emailData  - { subject, bodyHtml } – pass null to skip email
 */
async function dispatch(io, recipientId, eventType, notifData, emailData = null) {
  try {
    const recipient = await getRecipientPrefs(recipientId);
    if (!recipient) return;

    // ── In-App ──────────────────────────────────────────────────────────────
    if (isInAppAllowed(recipient, eventType)) {
      await createNotification(recipientId, {
        ...notifData,
        type: eventType,
      });
      if (io) {
        io.emit(`user:${recipientId}:notification`, { type: eventType });
      }
    }

    // ── Email ───────────────────────────────────────────────────────────────
    if (emailData && isEmailAllowed(recipient, eventType)) {
      await sendEventEmail(recipient.email, recipient.name, emailData).catch(err =>
        console.error(`[NotifHelper] Email send failed for ${eventType}:`, err.message)
      );
    }
  } catch (err) {
    console.error(`[NotifHelper] dispatch error (${eventType}):`, err.message);
  }
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export const notifyNewFollower = (io, recipientId, followerId, followerName) =>
  dispatch(io, recipientId, "follow",
    {
      sender:  followerId,
      title:   "New Follower",
      message: `${followerName} started following you`,
      link:    `/user/${followerId}`,
    },
    {
      subject:  `${followerName} started following you`,
      bodyHtml: buildEmailBody(
        "New Follower",
        `<strong>${followerName}</strong> started following you on the platform.`,
        `/user/${followerId}`,
        "View Profile"
      ),
    }
  );

export const notifyNewLike = (io, recipientId, likerId, likerName, postId) =>
  dispatch(io, recipientId, "like",
    {
      sender:  likerId,
      title:   "New Like",
      message: `${likerName} liked your post`,
      link:    `/artifacts/${postId}`,
    },
    {
      subject:  `${likerName} liked your content`,
      bodyHtml: buildEmailBody(
        "Someone liked your content",
        `<strong>${likerName}</strong> liked your post.`,
        `/artifacts/${postId}`,
        "View Post"
      ),
    }
  );

export const notifyNewComment = (io, recipientId, commenterId, commenterName, postId) =>
  dispatch(io, recipientId, "comment",
    {
      sender:  commenterId,
      title:   "New Comment",
      message: `${commenterName} commented on your post`,
      link:    `/artifacts/${postId}`,
    },
    {
      subject:  `${commenterName} commented on your post`,
      bodyHtml: buildEmailBody(
        "New Comment",
        `<strong>${commenterName}</strong> left a comment on your post.`,
        `/artifacts/${postId}`,
        "View Comment"
      ),
    }
  );

export const notifyNewMessage = (io, recipientId, senderId, senderName, chatId) =>
  dispatch(io, recipientId, "message",
    {
      sender:  senderId,
      title:   "New Message",
      message: `${senderName} sent you a message`,
      link:    `/inbox?chat=${chatId}`,
    },
    null // messages never send emails — too noisy
  );

export const notifyNewPurchase = (io, recipientId, buyerId, buyerName, artifactTitle) =>
  dispatch(io, recipientId, "purchase",
    {
      sender:  buyerId,
      title:   "New Purchase",
      message: `${buyerName} purchased your artifact "${artifactTitle}"`,
      link:    `/dashboard`,
    },
    {
      subject:  `${buyerName} purchased your artifact`,
      bodyHtml: buildEmailBody(
        "New Purchase 🎉",
        `<strong>${buyerName}</strong> just purchased your artifact <em>"${artifactTitle}"</em>. Check your earnings in the dashboard.`,
        `/dashboard`,
        "View Dashboard"
      ),
    }
  );

export const notifyJobMatch = (io, recipientId, jobId, jobTitle) =>
  dispatch(io, recipientId, "job",
    {
      title:   "New Job Match",
      message: `A new job matches your skills: ${jobTitle}`,
      link:    `/jobs/${jobId}`,
    },
    {
      subject:  `New job match: ${jobTitle}`,
      bodyHtml: buildEmailBody(
        "New Job Opportunity",
        `A new job posting matches your skills: <strong>${jobTitle}</strong>.`,
        `/jobs/${jobId}`,
        "View Job"
      ),
    }
  );

export const notifyChallengeUpdate = (io, recipientId, challengeId, updateMsg) =>
  dispatch(io, recipientId, "challenge",
    {
      title:   "Challenge Update",
      message: updateMsg,
      link:    `/challenges/${challengeId}`,
    },
    {
      subject:  "Challenge Update",
      bodyHtml: buildEmailBody(
        "Challenge Update",
        updateMsg,
        `/challenges/${challengeId}`,
        "View Challenge"
      ),
    }
  );

// ─── Email artifact builder ────────────────────────────────────────────────────

function buildEmailBody(heading, bodyText, ctaLink, ctaLabel) {
  const CLIENT_URL = process.env.CLIENT_URL || "";
  return `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px;border:1px solid #f0f0f0;border-radius:16px;">
      <div style="margin-bottom:32px;">
        <h2 style="color:#0f172a;font-size:20px;font-weight:700;letter-spacing:-0.02em;margin:0 0 8px 0;">${heading}</h2>
        <div style="width:40px;height:3px;background:#0f172a;border-radius:2px;"></div>
      </div>
      <div style="color:#334155;font-size:15px;line-height:1.7;margin-bottom:32px;">
        <p style="margin:0;">${bodyText}</p>
      </div>
      <div style="text-align:center;margin-bottom:40px;">
        <a href="${CLIENT_URL}${ctaLink}"
           style="background-color:#0f172a;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.05em;display:inline-block;">
          ${ctaLabel}
        </a>
      </div>
      <div style="padding-top:24px;border-top:1px solid #f1f5f9;text-align:center;">
        <p style="font-size:11px;color:#94a3b8;line-height:1.5;margin:0;">
          You received this email because you have notifications enabled.<br/>
          <a href="${CLIENT_URL}/settings?tab=notifications" style="color:#94a3b8;">Manage preferences</a>
        </p>
      </div>
    </div>
  `;
}

