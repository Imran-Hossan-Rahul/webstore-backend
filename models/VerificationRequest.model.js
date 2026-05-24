import mongoose from "mongoose";

const verificationRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["individual", "company", "enterprise"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_review", "approved", "rejected"],
      default: "pending",
    },
    
    // Identity Information
    legalName: { type: String, required: true },
    idType: { 
      type: String, 
      enum: ["national_id", "passport", "driving_license", "business_license"],
      required: true 
    },
    idNumber: { type: String, required: true },
    
    // Documents (Cloudinary URLs)
    idDocumentFront: { type: String, required: true },
    idDocumentBack: { type: String },
    selfieWithId: { type: String, required: true },
    proofOfAddress: { type: String }, // Optional for lower tiers
    businessCertificate: { type: String }, // Mandatory for company/enterprise
    
    // Business Details (Optional for individual)
    companyName: { type: String },
    companyWebsite: { type: String },
    companyEmail: { type: String },
    taxId: { type: String },
    
    // Social/Professional Proof
    professionalLinks: [{ type: String }], // LinkedIn, GitHub, etc.
    
    // Admin Review
    adminNotes: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

const VerificationRequest = mongoose.models.VerificationRequest || mongoose.model("VerificationRequest", verificationRequestSchema);
export default VerificationRequest;
