import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, getCollectionSimanim, getAllAnnotations, getAnnotationCountsByChelek } from "@/lib/db";
import { getSimansByTopic } from "@/lib/simanTopics";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "אסור" }, { status: 401 });
  const { id } = await params;
  const coll = getCollection(id);
  if (!coll) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  if (coll.userId !== session.user.id && session.user.role !== "admin") return NextResponse.json({ error: "אסור" }, { status: 403 });

  let simanList: { chelek: string; simanNumber: number }[] = [];

  if (coll.orgMode === "free") {
    const stored = getCollectionSimanim(id);
    simanList = stored.map((s) => ({ chelek: s.chelek, simanNumber: s.simanNumber }));
  } else if (coll.orgMode === "topic" && coll.chelek && coll.topic) {
    const nums = getSimansByTopic(coll.chelek, coll.topic);
    simanList = nums.map((n) => ({ chelek: coll.chelek!, simanNumber: n }));
  } else if (coll.orgMode === "quantity" && coll.chelek) {
    const counts = getAnnotationCountsByChelek(coll.chelek);
    simanList = counts.map((c) => ({ chelek: coll.chelek!, simanNumber: parseInt(c.siman, 10) }));
  }

  const result = simanList.map(({ chelek, simanNumber }) => ({
    chelek,
    simanNumber,
    annotations: getAllAnnotations(chelek, String(simanNumber), "approved"),
  }));

  return NextResponse.json(result);
}
