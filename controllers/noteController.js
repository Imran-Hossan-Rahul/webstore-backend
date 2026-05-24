import Note from "../models/Note.model.js";
import FavoriteFolder from "../models/FavoriteFolder.model.js";

// @desc    Create a new note/highlight
// @route   POST /api/v1/notes
// @access  Private
export const createNote = async (req, res) => {
  try {
    const { codexId, sourceUrl, highlightedText, title, noteContent, folderId, isPublic } = req.body;

    if (!highlightedText) {
      return res.status(400).json({ success: false, message: "Highlighted text is required" });
    }

    const note = await Note.create({
      user: req.user._id,
      codex: codexId || null,
      sourceUrl: sourceUrl || "",
      highlightedText,
      title: title || "",
      noteContent: noteContent || "",
      isPublic: isPublic || false
    });

    // If folderId is provided, add this note to the folder
    if (folderId) {
      const folder = await FavoriteFolder.findOne({ _id: folderId, user: req.user._id });
      if (folder) {
        // Only push if it doesn't already exist in that folder
        const exists = folder.items.some(
          (item) => item.itemId.toString() === note._id.toString()
        );
        if (!exists) {
          folder.items.push({ itemId: note._id, itemType: "Note" });
          await folder.save();
        }
      }
    }

    res.status(201).json({ success: true, data: note });
  } catch (error) {
    console.error("Create note error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get user's notes
// @route   GET /api/v1/notes
// @access  Private
export const getNotes = async (req, res) => {
  try {
    const { codexId } = req.query;
    const query = { user: req.user._id };
    if (codexId) query.codex = codexId;

    const notes = await Note.find(query)
      .populate("codex", "title slug coverImage author")
      .sort("-createdAt");

    const formattedNotes = notes.map(note => ({
       ...note.toObject(),
       type: "note"
    }));

    res.status(200).json({ success: true, data: formattedNotes });
  } catch (error) {
    console.error("Get notes error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete a note
// @route   DELETE /api/v1/notes/:id
// @access  Private
export const deleteNote = async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
    if (!note) {
      return res.status(404).json({ success: false, message: "Note not found" });
    }

    await note.deleteOne();

    // Also remove from any FavoriteFolders
    await FavoriteFolder.updateMany(
      { user: req.user._id, "items.itemId": req.params.id },
      { $pull: { items: { itemId: req.params.id } } }
    );

    res.status(200).json({ success: true, message: "Note deleted" });
  } catch (error) {
    console.error("Delete note error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get public notes for a codex
// @route   GET /api/v1/notes/codex/:codexId/public
// @access  Public
export const getPublicNotesForCodex = async (req, res) => {
  try {
    const { codexId } = req.params;
    const notes = await Note.find({ codex: codexId, isPublic: true })
      .populate("user", "name username profilePicture")
      .sort("-createdAt");
    
    res.status(200).json({ success: true, data: notes });
  } catch (error) {
    console.error("Get public notes error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Toggle note visibility
// @route   PATCH /api/v1/notes/:id/visibility
// @access  Private
export const toggleNoteVisibility = async (req, res) => {
  try {
    const { isPublic } = req.body;
    const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
    
    if (!note) {
      return res.status(404).json({ success: false, message: "Note not found" });
    }
    
    note.isPublic = isPublic !== undefined ? isPublic : !note.isPublic;
    await note.save();
    
    res.status(200).json({ success: true, data: note });
  } catch (error) {
    console.error("Toggle note visibility error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
