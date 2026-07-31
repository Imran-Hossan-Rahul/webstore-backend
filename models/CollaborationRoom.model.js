import mongoose from "mongoose";

const CollaborationRoomSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const CollaborationRoom = mongoose.models.CollaborationRoom || mongoose.model("CollaborationRoom", CollaborationRoomSchema);

export default CollaborationRoom;
