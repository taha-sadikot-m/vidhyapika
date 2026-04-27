import { verifyJWT, requireAuth } from "../../../../backend/middleware/auth";
import { getBucket } from "../../../../backend/firebase/admin";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAuth(user);
  if (err) return err;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: "Invalid file type. Only JPEG, PNG, WebP, GIF allowed." }, { status: 400 });
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: "File too large. Maximum size is 10MB." }, { status: 400 });
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const folder = formData.get("folder") as string || "uploads";
    const filename = `${folder}/${randomUUID()}.${ext}`;

    const bucket = getBucket();
    const fileRef = bucket.file(filename);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          uploadedBy: user!.sub,
          originalName: file.name,
        },
      },
    });

    await fileRef.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    return Response.json({ url: publicUrl, filename });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
