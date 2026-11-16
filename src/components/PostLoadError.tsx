export default function PostLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="status" className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
      <p>게시글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-amber-200/30 px-3 py-2 font-medium hover:bg-amber-200/10">다시 불러오기</button>
    </div>
  );
}
