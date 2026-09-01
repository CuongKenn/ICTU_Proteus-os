## Mô tả vấn đề

`AIChatWidget.tsx` hiện không có React Error Boundary. Nếu bất kỳ sub-component nào (MessageBubble, DslPreviewPanel, ThinkingIndicator) throw error, toàn bộ widget sẽ crash và hiện blank screen.

Đặc biệt nguy cơ cao tại:
- `renderMessageContent()` — parse markdown có thể lỗi với input bất thường
- `DslPreviewPanel` — truy cập `preview.dry_run_result.preview` có thể undefined
- WebSocket/API errors không được handle ở UI level

## Đề xuất sửa

1. Wrap `AIChatWidget` trong Error Boundary component
2. Hiển thị fallback UI thay vì crash (VD: "AI Chat gặp lỗi, vui lòng thử lại")
3. Log error để debug
4. Thêm null-check cho `preview.dry_run_result?.preview`

```tsx
class AIChatErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <FallbackUI onRetry={() => this.setState({ hasError: false })} />;
    return this.props.children;
  }
}
```

## Files liên quan
- `core-engine/frontend/src/components/AIChatWidget.tsx`

## Phân loại
- **Loại:** Quality / UX
- **Ưu tiên:** Medium
