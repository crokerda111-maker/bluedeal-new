import { notFound } from "next/navigation";
import { getCommunityBoard } from "../../../lib/boardConfig";
import { pageMetadata } from "../../../lib/site";

export async function generateMetadata({ params }: { params: Promise<{ board: string }> }) {
  const board = getCommunityBoard((await params).board);
  return board ? pageMetadata(`${board.title} | BLUEDEAL`, board.description, `/community/${board.slug}`) : pageMetadata("게시판을 찾을 수 없습니다 | BLUEDEAL", "게시판 경로를 확인해 주세요.", undefined, true);
}

export default async function BoardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ board: string }> }) {
  if (!getCommunityBoard((await params).board)) notFound();
  return children;
}
