import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const Comment = mongoose.models.Comment || mongoose.model("Comment", CommentSchema);

export default Comment;
