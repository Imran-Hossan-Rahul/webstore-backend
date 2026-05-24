/**
 * challengePhaseScheduler.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs every 5 minutes via node-cron.
 * Automatically advances challenge phases based on phase date boundaries.
 *
 * Transition logic (all date-driven, status is the authority after transition):
 *
 *  registrationStart  passed  →  draft / upcoming  ──►  registration_open
 *  registrationEnd    passed  →  registration_open  ──►  submissions_open   (if submissionStart also passed, else submissions_open is still the right next state)
 *  submissionStart    passed  →  registration_open  ──►  submissions_open   (covers "skip reg" scenario)
 *  submissionEnd      passed  →  submissions_open   ──►  in_review
 *  judgingEnd         passed  →  in_review          ──►  completed          (only if winners already selected)
 *
 * IMPORTANT: If a host has *manually* pushed a challenge forward (e.g. already
 * set it to "in_review" before the date), this scheduler will NOT go backwards.
 * It only moves FORWARD and only when the date condition is met.
 */

import cron from "node-cron";
import Challenge from "../models/Challenge.model.js";
import logger from "../utils/logger.js";

// ─── Phase order — used to determine "forward only" ───────────────────────
const PHASE_ORDER = [
  "draft",
  "upcoming",
  "registration_open",
  "submissions_open",
  "in_review",
  "completed",
  "cancelled",
];

const phaseRank = (status) => {
  const idx = PHASE_ORDER.indexOf(status);
  return idx === -1 ? 999 : idx;
};

// ─── Core transition function ────────────────────────────────────────────────
async function runPhaseTransitions() {
  const now = new Date();

  try {
    // Only look at challenges that are NOT in a terminal state
    const challenges = await Challenge.find({
      status: { $nin: ["completed", "cancelled"] },
    }).select("_id title status phases endDate winners lastPhaseUpdatedAt");

    let advanced = 0;

    for (const challenge of challenges) {
      const p = challenge.phases || {};
      const currentStatus = challenge.status;
      let nextStatus = null;

      // ── Rule 1: draft / upcoming → registration_open ──────────────────────
      if (
        ["draft", "upcoming"].includes(currentStatus) &&
        p.registrationStart &&
        now >= new Date(p.registrationStart)
      ) {
        nextStatus = "registration_open";
      }

      // ── Rule 2: registration_open → submissions_open ──────────────────────
      //    Triggered when registrationEnd has passed OR submissionStart has arrived
      if (
        currentStatus === "registration_open" &&
        (
          (p.registrationEnd && now >= new Date(p.registrationEnd)) ||
          (p.submissionStart  && now >= new Date(p.submissionStart))
        )
      ) {
        nextStatus = "submissions_open";
      }

      // ── Rule 3: submissions_open → in_review ──────────────────────────────
      //    Triggered when submissionEnd (deadline) has passed
      const submissionDeadline = p.submissionEnd || challenge.endDate;
      if (
        currentStatus === "submissions_open" &&
        submissionDeadline &&
        now >= new Date(submissionDeadline)
      ) {
        nextStatus = "in_review";
      }

      // ── Rule 4: in_review → completed ─────────────────────────────────────
      //    Only auto-complete if judgingEnd has passed AND winners have been set
      if (
        currentStatus === "in_review" &&
        p.judgingEnd &&
        now >= new Date(p.judgingEnd) &&
        challenge.winners &&
        challenge.winners.length > 0
      ) {
        nextStatus = "completed";
      }

      // ── Guard: only move FORWARD in the phase order ───────────────────────
      if (
        nextStatus &&
        phaseRank(nextStatus) > phaseRank(currentStatus)
      ) {
        challenge.status = nextStatus;
        challenge.lastPhaseUpdatedAt = now;
        await challenge.save();
        advanced++;
        logger.info(
          `[PhaseScheduler] "${challenge.title}" (${challenge._id}): ${currentStatus} → ${nextStatus}`
        );
      }
    }

    if (advanced > 0) {
      logger.info(`[PhaseScheduler] Tick complete — ${advanced} challenge(s) advanced.`);
    }
  } catch (err) {
    logger.error("[PhaseScheduler] Error during phase transition:", err.message);
  }
}

// ─── Scheduler bootstrap ────────────────────────────────────────────────────
export function startChallengePhaseScheduler() {
  // Run immediately on startup (catch anything missed while server was down)
  runPhaseTransitions();

  // Then run every 5 minutes
  cron.schedule("*/5 * * * *", () => {
    logger.info("[PhaseScheduler] Running challenge phase check...");
    runPhaseTransitions();
  });

  logger.info("✅ [PhaseScheduler] Challenge phase scheduler started (every 5 min).");
}
