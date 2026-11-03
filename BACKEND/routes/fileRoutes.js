const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const mongoose = require("mongoose");
const multer = require("multer");
const { requireAuth } = require("../middleware/auth");
const { isId } = require("../utils/helpers");

const MAX_MB = parseInt(process.env.MAX_UPLOAD_MB || "25", 10);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_MB * 1024 * 1024 } });

// Files live in MongoDB GridFS so they survive redeploys (Render's disk is temporary).
let bucket = null;
const getBucket = () => {
  if (!bucket && mongoose.connection.db) {
    bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });
  }
  return bucket;
};
mongoose.connection.on("connected", () => (bucket = null));

const kindOf = (mime = "") => {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
};

// UPLOAD  (multipart/form-data, field name "file")
router.post("/", requireAuth, (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? `File is too large. Maximum size is ${MAX_MB} MB.` : "Upload failed.";
      return res.status(400).json({ message: msg });
    }
    if (!req.file) return res.status(400).json({ message: "No file received." });
    const b = getBucket();
    if (!b) return res.status(503).json({ message: "Storage is not ready yet, please retry." });

    try {
      const key = crypto.randomBytes(12).toString("hex");
      const mime = req.file.mimetype || "application/octet-stream";
      const name = (req.file.originalname || "file").replace(/[\r\n"]/g, "").slice(0, 120);
      const stream = b.openUploadStream(name, {
        metadata: { key, mime, owner: req.userId },
      });
      stream.end(req.file.buffer);
      stream.on("error", () => res.status(500).json({ message: "Could not store file." }));
      stream.on("finish", () => {
        res.status(201).json({
          url: `/api/files/${stream.id}/${key}`,
          fileType: kindOf(mime),
          fileName: name,
          fileSize: req.file.size,
          mimeType: mime,
        });
      });
    } catch (e) {
      console.error("Upload error:", e);
      res.status(500).json({ message: "Could not store file." });
    }
  });
});

// DOWNLOAD / STREAM (supports HTTP Range for audio/video seeking on iOS & Android)
router.get("/:id/:key", async (req, res) => {
  try {
    const b = getBucket();
    if (!b || !isId(req.params.id)) return res.status(404).end();
    const _id = new mongoose.Types.ObjectId(req.params.id);
    const file = await mongoose.connection.db.collection("uploads.files").findOne({ _id });
    if (!file || file.metadata?.key !== req.params.key) return res.status(404).end();

    const size = file.length;
    const mime = file.metadata?.mime || "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    const disp = req.query.download ? "attachment" : "inline";
    res.setHeader("Content-Disposition", `${disp}; filename="${encodeURIComponent(file.filename)}"`);

    const range = req.headers.range;
    if (range && size > 0) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start = m && m[1] ? parseInt(m[1], 10) : 0;
      let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
      if (m && !m[1] && m[2]) { start = Math.max(size - parseInt(m[2], 10), 0); end = size - 1; }
      end = Math.min(end, size - 1); // players may ask past the end – serve what exists (RFC 7233)
      if (start >= size || start > end) {
        res.setHeader("Content-Range", `bytes */${size}`);
        return res.status(416).end();
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      res.setHeader("Content-Length", end - start + 1);
      return b.openDownloadStream(_id, { start, end: end + 1 }).on("error", () => res.end()).pipe(res);
    }
    res.setHeader("Content-Length", size);
    b.openDownloadStream(_id).on("error", () => res.end()).pipe(res);
  } catch (e) {
    console.error("Download error:", e);
    res.status(500).end();
  }
});

module.exports = router;
