
import mongoose from "mongoose";

const applicantSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  proposal: {
    coverLetter:   { type: String, default: "" },
    portfolioLinks: [{ type: String }],
  },
});

const jobSchema = mongoose.Schema({
  applicants: [applicantSchema],
});

const Job = mongoose.model("JobTest", jobSchema);

async function test() {
  try {
    const job = new Job({
      applicants: [{
        user: new mongoose.Types.ObjectId(),
        proposal: {
          coverLetter: "Test",
          portfolioLinks: [{ url: "http://example.com", label: "Example" }]
        }
      }]
    });
    await job.validate();
    console.log("Validation passed");
  } catch (err) {
    console.log("Validation failed:", err.message);
  }
}

test();
