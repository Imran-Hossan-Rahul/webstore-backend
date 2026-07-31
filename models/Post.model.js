import mongoose from "mongoose";

const PostSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);

export default Post;
