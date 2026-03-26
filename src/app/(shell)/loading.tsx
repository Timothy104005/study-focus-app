export default function Loading() {
  return (
    <div className="page">
      <div className="state-card">
        <div className="loading-dot" />
        <div className="stack-xs">
          <h2 className="state-title">頁面準備中</h2>
          <p className="state-description">正在載入你的讀書資料與班級資訊。</p>
        </div>
      </div>
    </div>
  );
}

