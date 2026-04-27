import { loginHandler } from "../../../../backend/routes/authRoutes";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  let statusCode = 200;
  let jsonBody: any = null;

  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: any) {
      jsonBody = payload;
      return this;
    },
  };

  await new Promise<void>((resolve, reject) => {
    const next = (err?: any) => (err ? reject(err) : resolve());
    // @ts-expect-error adapter request
    void loginHandler({ body }, res, next);
  });

  return Response.json(jsonBody ?? { error: "No response" }, { status: statusCode });
}

