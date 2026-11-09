"use client";

import { useState } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  style?: React.CSSProperties;
};

/** Password input with a show/hide (eye) toggle. */
export default function PasswordInput({ style, ...rest }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        {...rest}
        type={visible ? "text" : "password"}
        style={{ ...style, paddingRight: 44 }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        tabIndex={-1}
        style={{
          position: "absolute",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--color-on-surface-variant)",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
          {visible ? "visibility_off" : "visibility"}
        </span>
      </button>
    </div>
  );
}
