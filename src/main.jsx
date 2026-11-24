import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "./store";
import App from "./App";
import "./styles.css";
class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fatal-error">
        <h1>Đã xảy ra lỗi giao diện</h1>
        <p>Dữ liệu đã lưu vẫn được giữ trên máy chủ.</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>
          Tải lại ứng dụng
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <Provider>
      <App />
    </Provider>
  </ErrorBoundary>,
);
